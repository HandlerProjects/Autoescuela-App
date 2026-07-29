import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { Resend } from 'resend'
import { getSessionUser, isAdmin } from '@/lib/auth'
import { APP_URL, FROM_EMAIL, emailWrapper, infoCard, infoRow, ctaButton } from '@/lib/email'

type StaffRole = 'admin' | 'instructor' | 'secretary'

const VALID_ROLES: StaffRole[] = ['admin', 'instructor', 'secretary']

const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'administrador',
  instructor: 'instructor',
  secretary: 'secretaria',
}

function generatePassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return [4, 4, 4]
    .map(len => Array.from(randomBytes(len)).map(b => chars[b % chars.length]).join(''))
    .join('-')
}

function buildWelcomeEmail(name: string, email: string, password: string, role: StaffRole): string {
  const firstName = name.split(' ')[0]
  const roleLabel = ROLE_LABELS[role]

  const rows =
    infoRow('Tu email de acceso', email, '#dce8f5') +
    infoRow('Tu contraseña temporal', password, '#dce8f5', true)

  const content = `
    <p style="margin:0 0 6px;color:#0057B8;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Bienvenido/a al equipo</p>
    <h1 style="margin:0 0 16px;color:#0a0f1a;font-size:23px;font-weight:900">Hola, ${firstName}</h1>
    <p style="margin:0 0 24px;color:#4a6080;font-size:15px;line-height:1.7">
      Tu cuenta de <strong>${roleLabel}</strong> en <strong>Auto-Escuela Bahillo</strong> ha sido creada.
      Aquí tienes tus credenciales de acceso:
    </p>
    ${infoCard(rows, '#f0f6ff', '#dce8f5')}
    ${ctaButton(APP_URL, 'Acceder al panel →')}
    <p style="margin:20px 0 0;color:#9ab0c8;font-size:12px;text-align:center;line-height:1.6">
      Por seguridad, se te pedirá que establezcas una nueva contraseña la primera vez que entres.
    </p>
  `

  return emailWrapper(content)
}

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
      return NextResponse.json(
        { error: 'Usuario creado pero error al guardar en BD: ' + instructorError.message },
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
    return NextResponse.json(
      { error: 'Usuario creado pero error al guardar en BD: ' + staffError.message },
      { status: 500 }
    )
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Tus credenciales de acceso · Auto-Escuela Bahillo',
      html: buildWelcomeEmail(name, email, password, role),
    })
  } catch (err) {
    console.error('Error enviando email de bienvenida:', err)
  }

  return NextResponse.json({ ok: true })
}
