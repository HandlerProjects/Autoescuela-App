import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/auth'

// Identidad + lista de alumnos propios en una sola llamada — antes eran 2 saltos
// de red seguidos (auth.me, luego la consulta a students).
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (user.role !== 'instructor') return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await supabaseAdmin
    .from('students')
    .select('*')
    .eq('instructor_id', user.id)
    .eq('is_active', true)
    .order('order_number', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: user.id, students: data ?? [] })
}
