import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json()

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Nombre, email y contraseña son obligatorios' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  })

  if (authError) {
    const msg = authError.message.includes('already registered')
      ? 'Ya existe un usuario con ese email'
      : authError.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const { error: dbError } = await supabaseAdmin.from('instructors').insert({
    id: authData.user.id,
    email,
    name,
  })

  if (dbError) {
    console.error('Error creando instructor en DB:', dbError)
  }

  return NextResponse.json({ ok: true })
}
