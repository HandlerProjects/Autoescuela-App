import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser, isAdmin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const { id, is_active } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  if (!is_active) {
    const { data: target } = await supabaseAdmin
      .from('staff')
      .select('role')
      .eq('id', id)
      .single()

    if (target?.role === 'admin') {
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
  }

  await supabaseAdmin.from('staff').update({ is_active }).eq('id', id)

  // Si se desactiva, bloquear también el acceso en auth
  if (!is_active) {
    await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: '87600h' })
  } else {
    await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: 'none' })
  }

  return NextResponse.json({ ok: true })
}
