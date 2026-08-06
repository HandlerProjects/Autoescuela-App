import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getSessionUser, isAdminOrInstructor, isAdmin } from '@/lib/auth'
import {
  APP_URL, FROM_EMAIL,
  emailWrapper, infoCard, infoRow, ctaButton,
  formatDateEs, getDayNameEs, getPracticeLabel,
} from '@/lib/email'

function buildCancelEmail(
  studentName: string,
  date: string,
  time: string,
  practiceLabel: string,
  reason: string | null,
  token: string
): string {
  const bookingUrl = `${APP_URL}/s/${token}`
  const firstName = studentName.split(' ')[0]

  const rows =
    infoRow('Día cancelado', `${getDayNameEs(date)}, ${formatDateEs(date)}`, '#fca5a5') +
    infoRow('Hora', time, '#fca5a5') +
    infoRow('Tipo de práctica', practiceLabel, '#fca5a5', true)

  const reasonBlock = reason
    ? `<p style="margin:0 0 24px;color:#4a6080;font-size:14px;line-height:1.6"><strong>Motivo:</strong> <em>${reason}</em></p>`
    : ''

  const content = `
    <p style="margin:0 0 6px;color:#dc2626;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Práctica cancelada</p>
    <h1 style="margin:0 0 16px;color:#0a0f1a;font-size:23px;font-weight:900">Hola, ${firstName}</h1>
    <p style="margin:0 0 20px;color:#4a6080;font-size:15px;line-height:1.7">
      Tu práctica del <strong>${getDayNameEs(date)} ${formatDateEs(date)}</strong> a las <strong>${time}</strong> ha sido cancelada por el profesor.
      Lamentamos los inconvenientes.
    </p>
    ${reasonBlock}
    ${infoCard(rows, '#fef2f2', '#fca5a5')}
    <p style="margin:0 0 20px;color:#4a6080;font-size:14px;line-height:1.6">
      Puedes reservar otro hueco disponible desde tu panel:
    </p>
    ${ctaButton(bookingUrl, 'Ver huecos disponibles →')}
  `

  return emailWrapper(content, { url: bookingUrl, label: 'Ver mis reservas' }, '#dc2626')
}

export async function POST(req: NextRequest) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!isAdminOrInstructor(sessionUser)) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const { instructorId: bodyInstructorId, date, startTime, endTime, reason } = await req.json()

  // Profesores solo pueden cancelar sus propios huecos; admin puede especificar cualquier instructor
  const instructorId = isAdmin(sessionUser) ? bodyInstructorId : sessionUser.id

  if (!instructorId || !date || !startTime || !endTime) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, start_time, practice_type, practice_subtype, student:students(full_name, email, token)')
    .eq('instructor_id', instructorId)
    .eq('practice_date', date)
    .eq('status', 'confirmed')
    .gte('start_time', startTime)
    .lt('start_time', endTime)

  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ cancelled: 0, reason: 'No bookings in range' })
  }

  const ids = bookings.map(b => b.id)
  await supabase.from('bookings').update({ status: 'cancelled' }).in('id', ids)

  const resend = new Resend(process.env.RESEND_API_KEY)
  let sent = 0

  for (const booking of bookings) {
    const student = booking.student as unknown as { full_name: string; email: string | null; token: string } | null
    if (!student?.email) continue

    const time = booking.start_time.substring(0, 5)
    const label = getPracticeLabel(booking.practice_type, booking.practice_subtype ?? null)
    const html = buildCancelEmail(student.full_name, date, time, label, reason ?? null, student.token)

    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: student.email,
        subject: `Práctica cancelada · ${getDayNameEs(date)} ${formatDateEs(date)} a las ${time}`,
        html,
      })
      sent++
    } catch (err) {
      console.error(`Error notificando cancelación a ${student.email}:`, err)
    }
  }

  return NextResponse.json({ cancelled: bookings.length, notified: sent })
}
