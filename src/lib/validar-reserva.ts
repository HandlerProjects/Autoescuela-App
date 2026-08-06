import type { SupabaseClient } from '@supabase/supabase-js'
import { generateTimeSlots, getDuration } from '@/lib/utils'
import { getSessionsForDay, getBreakForDay, getSlotBreakMinutes, isSlotOccupied, toTimeString, toMinutes } from '@/lib/horarios'
import type { PracticeType, PracticeSubtype } from '@/types'

// Validación de un hueco contra el estado real de la agenda, en servidor.
//
// Hasta ahora la única defensa contra una reserva imposible era que la pantalla solo ofrecía
// horas buenas: /api/booking/create comprobaba ventana, cupos y saldo, pero no el horario del
// profesor ni si el hueco pisaba otra clase. Con una pantalla abierta desde antes de un cambio
// de horario —o con cualquier petición hecha a mano— entraban reservas fuera de jornada o
// solapadas, que es el error más caro que puede tener esta aplicación.

export interface SlotRequest {
  instructorId: string
  date: string
  startTime: string
  practiceType: PracticeType
  practiceSubtype: PracticeSubtype | null
  /** Reserva que se está moviendo, para que no choque consigo misma. */
  ignoreBookingId?: string
}

export type SlotValidation =
  | { ok: true; endTime: string }
  | { ok: false; error: string; status: number }

/**
 * Comprueba que el hueco existe de verdad en la agenda del profesor: día no bloqueado, hora
 * dentro de su jornada y sin pisar ninguna otra clase ni franja bloqueada.
 *
 * Requiere un cliente con service role — necesita ver las reservas de TODOS los alumnos del
 * profesor, no solo las del que reserva.
 */
export async function validateSlot(
  supabaseAdmin: SupabaseClient,
  req: SlotRequest
): Promise<SlotValidation> {
  const { instructorId, date, startTime, practiceType, practiceSubtype, ignoreBookingId } = req

  const [{ data: instructor }, { data: blockedDay }, { data: blockedSlots }, { data: bookings }, { data: override }] =
    await Promise.all([
      supabaseAdmin
        .from('instructors')
        .select('schedule_morning, schedule_afternoon, morning_start, morning_end, afternoon_start, afternoon_end, break_minutes, practice_types')
        .eq('id', instructorId)
        .single(),
      supabaseAdmin
        .from('blocked_days')
        .select('reason')
        .eq('instructor_id', instructorId)
        .eq('date', date)
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('blocked_slots')
        .select('start_time, end_time')
        .eq('instructor_id', instructorId)
        .eq('date', date),
      supabaseAdmin
        .from('bookings')
        .select('id, start_time, practice_type, practice_subtype')
        .eq('instructor_id', instructorId)
        .eq('practice_date', date)
        .neq('status', 'cancelled'),
      // Horario especial de ese día, si lo hay: manda sobre el horario habitual.
      supabaseAdmin
        .from('schedule_overrides')
        .select('date, sessions, break_minutes')
        .eq('instructor_id', instructorId)
        .eq('date', date)
        .limit(1)
        .maybeSingle(),
    ])

  if (!instructor) {
    return { ok: false, error: 'El profesor no existe o ya no está disponible.', status: 404 }
  }

  if (blockedDay) {
    return { ok: false, error: 'Este día está bloqueado. El profesor no está disponible.', status: 409 }
  }

  // El profesor tiene que impartir ese tipo de práctica.
  const types: PracticeType[] = instructor.practice_types ?? ['car']
  if (!types.includes(practiceType)) {
    return { ok: false, error: 'Este profesor no imparte ese tipo de práctica.', status: 409 }
  }

  // La hora tiene que ser una de las de su rejilla de ESE día: si hay horario especial manda él,
  // y si no el habitual. Mismas franjas y mismo descanso que ve el alumno en pantalla, así el
  // servidor y la pantalla no pueden discrepar sobre qué horas existen.
  const breakMins = getBreakForDay(instructor as never, override as never)
  const sessions = getSessionsForDay(instructor as never, override as never)
  const validStarts = generateTimeSlots(practiceType, practiceSubtype, sessions, breakMins)

  if (!validStarts.includes(startTime.substring(0, 5))) {
    return {
      ok: false,
      error: 'Esa hora ya no está dentro del horario del profesor. Vuelve a cargar y elige otra.',
      status: 409,
    }
  }

  const otherBookings = (bookings ?? [])
    .filter(b => b.id !== ignoreBookingId)
    .map(b => ({
      start_time: b.start_time,
      practice_type: b.practice_type as PracticeType,
      practice_subtype: b.practice_subtype as PracticeSubtype | null,
    }))

  const occupied = isSlotOccupied(
    startTime,
    practiceType,
    practiceSubtype,
    breakMins,
    otherBookings,
    (blockedSlots ?? []).map(b => ({ start_time: b.start_time, end_time: b.end_time })),
  )

  if (occupied) {
    return { ok: false, error: 'Ese hueco acaba de ocuparse. Elige otro.', status: 409 }
  }

  // La hora de fin es la de la clase, sin el descanso: el descanso bloquea la agenda pero no
  // forma parte de la práctica del alumno.
  const endTime = toTimeString(toMinutes(startTime) + getDuration(practiceType, practiceSubtype))

  return { ok: true, endTime }
}

/** Fin de una práctica a partir de su inicio, sin contar el descanso posterior. */
export function getEndTime(
  startTime: string,
  practiceType: PracticeType,
  practiceSubtype: PracticeSubtype | null
): string {
  return toTimeString(toMinutes(startTime) + getDuration(practiceType, practiceSubtype))
}

/** Reexportado por comodidad de las rutas que solo necesitan el descanso. */
export { getSlotBreakMinutes }
