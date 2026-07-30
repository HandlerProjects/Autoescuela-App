import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser, isAdminOrSecretary } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!isAdminOrSecretary(user)) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const { id, instructorId } = await req.json()
  if (!id) {
    return NextResponse.json({ error: 'id es obligatorio' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  if (instructorId) {
    const { data: instructorExists } = await supabaseAdmin
      .from('instructors')
      .select('id')
      .eq('id', instructorId)
      .single()

    if (!instructorExists) {
      return NextResponse.json({ error: 'El instructor indicado no existe' }, { status: 400 })
    }
  }

  // Sin `.is('instructor_id', null)`: a diferencia de tablon/claim, esta ruta
  // existe precisamente para sobrescribir un instructor ya asignado.
  const { error } = await supabaseAdmin
    .from('students')
    .update({ instructor_id: instructorId ?? null })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let instructorName: string | null = null
  if (instructorId) {
    const { data: instructor } = await supabaseAdmin
      .from('instructors')
      .select('name')
      .eq('id', instructorId)
      .single()
    instructorName = instructor?.name ?? null
  }

  return NextResponse.json({ ok: true, instructorName })
}
