import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const active = searchParams.get('active') !== 'false'

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  let query = supabaseAdmin
    .from('students')
    .select('*, instructor:instructors(name)')
    .eq('is_active', active)
    .order('order_number', { ascending: true })

  // Un instructor solo ve sus propios alumnos asignados; admin y secretary ven todos
  if (user.role === 'instructor') {
    query = query.eq('instructor_id', user.id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ students: data })
}
