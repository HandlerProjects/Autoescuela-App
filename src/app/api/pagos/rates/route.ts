import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser, isAdminOrSecretary } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!isAdminOrSecretary(user)) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const { rates } = await req.json()
  if (!rates || typeof rates !== 'object') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  for (const [concept, price] of Object.entries(rates)) {
    const numPrice = price ? parseFloat(price as string) : null
    const { error } = await supabaseAdmin.from('rates').upsert({
      instructor_id: user.id,
      concept,
      price: numPrice,
    }, { onConflict: 'instructor_id,concept' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
