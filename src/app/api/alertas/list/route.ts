import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/auth'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  let studentsQuery = supabaseAdmin.from('students').select('*').eq('is_active', true)
  let bookingsQuery = supabaseAdmin.from('bookings').select('*').neq('status', 'cancelled').order('practice_date', { ascending: false })
  let noShowQuery = supabaseAdmin
    .from('bookings')
    .select('*, student:students(full_name, order_number)')
    .eq('no_show', true)
    .gte('practice_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])

  // Un instructor solo ve alertas de sus propios alumnos
  if (user.role === 'instructor') {
    studentsQuery = studentsQuery.eq('instructor_id', user.id)
    bookingsQuery = bookingsQuery.eq('instructor_id', user.id)
    noShowQuery = noShowQuery.eq('instructor_id', user.id)
  }

  const [{ data: students, error: studentsError }, { data: bookings, error: bookingsError }, { data: noShowData, error: noShowError }] =
    await Promise.all([studentsQuery, bookingsQuery, noShowQuery])

  if (studentsError) return NextResponse.json({ error: studentsError.message }, { status: 500 })
  if (bookingsError) return NextResponse.json({ error: bookingsError.message }, { status: 500 })
  if (noShowError) return NextResponse.json({ error: noShowError.message }, { status: 500 })

  return NextResponse.json({ students, bookings, noShows: noShowData })
}
