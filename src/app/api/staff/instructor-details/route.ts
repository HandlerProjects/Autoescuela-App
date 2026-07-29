import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser, isAdmin } from '@/lib/auth'

const EDITABLE_FIELDS = [
  'practice_types',
  'milestone_counts',
  'notes',
  'jornada',
  'schedule_morning',
  'morning_start',
  'morning_end',
  'schedule_afternoon',
  'afternoon_start',
  'afternoon_end',
  'break_minutes',
] as const

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const body = await req.json()
  const { id } = body

  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: target, error: targetError } = await supabaseAdmin
    .from('staff')
    .select('role')
    .eq('id', id)
    .single()

  if (targetError || !target || target.role !== 'instructor') {
    return NextResponse.json({ error: 'El miembro no es un instructor' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}
  for (const field of EDITABLE_FIELDS) {
    if (field in body) updates[field] = body[field]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  const { error: updateError } = await supabaseAdmin
    .from('instructors')
    .update(updates)
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
