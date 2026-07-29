import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser, isAdmin } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  // El cuadrante compara horas entre instructores: solo tiene sentido para admin
  if (!isAdmin(user)) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'from y to son obligatorios' }, { status: 400 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [{ data: instructorsData, error: instructorsError }, { data: bookingsData, error: bookingsError }] = await Promise.all([
    supabaseAdmin.from('instructors').select('*').order('created_at', { ascending: true }),
    supabaseAdmin
      .from('bookings')
      .select('instructor_id, practice_date, practice_type, practice_subtype, status')
      .gte('practice_date', from)
      .lte('practice_date', to)
      .neq('status', 'cancelled'),
  ])

  if (instructorsError) return NextResponse.json({ error: instructorsError.message }, { status: 500 })
  if (bookingsError) return NextResponse.json({ error: bookingsError.message }, { status: 500 })

  return NextResponse.json({ instructors: instructorsData, bookings: bookingsData })
}
