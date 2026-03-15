import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

function getTomorrowDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function formatDateEs(dateStr: string): string {
  const [y, m, day] = dateStr.split('-')
  return `${day}/${m}/${y}`
}

function getDayNameEs(dateStr: string): string {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  return days[new Date(dateStr + 'T00:00:00').getDay()]
}

function getPracticeLabel(type: string, subtype: string | null): string {
  if (type === 'car') return 'Coche'
  if (subtype === 'pista') return 'Camión Pista'
  if (subtype === 'circulacion') return 'Camión Circulación'
  return 'Camión'
}

function buildEmail(studentName: string, date: string, time: string, practiceLabel: string, token: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://autoescuela-app.vercel.app'
  const bookingUrl = `${appUrl}/s/${token}`

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

        <!-- Header azul -->
        <tr>
          <td style="background:#0057B8;padding:32px 40px">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:rgba(255,255,255,0.15);border-radius:12px;padding:10px 14px;margin-right:12px">
                  <span style="font-size:24px">🚗</span>
                </td>
                <td style="padding-left:14px">
                  <p style="margin:0;color:#ffffff;font-size:18px;font-weight:900;letter-spacing:-0.3px">AUTO-ESCUELA BAHILLO</p>
                  <p style="margin:0;color:rgba(255,255,255,0.7);font-size:13px">Palencia</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Cuerpo -->
        <tr>
          <td style="padding:36px 40px">
            <p style="margin:0 0 8px;color:#0057B8;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Recordatorio de práctica</p>
            <h1 style="margin:0 0 24px;color:#0a0f1a;font-size:24px;font-weight:900">Hola, ${studentName}</h1>
            <p style="margin:0 0 28px;color:#4a6080;font-size:15px;line-height:1.6">
              Te recordamos que mañana tienes una práctica de conducción confirmada.
            </p>

            <!-- Tarjeta de reserva -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7fafd;border:1.5px solid #dce8f5;border-radius:12px;margin-bottom:28px">
              <tr><td style="padding:24px">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom:14px;border-bottom:1px solid #dce8f5">
                      <p style="margin:0;color:#6b8ab0;font-size:11px;font-weight:600;text-transform:uppercase">Día</p>
                      <p style="margin:4px 0 0;color:#0a0f1a;font-size:16px;font-weight:800">${getDayNameEs(date)}, ${formatDateEs(date)}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 0;border-bottom:1px solid #dce8f5">
                      <p style="margin:0;color:#6b8ab0;font-size:11px;font-weight:600;text-transform:uppercase">Hora</p>
                      <p style="margin:4px 0 0;color:#0a0f1a;font-size:16px;font-weight:800">${time}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:14px">
                      <p style="margin:0;color:#6b8ab0;font-size:11px;font-weight:600;text-transform:uppercase">Tipo de práctica</p>
                      <p style="margin:4px 0 0;color:#0a0f1a;font-size:16px;font-weight:800">${practiceLabel}</p>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <!-- Botón -->
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr><td align="center">
                <a href="${bookingUrl}" style="display:inline-block;background:#0057B8;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px">
                  Ver mi reserva
                </a>
              </td></tr>
            </table>

            <p style="margin:28px 0 0;color:#9ab0c8;font-size:12px;text-align:center;line-height:1.6">
              Si no puedes asistir, cancela con más de 24 horas de antelación<br>para que no cuente como práctica realizada.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f7fafd;padding:20px 40px;border-top:1px solid #dce8f5">
            <p style="margin:0;color:#9ab0c8;font-size:12px;text-align:center">
              Auto-Escuela Bahillo · Palencia<br>
              Este mensaje es un recordatorio automático.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function GET(req: NextRequest) {
  // Verificar el token secreto de Vercel Cron
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const tomorrow = getTomorrowDate()

  // Buscar reservas confirmadas de mañana con email del alumno
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, start_time, practice_type, practice_subtype, student:students(full_name, email, token)')
    .eq('practice_date', tomorrow)
    .eq('status', 'confirmed')

  if (error) {
    console.error('Cron reminders error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No hay reservas mañana' })
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'recordatorios@autoescuela-bahillo.es'
  let sent = 0

  for (const booking of bookings) {
    const student = booking.student as { full_name: string; email: string | null; token: string } | null
    if (!student?.email) continue

    const time = booking.start_time.substring(0, 5)
    const label = getPracticeLabel(booking.practice_type, booking.practice_subtype)
    const html = buildEmail(student.full_name, tomorrow, time, label, student.token)

    try {
      await resend.emails.send({
        from: fromEmail,
        to: student.email,
        subject: `Recordatorio: práctica de ${label} mañana a las ${time}`,
        html,
      })
      sent++
    } catch (err) {
      console.error(`Error enviando email a ${student.email}:`, err)
    }
  }

  return NextResponse.json({ sent, total: bookings.length })
}
