import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser, isAdmin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  if (id === user.id) {
    return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 })
  }

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

  if (targetError || !target) {
    return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  }

  if (target.role === 'admin') {
    const { count } = await supabaseAdmin
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('is_active', true)
      .neq('id', id)

    if (!count) {
      return NextResponse.json(
        { error: 'No puede quedar la autoescuela sin ningún admin activo' },
        { status: 400 }
      )
    }
  }

  // Borrar de instructors si existe (puede no haber fila si nunca fue instructor)
  await supabaseAdmin.from('instructors').delete().eq('id', id)

  await supabaseAdmin.from('staff').delete().eq('id', id)

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
