import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getSessionUser, isAdmin } from '@/lib/auth'
import { FROM_EMAIL, generatePassword, buildCredentialsEmail, type StaffRole } from '@/lib/email'

const VALID_ROLES: StaffRole[] = ['admin', 'instructor', 'secretary']

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const { name, email, role } = await req.json()

  if (!name || !email) {
    return NextResponse.json({ error: 'Nombre y email son obligatorios' }, { status: 400 })
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'El formato del email no es válido' }, { status: 400 })
  }

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'El rol no es válido' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const password = generatePassword()

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name, must_change_password: true },
  })

  if (authError) {
    const msg = authError.message.includes('already registered')
      ? 'Ya existe un usuario con ese email'
      : authError.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  if (role === 'instructor') {
    const { error: instructorError } = await supabaseAdmin.from('instructors').insert({
      id: authData.user.id,
      email,
      name,
    })

    if (instructorError) {
      console.error('Error creando instructor en DB:', instructorError)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: 'No se pudo guardar el instructor: ' + instructorError.message },
        { status: 500 }
      )
    }
  }

  const { error: staffError } = await supabaseAdmin.from('staff').insert({
    id: authData.user.id,
    email,
    name,
    role,
    is_active: true,
  })

  if (staffError) {
    console.error('Error añadiendo a staff:', staffError)
    if (role === 'instructor') await supabaseAdmin.from('instructors').delete().eq('id', authData.user.id)
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json(
      { error: 'No se pudo guardar en el equipo: ' + staffError.message },
      { status: 500 }
    )
  }

  // Si el envío falla, devolvemos la contraseña en la respuesta como red de seguridad —
  // si no, el admin no tendría ninguna forma de saber las credenciales reales.
  let emailSent = true
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Tus credenciales de acceso · Auto-Escuela Bahillo',
      html: buildCredentialsEmail(name, email, password, role),
    })
  } catch (err) {
    console.error('Error enviando email de bienvenida:', err)
    emailSent = false
  }

  return NextResponse.json({ ok: true, emailSent, password: emailSent ? undefined : password })
}
