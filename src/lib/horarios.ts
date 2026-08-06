import { getDuration } from '@/lib/utils'
import type { Instructor, PracticeType, PracticeSubtype } from '@/types'

// Cálculo de las horas de trabajo de un profesor — fuente única.
//
// Hasta ahora esto vivía duplicado: la pantalla del alumno usaba el horario real del profesor y
// el calendario del panel usaba el genérico 08:00–13:30 / 16:00–19:15, así que las dos pantallas
// enseñaban huecos distintos para el mismo día. Mismo patrón que lib/bono.ts: si dos sitios
// calculan la misma regla por su cuenta, acaban discrepando.

/** Horario de referencia cuando aún no se conoce el del profesor. */
export const DEFAULT_SESSIONS: Session[] = [
  { start: '08:00', end: '13:30' },
  { start: '16:00', end: '19:15' },
]

export interface Session {
  start: string
  end: string
}

/** "HH:MM" → minutos desde medianoche. */
export function toMinutes(time: string): number {
  const [h, m] = time.substring(0, 5).split(':').map(Number)
  return h * 60 + m
}

/** Minutos desde medianoche → "HH:MM". */
export function toTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Franjas de trabajo de un profesor.
 *
 * Devuelve una lista porque el motor de huecos admite cualquier número de tramos, no solo
 * mañana y tarde — es lo que permitirá los horarios especiales por día sin tocar el generador.
 */
export function getInstructorSessions(instructor: Instructor | null | undefined): Session[] {
  if (!instructor) return DEFAULT_SESSIONS

  const sessions: Session[] = []
  if (instructor.schedule_morning) {
    sessions.push({
      start: instructor.morning_start.substring(0, 5),
      end: instructor.morning_end.substring(0, 5),
    })
  }
  if (instructor.schedule_afternoon) {
    sessions.push({
      start: instructor.afternoon_start.substring(0, 5),
      end: instructor.afternoon_end.substring(0, 5),
    })
  }
  // Un profesor sin ninguna franja marcada no debe quedarse sin agenda.
  return sessions.length > 0 ? sessions : [DEFAULT_SESSIONS[0]]
}

/** Horario excepcional de un profesor para un día concreto. */
export interface ScheduleOverride {
  date: string
  sessions: Session[]
  break_minutes: number | null
  reason?: string | null
}

/**
 * Franjas que rigen un día concreto: las del horario especial si lo hay, y si no las de siempre.
 *
 * Todo el cálculo de huecos pasa por aquí, así que un horario especial se refleja a la vez en la
 * pantalla del alumno, en el calendario del profesor, en el del admin y en la validación del
 * servidor. No hay que acordarse de actualizar cada sitio — que es como se desincronizan.
 */
export function getSessionsForDay(
  instructor: Instructor | null | undefined,
  override: ScheduleOverride | null | undefined
): Session[] {
  if (override && override.sessions.length > 0) return override.sessions
  return getInstructorSessions(instructor)
}

/** Descanso que rige un día: el del horario especial si lo define, y si no el del profesor. */
export function getBreakForDay(
  instructor: Instructor | null | undefined,
  override: ScheduleOverride | null | undefined
): number {
  if (override && override.break_minutes !== null && override.break_minutes !== undefined) {
    return override.break_minutes
  }
  return instructor?.break_minutes ?? 10
}

/**
 * Descanso que sigue a una práctica.
 * Camión + circulación son siempre 30 min por normativa; el resto usa el del profesor.
 */
export function getSlotBreakMinutes(
  type: PracticeType,
  subtype: PracticeSubtype | null,
  instructorBreakMinutes: number | null | undefined
): number {
  if (type === 'truck' && subtype === 'circulacion') return 30
  return instructorBreakMinutes ?? 10
}

/**
 * Tramo que ocupa una práctica en la agenda, en minutos: la clase MÁS su descanso.
 * El descanso cuenta como ocupado — el profesor no puede estar en dos sitios a la vez.
 */
export function getSlotSpan(
  startTime: string,
  type: PracticeType,
  subtype: PracticeSubtype | null,
  instructorBreakMinutes: number | null | undefined
): { start: number; end: number } {
  const start = toMinutes(startTime)
  return {
    start,
    end: start + getDuration(type, subtype) + getSlotBreakMinutes(type, subtype, instructorBreakMinutes),
  }
}

/** ¿Se pisan dos tramos? Medio abierto: acabar a las 10:00 y empezar a las 10:00 no es solape. */
export function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end
}

export interface OccupyingBooking {
  start_time: string
  practice_type: PracticeType
  practice_subtype: PracticeSubtype | null
}

/**
 * ¿Choca este hueco con alguna reserva o franja bloqueada?
 *
 * Compara TRAMOS, no horas de inicio. Comprobar solo si coincide la hora exacta de comienzo
 * (como hacía el calendario) da por libre un hueco de las 08:55 cuando hay clase a las 08:50.
 */
export function isSlotOccupied(
  slotStart: string,
  type: PracticeType,
  subtype: PracticeSubtype | null,
  instructorBreakMinutes: number | null | undefined,
  bookings: OccupyingBooking[],
  blockedSlots: { start_time: string; end_time: string }[] = []
): boolean {
  const slot = getSlotSpan(slotStart, type, subtype, instructorBreakMinutes)

  const hitsBooking = bookings.some(b =>
    overlaps(slot, getSlotSpan(b.start_time, b.practice_type, b.practice_subtype, instructorBreakMinutes))
  )
  if (hitsBooking) return true

  return blockedSlots.some(b =>
    overlaps(slot, { start: toMinutes(b.start_time), end: toMinutes(b.end_time) })
  )
}
