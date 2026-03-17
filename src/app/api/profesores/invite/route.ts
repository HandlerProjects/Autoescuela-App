import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const { name, email } = await req.json()

  if (!name || !email) {
    return NextResponse.json({ error: 'Nombre y email son obligatorios' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://autoescuela-app.vercel.app'

  // Invitar al usuario vía Supabase Auth (envía email de invitación automáticamente)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: name },
    redirectTo: `${appUrl}/auth/callback`,
  })

  if (authError) {
    const msg = authError.message.includes('already registered')
      ? 'Ya existe un usuario con ese email'
      : authError.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // Crear la fila en la tabla instructors
  const { error: dbError } = await supabaseAdmin.from('instructors').insert({
    id: authData.user.id,
    email,
    name,
  })

  if (dbError) {
    console.error('Error creando instructor en DB:', dbError)
    // No devolvemos error al usuario porque el invite ya se envió
  }

  return NextResponse.json({ ok: true })
}
