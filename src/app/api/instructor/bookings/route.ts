import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/auth'
import { toDateString } from '@/lib/utils'

function getNextDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i + 1)
    return toDateString(d)
  })
}

// Identidad + reservas de hoy y próximos 7 días en una sola llamada — antes el cliente
// hacía /api/auth/me y luego, por separado, dos consultas más a bookings; el instructor
// tenía que esperar 2 saltos de red seguidos solo para ver su "Hoy".
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (user.role !== 'instructor') return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const today = toDateString(new Date())
  const next7 = getNextDays(7)

  const [{ data: todayData, error: todayError }, { data: upcomingData, error: upcomingError }] = await Promise.all([
    supabaseAdmin
      .from('bookings')
      .select('*, student:students(full_name, order_number)')
      .eq('instructor_id', user.id)
      .eq('practice_date', today)
      .neq('status', 'cancelled')
      .order('start_time', { ascending: true }),
    supabaseAdmin
      .from('bookings')
      .select('*, student:students(full_name, order_number)')
      .eq('instructor_id', user.id)
      .in('practice_date', next7)
      .neq('status', 'cancelled')
      .order('practice_date', { ascending: true })
      .order('start_time', { ascending: true }),
  ])

  if (todayError) return NextResponse.json({ error: todayError.message }, { status: 500 })
  if (upcomingError) return NextResponse.json({ error: upcomingError.message }, { status: 500 })

  return NextResponse.json({
    id: user.id,
    name: user.name,
    today: todayData ?? [],
    upcoming: upcomingData ?? [],
  })
}
