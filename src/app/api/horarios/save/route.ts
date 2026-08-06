import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getSessionUser } from '@/lib/auth'
import { toMinutes, type Session } from '@/lib/horarios'
import {
  FROM_EMAIL,
  buildPracticeCancelledEmail,
  formatDateEs, getDayNameEs, getPracticeLabel,
} from '@/lib/email'

// Guarda (o borra) el horario especial de un profesor para un día concreto.
//
// Se hace en dos pasos a propósito. La primera llamada, sin `confirm`, NO escribe nada: devuelve
// las clases que quedarían fuera del nuevo horario para que la pantalla las enseñe. Solo cuando
// el profesor ha visto qué pierde y acepta, la segunda llamada guarda y las cancela.
// Nunca se borra una clase sin que alguien la haya visto: un alumno no puede perder su práctica
// porque su profesor tocó un horario sin darse cuenta.

interface AffectedBooking {
  id: string
  start_time: string
  end_time: string
  practice_type: string
  practice_subtype: string | null
  student: { full_name: string; email: string | null; token: string } | null
}

function isInsideSessions(startTime: string, endTime: string, sessions: Session[]): boolean {
  const start = toMinutes(startTime)
  const end = toMinutes(endTime)
  // La clase entera tiene que caber dentro de una franja: si empieza dentro pero acaba fuera,
  // el profesor ya no está.
  return sessions.some(s => toMinutes(s.start) <= start && end <= toMinutes(s.end))
}

function validSessions(raw: unknown): raw is Session[] {
  if (!Array.isArray(raw) || raw.length === 0) return false
  return raw.every(s =>
    s && typeof s.start === 'string' && typeof s.end === 'string' &&
    /^\d{2}:\d{2}$/.test(s.start) && /^\d{2}:\d{2}$/.test(s.end) &&
    toMinutes(s.start) < toMinutes(s.end)
  )
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { date, sessions, breakMinutes, reason, confirm, remove } = body

  // Un profesor solo cambia su propio horario; admin y secretaría el de cualquiera.
  const instructorId = user.role === 'instructor' ? user.id : body.instructorId
  if (!instructorId || !date) {
    return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // ── Quitar el horario especial: se vuelve al horario de siempre ──
  // Volver al horario normal solo puede ampliar la jornada respecto al especial, así que no deja
  // clases fuera y no necesita confirmación.
  if (remove) {
    const { error } = await supabaseAdmin
      .from('schedule_overrides')
      .delete()
      .eq('instructor_id', instructorId)
      .eq('date', date)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, removed: true })
  }

  if (!validSessions(sessions)) {
    return NextResponse.json({ error: 'Las franjas no son válidas: revisa que la hora de fin sea posterior a la de inicio.' }, { status: 400 })
  }

  // Franjas ordenadas y sin solaparse entre sí.
  const ordered = [...sessions].sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
  for (let i = 1; i < ordered.length; i++) {
    if (toMinutes(ordered[i].start) < toMinutes(ordered[i - 1].end)) {
      return NextResponse.json({ error: 'Hay dos franjas que se pisan entre sí.' }, { status: 400 })
    }
  }

  const { data: bookings, error: bookingsError } = await supabaseAdmin
    .from('bookings')
    .select('id, start_time, end_time, practice_type, practice_subtype, student:students(full_name, email, token)')
    .eq('instructor_id', instructorId)
    .eq('practice_date', date)
    .eq('status', 'confirmed')
    .order('start_time')

  if (bookingsError) return NextResponse.json({ error: bookingsError.message }, { status: 500 })

  const affected = ((bookings ?? []) as unknown as AffectedBooking[])
    .filter(b => !isInsideSessions(b.start_time, b.end_time, ordered))

  // ── Paso 1: solo mirar. No se escribe nada ──
  if (!confirm) {
    return NextResponse.json({
      preview: true,
      affected: affected.map(b => ({
        id: b.id,
        time: b.start_time.substring(0, 5),
        endTime: b.end_time.substring(0, 5),
        studentName: b.student?.full_name ?? '—',
        practiceLabel: getPracticeLabel(b.practice_type as never, b.practice_subtype as never),
      })),
    })
  }

  // ── Paso 2: guardar ──
  const { error: upsertError } = await supabaseAdmin
    .from('schedule_overrides')
    .upsert({
      instructor_id: instructorId,
      date,
      sessions: ordered,
      break_minutes: breakMinutes ?? null,
      reason: reason ?? null,
    }, { onConflict: 'instructor_id,date' })

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })

  if (affected.length === 0) {
    return NextResponse.json({ ok: true, cancelled: 0, notified: 0 })
  }

  // Las clases que quedan fuera se cancelan SIN marcar no_show: el alumno no ha faltado, se le ha
  // cambiado el horario. Al pasar a 'cancelled' deja de gastar saldo del bono, así que recupera
  // su práctica automáticamente.
  const { error: cancelError } = await supabaseAdmin
    .from('bookings')
    .update({ status: 'cancelled', no_show: false })
    .in('id', affected.map(b => b.id))

  if (cancelError) return NextResponse.json({ error: cancelError.message }, { status: 500 })

  let notified = 0
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    for (const b of affected) {
      if (!b.student?.email) continue
      const time = b.start_time.substring(0, 5)
      const label = getPracticeLabel(b.practice_type as never, b.practice_subtype as never)
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: b.student.email,
          subject: `Práctica cancelada · ${getDayNameEs(date)} ${formatDateEs(date)} a las ${time}`,
          html: buildPracticeCancelledEmail(
            b.student.full_name, date, time, label,
            reason ?? 'Cambio de horario del profesor',
            b.student.token,
          ),
        })
        notified++
      } catch (err) {
        // Un email que falla no debe dejar el horario a medio guardar.
        console.error(`Error notificando cancelación a ${b.student.email}:`, err)
      }
    }
  }

  return NextResponse.json({ ok: true, cancelled: affected.length, notified })
}
