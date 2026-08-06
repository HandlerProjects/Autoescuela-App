import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // La secretaría no gestiona el calendario de prácticas
  if (user.role === 'secretary') return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const instructorId = searchParams.get('instructorId')
  if (!from || !to) return NextResponse.json({ error: 'from y to son obligatorios' }, { status: 400 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  let bookingsQuery = supabaseAdmin
    .from('bookings')
    .select('*, student:students(full_name, order_number)')
    .gte('practice_date', from)
    .lte('practice_date', to)
    .order('start_time', { ascending: true })

  let blockedDaysQuery = supabaseAdmin
    .from('blocked_days')
    .select('date')
    .gte('date', from)
    .lte('date', to)

  let blockedSlotsQuery = supabaseAdmin
    .from('blocked_slots')
    .select('*')
    .gte('date', from)
    .lte('date', to)

  // Días con horario especial, para que el calendario genere los huecos de ese día con el
  // horario que realmente rige y no con el habitual del profesor.
  let overridesQuery = supabaseAdmin
    .from('schedule_overrides')
    .select('date, sessions, break_minutes, reason')
    .gte('date', from)
    .lte('date', to)

  // Un instructor solo ve su propio calendario, nunca el de otros instructores
  // (comprobación de seguridad: se ignora cualquier instructorId que llegue por query string)
  if (user.role === 'instructor') {
    bookingsQuery = bookingsQuery.eq('instructor_id', user.id)
    blockedDaysQuery = blockedDaysQuery.eq('instructor_id', user.id)
    blockedSlotsQuery = blockedSlotsQuery.eq('instructor_id', user.id)
    overridesQuery = overridesQuery.eq('instructor_id', user.id)
  } else if (user.role === 'admin' && instructorId) {
    // El admin ve el calendario de un instructor concreto cuando lo selecciona;
    // sin instructorId se mantiene el comportamiento previo (todos mezclados).
    bookingsQuery = bookingsQuery.eq('instructor_id', instructorId)
    blockedDaysQuery = blockedDaysQuery.eq('instructor_id', instructorId)
    blockedSlotsQuery = blockedSlotsQuery.eq('instructor_id', instructorId)
    overridesQuery = overridesQuery.eq('instructor_id', instructorId)
  }

  const [{ data: bookingsData, error: bookingsError }, { data: blockedData, error: blockedError }, { data: slotsData, error: slotsError }, { data: overridesData, error: overridesError }] =
    await Promise.all([bookingsQuery, blockedDaysQuery, blockedSlotsQuery, overridesQuery])

  if (bookingsError) return NextResponse.json({ error: bookingsError.message }, { status: 500 })
  if (blockedError) return NextResponse.json({ error: blockedError.message }, { status: 500 })
  if (slotsError) return NextResponse.json({ error: slotsError.message }, { status: 500 })
  // Igual que en /api/booking/availability: sin horarios especiales el calendario sigue siendo
  // útil con el horario habitual; devolver 500 lo dejaría en blanco.
  if (overridesError) console.error('calendario: no se pudieron leer los horarios especiales:', overridesError.message)

  return NextResponse.json({
    bookings: bookingsData,
    blockedDays: blockedData,
    blockedSlots: slotsData,
    scheduleOverrides: overridesData ?? [],
  })
}
