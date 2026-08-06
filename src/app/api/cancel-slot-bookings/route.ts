import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getSessionUser, isAdminOrInstructor, isAdmin } from '@/lib/auth'
import {
  FROM_EMAIL,
  buildPracticeCancelledEmail,
  formatDateEs, getDayNameEs, getPracticeLabel,
} from '@/lib/email'

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
    const html = buildPracticeCancelledEmail(student.full_name, date, time, label, reason ?? null, student.token)

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
