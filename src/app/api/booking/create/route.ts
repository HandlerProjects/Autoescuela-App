import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const {
    token, studentId,
    practiceDate, startTime, endTime,
    practiceType, practiceSubtype, pickupLocation,
  } = await req.json()

  if (!token || !studentId || !practiceDate || !startTime || !endTime || !practiceType) {
    return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verificar que el token corresponde al studentId y está activo
  const { data: student, error: studentError } = await supabaseAdmin
    .from('students')
    .select('id, instructor_id, exam_mode, max_concurrent_bookings, max_weekly_bookings')
    .eq('id', studentId)
    .eq('token', token)
    .eq('is_active', true)
    .single()

  if (studentError || !student) {
    return NextResponse.json({ error: 'Alumno no encontrado o inactivo' }, { status: 403 })
  }

  const today = new Date().toISOString().split('T')[0]

  // Comprobar ventana de 7 días naturales
  const slotDt = new Date(`${practiceDate}T${startTime}:00`)
  const windowCutoff = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  if (slotDt > windowCutoff) {
    return NextResponse.json({ error: 'Solo puedes reservar dentro de los próximos 7 días naturales.' }, { status: 409 })
  }

  // Comprobar que el día no está bloqueado
  const { data: blockedDay } = await supabaseAdmin
    .from('blocked_days')
    .select('id')
    .eq('instructor_id', student.instructor_id)
    .eq('date', practiceDate)
    .limit(1)
    .maybeSingle()

  if (blockedDay) {
    return NextResponse.json({ error: 'Este día está bloqueado. El profesor no está disponible.' }, { status: 409 })
  }

  // Comprobar límite diario
  const maxDaily = student.exam_mode ? 2 : 1
  const { count: dayCount } = await supabaseAdmin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('status', 'confirmed')
    .eq('practice_date', practiceDate)
  if ((dayCount ?? 0) >= maxDaily) {
    return NextResponse.json({
      error: student.exam_mode
        ? 'Ya tienes 2 prácticas reservadas ese día (límite en modo examen).'
        : 'Ya tienes una práctica reservada ese día.',
    }, { status: 409 })
  }

  // Comprobar límite semanal
  const d = new Date(practiceDate + 'T00:00:00')
  const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1
  const mon = new Date(d); mon.setDate(d.getDate() - dayOfWeek)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const weekFrom = mon.toISOString().split('T')[0]
  const weekTo = sun.toISOString().split('T')[0]

  const maxWeekly = student.max_weekly_bookings ?? 5
  const { count: weekCount } = await supabaseAdmin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('status', 'confirmed')
    .gte('practice_date', weekFrom)
    .lte('practice_date', weekTo)
  if ((weekCount ?? 0) >= maxWeekly) {
    return NextResponse.json({ error: `Has alcanzado el límite de ${maxWeekly} prácticas esta semana.` }, { status: 409 })
  }

  // Insertar la reserva
  const { data: booking, error: insertError } = await supabaseAdmin
    .from('bookings')
    .insert({
      student_id: studentId,
      instructor_id: student.instructor_id,
      practice_date: practiceDate,
      start_time: startTime,
      end_time: endTime,
      practice_type: practiceType,
      practice_subtype: practiceSubtype ?? null,
      pickup_location: pickupLocation ?? null,
      status: 'confirmed',
    })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'Ese hueco acaba de ser reservado por otro alumno. Elige otro.' }, { status: 409 })
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ bookingId: booking.id })
}
