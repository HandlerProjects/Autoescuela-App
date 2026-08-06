import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { APP_URL, FROM_EMAIL, emailWrapper, ctaButton } from '@/lib/email'
import { getSessionUser, isAdminOrInstructor } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ sent: false, error: 'No autorizado' }, { status: 401 })
  if (!isAdminOrInstructor(user)) return NextResponse.json({ sent: false, error: 'Prohibido' }, { status: 403 })

  const { studentId, instructorName } = await req.json()
  if (!studentId || !instructorName) return NextResponse.json({ sent: false })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: student } = await supabase
    .from('students')
    .select('full_name, email, token')
    .eq('id', studentId)
    .single()

  if (!student?.email) return NextResponse.json({ sent: false, reason: 'no email' })

  const firstName = student.full_name.split(' ')[0]
  const bookingUrl = `${APP_URL}/s/${student.token}`

  const content = `
    <p style="margin:0 0 6px;color:#0057B8;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Ya tienes profesor</p>
    <h1 style="margin:0 0 16px;color:#0a0f1a;font-size:23px;font-weight:900">¡Hola, ${firstName}!</h1>
    <p style="margin:0 0 8px;color:#4a6080;font-size:15px;line-height:1.7">
      <strong>${instructorName}</strong> te ha elegido como alumno en Auto-Escuela Bahillo.
    </p>
    <p style="margin:0 0 28px;color:#4a6080;font-size:15px;line-height:1.7">
      Ya puedes entrar a tu panel y reservar tu primera práctica. ¡El carnet está más cerca de lo que crees, vamos a ello!
    </p>
    ${ctaButton(bookingUrl, 'Reservar mi primera práctica →')}
  `

  const html = emailWrapper(content, { url: bookingUrl, label: 'Ver mi panel' })

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: student.email,
      subject: `${instructorName} te ha elegido · Auto-Escuela Bahillo`,
      html,
    })
    return NextResponse.json({ sent: true })
  } catch (err) {
    console.error('Error notify-claimed:', err)
    return NextResponse.json({ sent: false })
  }
}
