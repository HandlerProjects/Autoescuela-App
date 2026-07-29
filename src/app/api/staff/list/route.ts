import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser, isAdmin } from '@/lib/auth'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await supabaseAdmin
    .from('staff')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: instructorsData, error: instructorsError } = await supabaseAdmin
    .from('instructors')
    .select('*')

  if (instructorsError) return NextResponse.json({ error: instructorsError.message }, { status: 500 })

  const instructorsById = Object.fromEntries(
    (instructorsData ?? []).map(inst => [inst.id, inst])
  )

  const staff = (data ?? []).map(member => ({
    ...member,
    instructor: member.role === 'instructor' ? (instructorsById[member.id] ?? null) : null,
  }))

  return NextResponse.json({ staff })
}
