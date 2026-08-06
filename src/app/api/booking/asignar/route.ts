import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/auth'
import { validateSlot } from '@/lib/validar-reserva'
import { getBonoStatus } from '@/lib/bono'

// Alta de una práctica hecha por el centro, no por el alumno.
//
// Existe por un caso real: personas mayores, o alumnos sin móvil, que no pueden reservar desde
// la app y lo hacen por teléfono o en el mostrador. Antes había que apuntarlo en un papel aparte
// y la agenda de la app quedaba incompleta.
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { studentId, instructorId, date, startTime, practiceType, practiceSubtype, pickupLocation, notes } =
    await req.json()

  if (!studentId || !date || !startTime || !practiceType) {
    return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 })
  }

  // Un profesor solo puede apuntar en SU agenda; admin y secretaría en la de cualquiera.
  const targetInstructorId = user.role === 'instructor' ? user.id : instructorId
  if (!targetInstructorId) {
    return NextResponse.json({ error: 'Falta el profesor' }, { status: 400 })
  }
  if (user.role === 'instructor' && instructorId && instructorId !== user.id) {
    return NextResponse.json({ error: 'Solo puedes apuntar prácticas en tu propio calendario' }, { status: 403 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: student, error: studentError } = await supabaseAdmin
    .from('students')
    .select('id, full_name, is_active, practice_types, practices_paid_through')
    .eq('id', studentId)
    .single()

  if (studentError || !student) {
    return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 })
  }
  if (!student.is_active) {
    return NextResponse.json({ error: 'Ese alumno está dado de baja' }, { status: 409 })
  }

  // El saldo sí se respeta: si no, apuntar a mano sería la forma de saltarse el control de pagos
  // sin querer. La secretaría tiene el botón "Pagado" en la misma pantalla de Pagos.
  const bono = await getBonoStatus(supabaseAdmin, studentId, student.practices_paid_through ?? 0)
  if (bono.suspended) {
    return NextResponse.json({
      error: `${student.full_name} tiene el saldo agotado. Confirma su pago en Pagos antes de apuntarle la práctica.`,
      suspended: true,
    }, { status: 409 })
  }

  // Los cupos diario y semanal NO se aplican aquí a propósito: son una política pensada para que
  // nadie acapare huecos reservando por su cuenta. Si el centro decide dar dos clases en un día,
  // debe poder. Lo que no se salta nunca es el solape: eso no es política, es imposible.
  const slot = await validateSlot(supabaseAdmin, {
    instructorId: targetInstructorId,
    date,
    startTime,
    practiceType,
    practiceSubtype: practiceSubtype ?? null,
  })

  if (!slot.ok) {
    return NextResponse.json({ error: slot.error }, { status: slot.status })
  }

  const { data: booking, error: insertError } = await supabaseAdmin
    .from('bookings')
    .insert({
      student_id: studentId,
      instructor_id: targetInstructorId,
      practice_date: date,
      start_time: startTime,
      end_time: slot.endTime,
      practice_type: practiceType,
      practice_subtype: practiceSubtype ?? null,
      pickup_location: pickupLocation ?? null,
      notes: notes ?? null,
      status: 'confirmed',
    })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'Ese hueco acaba de ocuparse. Elige otro.' }, { status: 409 })
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    bookingId: booking.id,
    studentName: student.full_name,
    endTime: slot.endTime,
    remaining: bono.remaining - 1,
  })
}
