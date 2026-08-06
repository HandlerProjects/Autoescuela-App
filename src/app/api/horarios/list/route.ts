import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/auth'

// Horarios especiales de un profesor en un rango de fechas (un mes, tal como los pinta el
// calendario de Festivos y horarios).
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const requested = searchParams.get('instructorId')
  if (!from || !to) return NextResponse.json({ error: 'from y to son obligatorios' }, { status: 400 })

  // Un profesor solo ve su propio horario; se ignora cualquier instructorId que llegue por query.
  const instructorId = user.role === 'instructor' ? user.id : requested
  if (!instructorId) return NextResponse.json({ error: 'Falta el profesor' }, { status: 400 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await supabaseAdmin
    .from('schedule_overrides')
    .select('id, date, sessions, break_minutes, reason')
    .eq('instructor_id', instructorId)
    .gte('date', from)
    .lte('date', to)
    .order('date')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ overrides: data ?? [] })
}
