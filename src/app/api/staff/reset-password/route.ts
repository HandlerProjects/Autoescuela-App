import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getSessionUser, isAdmin } from '@/lib/auth'
import { FROM_EMAIL, generatePassword, buildCredentialsEmail, type StaffRole } from '@/lib/email'

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id es obligatorio' }, { status: 400 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: staff, error: staffError } = await supabaseAdmin
    .from('staff')
    .select('id, name, email, role')
    .eq('id', id)
    .single()

  if (staffError || !staff) {
    return NextResponse.json({ error: 'No se encontró ese miembro del equipo' }, { status: 404 })
  }

  const password = generatePassword()

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(id, {
    password,
    user_metadata: { full_name: staff.name, must_change_password: true },
  })

  if (updateError) {
    return NextResponse.json({ error: 'No se pudo restablecer la contraseña: ' + updateError.message }, { status: 500 })
  }

  // Si el envío falla, devolvemos la contraseña en la respuesta como red de seguridad —
  // si no, el admin no tendría ninguna forma de saber las credenciales nuevas.
  let emailSent = true
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM_EMAIL,
      to: staff.email,
      subject: 'Tu contraseña se ha restablecido · Auto-Escuela Bahillo',
      html: buildCredentialsEmail(staff.name, staff.email, password, staff.role as StaffRole, true),
    })
  } catch (err) {
    console.error('Error enviando email de restablecimiento:', err)
    emailSent = false
  }

  return NextResponse.json({ ok: true, emailSent, password: emailSent ? undefined : password })
}
