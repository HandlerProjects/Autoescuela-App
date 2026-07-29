import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser, isAdminOrSecretary } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!isAdminOrSecretary(user)) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const { student_id, amount, concept, due_date, notes } = await req.json()
  if (!student_id || !amount || !concept) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await supabaseAdmin.from('payments').insert({
    student_id,
    instructor_id: user.id,
    amount: parseFloat(amount),
    concept,
    status: 'pending',
    due_date: due_date || null,
    notes: notes?.trim() || null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
