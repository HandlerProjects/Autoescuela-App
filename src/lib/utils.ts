import { v4 as uuidv4 } from 'uuid'
import { type ClassValue, clsx } from 'clsx'

// ── Genera un token único para el enlace del alumno ──────────────────────────
export function generateStudentToken(): string {
  return uuidv4().replace(/-/g, '').substring(0, 16)
}

// ── Combina clases CSS condicionalmente ──────────────────────────────────────
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}

// ── Formatea una hora "HH:MM:SS" → "HH:MM" ───────────────────────────────────
export function formatTime(time: string): string {
  return time.substring(0, 5)
}

// ── Formatea una fecha "YYYY-MM-DD" → "DD/MM/YYYY" ───────────────────────────
export function formatDate(date: string): string {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

// ── Devuelve el nombre del día de la semana ───────────────────────────────────
export function getDayName(date: string): string {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const d = new Date(date + 'T00:00:00')
  return days[d.getDay()]
}

// ── Comprueba si una fecha es fin de semana ───────────────────────────────────
export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

// ── Devuelve los próximos N días laborables desde hoy ─────────────────────────
export function getNextWorkingDays(count: number): Date[] {
  const days: Date[] = []
  const current = new Date()
  current.setHours(0, 0, 0, 0)

  while (days.length < count) {
    current.setDate(current.getDate() + 1)
    if (!isWeekend(current)) {
      days.push(new Date(current))
    }
  }
  return days
}

// ── Convierte Date → "YYYY-MM-DD" (fecha local, no UTC) ───────────────────────
export function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ── Duración en minutos según tipo y subtipo ──────────────────────────────────
export function getDuration(type: 'car' | 'truck' | 'moto', subtype?: 'pista' | 'circulacion' | null): number {
  if (type === 'moto' && subtype === 'pista') return 30
  return 45
}

// ── Descanso en minutos según tipo y subtipo ──────────────────────────────────
export function getBreak(type: 'car' | 'truck' | 'moto', subtype?: 'pista' | 'circulacion' | null): number {
  if (type === 'truck' && subtype === 'circulacion') return 30
  return 10
}

// ── Genera los slots de un día según tipo y subtipo de práctica ───────────────
export function generateTimeSlots(
  practiceType: 'car' | 'truck' | 'moto',
  practiceSubtype?: 'pista' | 'circulacion' | null,
  customSessions?: { start: string; end: string }[],
  instructorBreakMinutes?: number
): string[] {
  const slots: string[] = []
  const duration = getDuration(practiceType, practiceSubtype)
  // truck+circulacion siempre 30 min; para el resto usa el override del instructor si existe
  const breakTime = (practiceType === 'truck' && practiceSubtype === 'circulacion')
    ? 30
    : (instructorBreakMinutes ?? getBreak(practiceType, practiceSubtype))

  const sessions = customSessions ?? [
    { start: '08:00', end: '13:30' },
    { start: '16:00', end: '19:15' },
  ]

  for (const session of sessions) {
    let [hours, minutes] = session.start.split(':').map(Number)
    const [endHours, endMinutes] = session.end.split(':').map(Number)
    const endTotal = endHours * 60 + endMinutes

    while (true) {
      const startTotal = hours * 60 + minutes
      const slotEnd = startTotal + duration
      if (slotEnd > endTotal) break
      slots.push(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`)
      const nextStart = slotEnd + breakTime
      hours = Math.floor(nextStart / 60)
      minutes = nextStart % 60
    }
  }

  return slots
}

// ── Etiqueta legible del tipo de práctica ─────────────────────────────────────
export function getPracticeLabel(type: 'car' | 'truck' | 'moto', subtype?: 'pista' | 'circulacion' | null): string {
  if (type === 'car') return 'Coche'
  if (type === 'moto' && subtype === 'pista') return 'Moto Pista'
  if (type === 'moto' && subtype === 'circulacion') return 'Moto Circulación'
  if (type === 'moto') return 'Moto'
  if (subtype === 'pista') return 'Camión Pista'
  if (subtype === 'circulacion') return 'Camión Circulación'
  return 'Camión'
}

// ── Etiqueta legible del estado de reserva ────────────────────────────────────
export function getStatusLabel(status: 'confirmed' | 'cancelled' | 'completed'): string {
  const labels = {
    confirmed: 'Confirmada',
    cancelled: 'Cancelada',
    completed: 'Completada',
  }
  return labels[status]
}

// ── Color del badge según estado (tema oscuro: fondo translúcido + texto sólido) ─
export function getStatusColor(status: 'confirmed' | 'cancelled' | 'completed'): { background: string; color: string } {
  const colors = {
    confirmed: { background: 'rgba(34,197,94,0.18)', color: '#4ade80' },
    cancelled: { background: 'rgba(239,68,68,0.18)', color: '#f87171' },
    completed: { background: 'rgba(107,138,176,0.18)', color: '#a0b8d0' },
  }
  return colors[status]
}