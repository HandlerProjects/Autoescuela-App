import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Disponibilidad real de un instructor (reservas + bloqueos de TODOS sus alumnos).
// El cliente anon+token del alumno no puede leer esto directamente: la RLS de
// `bookings` solo permite ver las reservas del propio alumno, así que un hueco
// ocupado por OTRO alumno del mismo instructor aparecía como libre en el picker.
export async function POST(req: NextRequest) {
  const { token, studentId, instructorId, from, to } = await req.json()

  if (!token || !studentId || !instructorId || !from || !to) {
    return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verificar que el token corresponde a un alumno activo con ese instructor asignado
  const { data: student, error: studentError } = await supabaseAdmin
    .from('students')
    .select('id, instructor_id')
    .eq('id', studentId)
    .eq('token', token)
    .eq('is_active', true)
    .single()

  if (studentError || !student || student.instructor_id !== instructorId) {
    return NextResponse.json({ error: 'Alumno no encontrado o inactivo' }, { status: 403 })
  }

  const [{ data: bookings, error: bookingsError }, { data: blockedSlotsData, error: blockedSlotsError }, { data: blockedDaysData, error: blockedDaysError }, { data: overridesData, error: overridesError }] = await Promise.all([
    supabaseAdmin
      .from('bookings')
      .select('practice_date, start_time, practice_type, practice_subtype')
      .eq('instructor_id', instructorId)
      .gte('practice_date', from)
      .lte('practice_date', to)
      .neq('status', 'cancelled'),
    supabaseAdmin
      .from('blocked_slots')
      .select('date, start_time, end_time')
      .eq('instructor_id', instructorId)
      .gte('date', from)
      .lte('date', to),
    supabaseAdmin
      .from('blocked_days')
      .select('date, reason')
      .eq('instructor_id', instructorId)
      .gte('date', from)
      .lte('date', to),
    // Días con horario especial: el alumno tiene que ver las horas reales de ese día, no las del
    // horario habitual del profesor.
    supabaseAdmin
      .from('schedule_overrides')
      .select('date, sessions, break_minutes')
      .eq('instructor_id', instructorId)
      .gte('date', from)
      .lte('date', to),
  ])

  if (bookingsError) return NextResponse.json({ error: bookingsError.message }, { status: 500 })
  if (blockedSlotsError) return NextResponse.json({ error: blockedSlotsError.message }, { status: 500 })
  if (blockedDaysError) return NextResponse.json({ error: blockedDaysError.message }, { status: 500 })
  // Los horarios especiales son un extra: si no se pueden leer se sigue con el horario habitual.
  // Tumbar la reserva entera por esto sería mucho peor que enseñar las horas de siempre.
  if (overridesError) console.error('availability: no se pudieron leer los horarios especiales:', overridesError.message)

  return NextResponse.json({
    takenSlots: (bookings ?? []).map(b => ({
      date: b.practice_date,
      start: b.start_time.substring(0, 5),
      type: b.practice_type,
      subtype: b.practice_subtype ?? null,
    })),
    blockedSlots: (blockedSlotsData ?? []).map(b => ({
      date: b.date,
      start: b.start_time.substring(0, 5),
      end: b.end_time.substring(0, 5),
    })),
    blockedDays: (blockedDaysData ?? []).map(b => ({ date: b.date, reason: b.reason })),
    scheduleOverrides: (overridesData ?? []).map(o => ({
      date: o.date,
      sessions: o.sessions,
      break_minutes: o.break_minutes,
    })),
  })
}
