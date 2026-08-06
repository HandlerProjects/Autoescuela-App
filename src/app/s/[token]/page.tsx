'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { createStudentClient } from '@/lib/supabase/client'
import { formatDate, formatTime, getDayName, toDateString, getPracticeLabel, generateTimeSlots, getDuration, getBreak } from '@/lib/utils'
import { BONO_SIZE, buildBonoStatus, countConsuming, SUSPENDED_MESSAGE } from '@/lib/bono'
import type { Student, Booking, PracticeType, PracticeSubtype, Exam, Instructor } from '@/types'

// Antelación para RESERVAR una práctica (feedback del dueño: bajado de 1 día a 30 min).
const MIN_ADVANCE_HOURS_BOOKING = 0.5
// Antelación para CANCELAR sin que cuente como no-presentado — se mantiene aparte a propósito:
// bajar la de reservar no debe relajar también la política de no-shows.
const MIN_ADVANCE_HOURS_CANCEL = 24
const PICKUP_LOCATIONS = [
  'Estación de autobuses · Jardinillos',
  'Av. Ramón Carande · frente al Bar Roma',
]

function getAvailableCalendarDays(): Date[] {
  const now = new Date()
  const cutoff = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const days: Date[] = []
  const current = new Date()
  current.setHours(0, 0, 0, 0)
  while (current <= cutoff) {
    const dayOfWeek = current.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days.push(new Date(current))
    }
    current.setDate(current.getDate() + 1)
  }
  return days
}

function isSlotBeyondWindow(dateStr: string, timeStr: string): boolean {
  const slotDt = new Date(`${dateStr}T${timeStr}:00`)
  return slotDt > new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
}

function hoursUntil(dateStr: string, timeStr: string): number {
  const dt = new Date(`${dateStr}T${timeStr}:00`)
  return (dt.getTime() - Date.now()) / (1000 * 60 * 60)
}

function isSlotTooSoon(dateStr: string, timeStr: string): boolean {
  return hoursUntil(dateStr, timeStr) < MIN_ADVANCE_HOURS_BOOKING
}

function getWeekBounds(dateStr: string): { from: string; to: string } {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1 // lunes=0
  const mon = new Date(d); mon.setDate(d.getDate() - day)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  return { from: toDateString(mon), to: toDateString(sun) }
}

type Step = 'type' | 'date' | 'time' | 'confirm' | 'success'

const STEP_ORDER: Step[] = ['type', 'date', 'time', 'confirm']
const STEP_LABELS = ['Tipo', 'Día', 'Hora', 'Confirmar']

export default function StudentPage() {
  const params = useParams()
  const token = params.token as string
  const supabase = useMemo(() => createStudentClient(token), [token])

  const [student, setStudent] = useState<Student | null>(null)
  const [instructor, setInstructor] = useState<Instructor | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [myBookings, setMyBookings] = useState<Booking[]>([])
  const [takenSlots, setTakenSlots] = useState<{ date: string; start: string; type: PracticeType; subtype: PracticeSubtype | null }[]>([])
  const [blockedSlots, setBlockedSlots] = useState<{ date: string; start: string; end: string }[]>([])
  const [blockedDays, setBlockedDays] = useState<{ date: string; reason: string | null }[]>([])

  const [allBookings, setAllBookings] = useState<Booking[]>([])
  const [exams, setExams] = useState<Exam[]>([])

  const [step, setStep] = useState<Step>('type')
  const [selectedType, setSelectedType] = useState<PracticeType>('car')
  const [selectedSubtype, setSelectedSubtype] = useState<PracticeSubtype | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedSlot, setSelectedSlot] = useState<string>('')
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Cancel state
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  // Week booking state
  const [bookingAllWeek, setBookingAllWeek] = useState(false)
  const [weekBookingResults, setWeekBookingResults] = useState<{ date: string; ok: boolean; error?: string }[]>([])
  const [selectedWeekDays, setSelectedWeekDays] = useState<Set<string>>(new Set())

  const availableDays = getAvailableCalendarDays()

  // Saldo del bono. Se calcula con la misma regla que /api/booking/create (lib/bono.ts) y sobre
  // allBookings, que ya está cargado — así la pantalla no puede decirle al alumno que le quedan
  // prácticas y que luego el servidor le rechace la reserva.
  const bono = buildBonoStatus(countConsuming(allBookings), student?.practices_paid_through ?? 0)

  useEffect(() => { loadStudent() }, [token])

  async function loadStudent() {
    setLoading(true)
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .single()

    if (error || !data) { setNotFound(true); setLoading(false); return }

    setStudent(data)
    setSelectedType(data.practice_types[0])
    await Promise.all([
      fetchMyBookings(data.id),
      fetchAllBookings(data.id),
      fetchExams(data.id),
      ...(data.instructor_id ? [
        fetchAvailability(data.id, data.instructor_id),
        fetchInstructor(data.instructor_id),
      ] : []),
    ])
    setLoading(false)
  }

  async function fetchInstructor(instructorId: string) {
    const { data } = await supabase.from('instructors').select('*').eq('id', instructorId).single()
    if (data) setInstructor(data)
  }

  async function fetchMyBookings(studentId: string) {
    const today = toDateString(new Date())
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('student_id', studentId)
      .gte('practice_date', today)
      .neq('status', 'cancelled')
      .order('practice_date', { ascending: true })
    if (data) setMyBookings(data)
  }

  async function fetchAllBookings(studentId: string) {
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('student_id', studentId)
      .order('practice_date', { ascending: false })
    if (data) setAllBookings(data)
  }

  async function fetchExams(studentId: string) {
    const { data } = await supabase
      .from('exams')
      .select('*')
      .eq('student_id', studentId)
      .order('exam_date', { ascending: true })
    if (data) setExams(data)
  }

  // Disponibilidad real (reservas/bloqueos de TODOS los alumnos de este instructor) no puede
  // leerse con el cliente anon+token: la RLS de `bookings` solo deja ver las reservas del
  // propio alumno, así que huecos ocupados por otros alumnos del mismo instructor se veían
  // como libres. Se resuelve server-side con service role, igual que /api/booking/create.
  async function fetchAvailability(studentId: string, instructorId: string) {
    const from = toDateString(availableDays[0] ?? new Date())
    const to = toDateString(availableDays[availableDays.length - 1] ?? new Date())
    const res = await fetch('/api/booking/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, studentId, instructorId, from, to }),
    })
    if (!res.ok) return
    const data = await res.json()
    setTakenSlots(data.takenSlots ?? [])
    setBlockedSlots(data.blockedSlots ?? [])
    setBlockedDays(data.blockedDays ?? [])
  }

  function toMins(t: string): number {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }

  function getSlotBreak(type: PracticeType, subtype: PracticeSubtype | null): number {
    if (type === 'truck' && subtype === 'circulacion') return 30
    return instructor?.break_minutes ?? 10
  }

  function isSlotBlocked(date: string, slotStart: string, slotType: PracticeType, slotSubtype: PracticeSubtype | null): boolean {
    const sStart = toMins(slotStart)
    const sEnd = sStart + getDuration(slotType, slotSubtype) + getSlotBreak(slotType, slotSubtype)

    // Comprobar overlap con otras reservas
    const overlapsBooking = takenSlots.some(t => {
      if (t.date !== date) return false
      const bStart = toMins(t.start)
      const bEnd = bStart + getDuration(t.type, t.subtype) + getSlotBreak(t.type, t.subtype)
      return bStart < sEnd && sStart < bEnd
    })

    // Comprobar overlap con horas bloqueadas por el profesor
    const overlapsBlock = blockedSlots.some(b => {
      if (b.date !== date) return false
      const bStart = toMins(b.start)
      const bEnd = toMins(b.end)
      return bStart < sEnd && sStart < bEnd
    })

    return overlapsBooking || overlapsBlock
  }

  function getInstructorSessions(): { start: string; end: string }[] {
    if (!instructor) return [{ start: '08:00', end: '13:30' }, { start: '16:00', end: '19:15' }]
    const sessions: { start: string; end: string }[] = []
    if (instructor.schedule_morning) sessions.push({ start: instructor.morning_start.substring(0, 5), end: instructor.morning_end.substring(0, 5) })
    if (instructor.schedule_afternoon) sessions.push({ start: instructor.afternoon_start.substring(0, 5), end: instructor.afternoon_end.substring(0, 5) })
    return sessions.length > 0 ? sessions : [{ start: '08:00', end: '13:30' }]
  }

  function getSlotsForDay(date: string, type: PracticeType, subtype: PracticeSubtype | null) {
    const breakMins = instructor?.break_minutes ?? 10
    return generateTimeSlots(type, subtype, getInstructorSessions(), breakMins).map(slot => ({
      time: slot,
      taken: isSlotBlocked(date, slot, type, subtype) || isSlotTooSoon(date, slot) || isSlotBeyondWindow(date, slot),
    }))
  }

  async function cancelBooking(booking: Booking) {
    setCancelling(true)
    setCancelError('')

    const isLate = hoursUntil(booking.practice_date, booking.start_time.substring(0, 5)) < MIN_ADVANCE_HOURS_CANCEL
    const updateData: Record<string, unknown> = { status: 'cancelled' }
    if (isLate) updateData.no_show = true

    const { error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', booking.id)
      .eq('student_id', student!.id)

    if (error) {
      setCancelError('No se pudo cancelar. Inténtalo de nuevo.')
      setCancelling(false)
      return
    }

    // Eliminar evento de Google Calendar si existe
    if (booking.calendar_event_id) {
      fetch('/api/calendar', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: booking.calendar_event_id,
          studentId: student!.id,
          studentToken: token,
        }),
      }).catch(() => {})
    }

    // Notificar a otros alumnos del hueco liberado
    fetch('/api/notify-slot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cancelledStudentId: student!.id,
        studentToken: token,
        instructorId: student!.instructor_id,
        practiceDate: booking.practice_date,
        startTime: booking.start_time,
        practiceType: booking.practice_type,
        practiceSubtype: booking.practice_subtype,
      }),
    }).catch(() => {})

    // Notificar al instructor de la cancelación
    fetch('/api/notify-instructor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instructorId: student!.instructor_id,
        studentId: student!.id,
        studentToken: token,
        studentName: student!.full_name,
        practiceDate: booking.practice_date,
        startTime: booking.start_time,
        practiceType: booking.practice_type,
        practiceSubtype: booking.practice_subtype,
        pickupLocation: booking.pickup_location,
        action: 'cancelled',
      }),
    }).catch(() => {})

    setCancellingId(null)
    // allBookings también, porque de él sale el cómputo del tope semanal: si no se refresca,
    // al cancelar seguiría contando la práctica anulada y el alumno vería "Sem. completa" de más.
    await Promise.all([
      fetchMyBookings(student!.id),
      fetchAllBookings(student!.id),
      ...(student!.instructor_id ? [fetchAvailability(student!.id, student!.instructor_id)] : []),
    ])
    setCancelling(false)
  }

  async function confirmBooking() {
    if (!student || !selectedDate || !selectedSlot) return
    setSubmitting(true)
    setSubmitError('')

    const [h, m] = selectedSlot.split(':').map(Number)
    const duration = getDuration(selectedType, selectedSubtype)
    const endMinutes = h * 60 + m + duration
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`

    const res = await fetch('/api/booking/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        studentId: student.id,
        practiceDate: selectedDate,
        startTime: selectedSlot,
        endTime,
        practiceType: selectedType,
        practiceSubtype: selectedSubtype,
        pickupLocation: selectedLocation || null,
      }),
    })
    const result = await res.json()

    if (!res.ok) {
      setSubmitError(result.error ?? 'No se pudo confirmar la reserva. Inténtalo de nuevo.')
      setSubmitting(false)
      return
    }

    const newBooking = { id: result.bookingId }

    if (newBooking?.id) {
      fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: newBooking.id,
          studentId: student.id,
          studentToken: token,
          studentName: student.full_name,
          practiceDate: selectedDate,
          startTime: selectedSlot,
          endTime: endTime,
          practiceType: selectedType,
        }),
      })
        .then(r => r.json())
        .then(({ eventId }) => {
          if (eventId) {
            supabase.from('bookings').update({ calendar_event_id: eventId }).eq('id', newBooking.id)
          }
        })
        .catch(() => {})
    }

    // Notificar al instructor de la nueva reserva
    fetch('/api/notify-instructor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instructorId: student.instructor_id,
        studentId: student.id,
        studentToken: token,
        studentName: student.full_name,
        practiceDate: selectedDate,
        startTime: selectedSlot,
        practiceType: selectedType,
        practiceSubtype: selectedSubtype,
        pickupLocation: selectedLocation || null,
        action: 'booked',
      }),
    }).catch(() => {})

    await Promise.all([
      fetchMyBookings(student.id),
      fetchAllBookings(student.id),
      ...(student.instructor_id ? [fetchAvailability(student.id, student.instructor_id)] : []),
    ])
    setStep('success')
    setSubmitting(false)
  }

  async function confirmWeekBooking() {
    if (!student || !selectedSlot || !student.instructor_id) return
    setBookingAllWeek(true)
    setSubmitting(true)
    setSubmitError('')

    const [h, m] = selectedSlot.split(':').map(Number)
    const duration = getDuration(selectedType, selectedSubtype)
    const endMinutes = h * 60 + m + duration
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`

    // Consultar disponibilidad real en el servidor justo antes de reservar,
    // para no basarnos en datos de estado que pueden estar desfasados
    const from = toDateString(availableDays[0] ?? new Date())
    const to = toDateString(availableDays[availableDays.length - 1] ?? new Date())
    let freshTaken: { date: string; start: string; type: PracticeType; subtype: PracticeSubtype | null }[] = takenSlots
    let freshBlocked: { date: string; start: string; end: string }[] = blockedSlots
    let freshBlockedDays: { date: string; reason: string | null }[] = blockedDays

    try {
      const availRes = await fetch('/api/booking/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, studentId: student.id, instructorId: student.instructor_id, from, to }),
      })
      if (availRes.ok) {
        const availData = await availRes.json()
        freshTaken = availData.takenSlots ?? freshTaken
        freshBlocked = availData.blockedSlots ?? freshBlocked
        freshBlockedDays = availData.blockedDays ?? freshBlockedDays
      }
    } catch { /* Si el preflight falla usamos el estado actual */ }

    // Filtrar con datos frescos cuáles días siguen disponibles
    const sStart = toMins(selectedSlot)
    const sEnd = sStart + getDuration(selectedType, selectedSubtype) + getSlotBreak(selectedType, selectedSubtype)

    const daysToBook = [...selectedWeekDays].sort().filter(dateStr => {
      if (freshBlockedDays.some(b => b.date === dateStr)) return false
      if (isSlotTooSoon(dateStr, selectedSlot)) return false
      if (isSlotBeyondWindow(dateStr, selectedSlot)) return false
      const overlapsBooking = freshTaken.some(t => {
        if (t.date !== dateStr) return false
        const bStart = toMins(t.start)
        const bEnd = bStart + getDuration(t.type, t.subtype) + getSlotBreak(t.type, t.subtype)
        return bStart < sEnd && sStart < bEnd
      })
      const overlapsBlock = freshBlocked.some(b => {
        if (b.date !== dateStr) return false
        const bStart = toMins(b.start)
        const bEnd = toMins(b.end)
        return bStart < sEnd && sStart < bEnd
      })
      return !overlapsBooking && !overlapsBlock
    })

    const results: { date: string; ok: boolean; error?: string }[] = []
    for (const dateStr of daysToBook) {
      const res = await fetch('/api/booking/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          studentId: student.id,
          practiceDate: dateStr,
          startTime: selectedSlot,
          endTime,
          practiceType: selectedType,
          practiceSubtype: selectedSubtype,
          pickupLocation: selectedLocation || null,
        }),
      })
      const result = await res.json()
      results.push({ date: dateStr, ok: res.ok, error: res.ok ? undefined : (result.error ?? 'Error') })

      if (res.ok && result.bookingId) {
        fetch('/api/notify-instructor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instructorId: student.instructor_id,
            studentId: student.id,
            studentToken: token,
            studentName: student.full_name,
            practiceDate: dateStr,
            startTime: selectedSlot,
            practiceType: selectedType,
            practiceSubtype: selectedSubtype,
            pickupLocation: selectedLocation || null,
            action: 'booked',
          }),
        }).catch(() => {})
      }
    }

    setWeekBookingResults(results)
    await Promise.all([
      fetchMyBookings(student.id),
      fetchAllBookings(student.id),
      fetchAvailability(student.id, student.instructor_id),
    ])
    setStep('success')
    setSubmitting(false)
  }

  function resetBooking() {
    setStep('type')
    setSelectedDate('')
    setSelectedSlot('')
    setSelectedSubtype(null)
    setSelectedLocation('')
    setSubmitError('')
    setBookingAllWeek(false)
    setWeekBookingResults([])
    setSelectedWeekDays(new Set())
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0f1a' }}>
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-2 border-t-transparent mx-auto mb-4 animate-spin" style={{ borderColor: '#0057B8', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: '#6b8ab0' }}>Cargando...</p>
        </div>
      </div>
    )
  }

  if (notFound || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0a0f1a' }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
            <svg className="w-8 h-8" style={{ color: '#3a5070' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-white font-bold text-lg">Enlace no válido</p>
          <p className="text-sm mt-2" style={{ color: '#6b8ab0' }}>Este enlace no existe o ha sido desactivado.</p>
        </div>
      </div>
    )
  }

  const currentStepIndex = STEP_ORDER.indexOf(step)

  return (
    <div className="min-h-screen pb-12" style={{ background: '#0a0f1a' }}>

      {/* Keyframes para animaciones */}
      <style>{`
        @keyframes stepFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes confirmExpand {
          from { opacity: 0; max-height: 0; }
          to   { opacity: 1; max-height: 300px; }
        }
        .step-enter {
          animation: stepFadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .confirm-expand {
          overflow: hidden;
          animation: confirmExpand 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Header */}
      <div style={{ background: '#0d1829', borderBottom: '1px solid #1a2d45' }}>
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => { resetBooking(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            title="Volver a mis reservas"
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform active:scale-90"
            style={{ background: '#0057B8' }}
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13M3 13v5a1 1 0 001 1h1a2 2 0 004 0h8a2 2 0 004 0h1a1 1 0 001-1v-5M3 13h18" />
            </svg>
          </button>
          <div>
            <p className="text-white text-sm font-black leading-none">{student.full_name}</p>
            <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>Auto-Escuela Bahillo · Alumno #{student.order_number}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">

        {/* Mis próximas reservas */}
        {myBookings.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#0057B8' }}>
              Mis próximas prácticas
            </p>
            <div className="space-y-2">
              {myBookings.map(booking => {
                const isConfirming = cancellingId === booking.id
                const isLateCancel = hoursUntil(booking.practice_date, booking.start_time.substring(0, 5)) < MIN_ADVANCE_HOURS_CANCEL

                return (
                  <div
                    key={booking.id}
                    className="rounded-xl overflow-hidden transition-all duration-200"
                    style={{
                      background: '#0d1829',
                      border: `1px solid ${isConfirming ? 'rgba(239,68,68,0.3)' : '#1a2d45'}`,
                    }}
                  >
                    {/* Fila principal */}
                    <div className="px-4 py-3 flex items-center gap-3">
                      <div
                        className="w-1 h-10 rounded-full flex-shrink-0"
                        style={{ background: booking.practice_type === 'car' ? '#0057B8' : booking.practice_type === 'moto' ? '#a78bfa' : '#38bdf8' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-bold">
                          {getDayName(booking.practice_date)}, {formatDate(booking.practice_date)}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>
                          {formatTime(booking.start_time)} – {formatTime(booking.end_time)} · {getPracticeLabel(booking.practice_type, booking.practice_subtype)}
                        </p>
                        {booking.pickup_location && (
                          <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>
                            📍 {booking.pickup_location}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!isConfirming && (
                          <>
                            <span
                              className="text-xs font-bold px-2.5 py-1 rounded-full"
                              style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}
                            >
                              Confirmada
                            </span>
                            <button
                              onClick={() => { setCancellingId(booking.id); setCancelError('') }}
                              className="text-xs px-2.5 py-1 rounded-full font-bold"
                              style={{
                                background: 'rgba(239,68,68,0.08)',
                                color: '#f87171',
                                border: '1px solid rgba(239,68,68,0.15)',
                              }}
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                        {isConfirming && (
                          <button
                            onClick={() => { setCancellingId(null); setCancelError('') }}
                            className="w-7 h-7 flex items-center justify-center rounded-full text-sm"
                            style={{ color: '#6b8ab0', background: '#0a1220' }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Confirmación inline de cancelación */}
                    {isConfirming && (
                      <div className="confirm-expand px-4 pb-4 space-y-3">
                        <div
                          className="rounded-xl p-3 text-sm"
                          style={{
                            background: isLateCancel ? 'rgba(239,68,68,0.08)' : 'rgba(251,191,36,0.07)',
                            border: `1px solid ${isLateCancel ? 'rgba(239,68,68,0.25)' : 'rgba(251,191,36,0.2)'}`,
                          }}
                        >
                          {isLateCancel ? (
                            <>
                              <p className="font-bold" style={{ color: '#f87171' }}>Cancelación con menos de 24h</p>
                              <p className="mt-1 text-xs leading-relaxed" style={{ color: '#f87171', opacity: 0.8 }}>
                                Al cancelar con tan poca antelación, esta práctica contará como realizada en tu historial.
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="font-bold" style={{ color: '#fbbf24' }}>¿Seguro que quieres cancelar?</p>
                              <p className="mt-1 text-xs leading-relaxed" style={{ color: '#fbbf24', opacity: 0.8 }}>
                                Puedes hacer una nueva reserva en cualquier momento.
                              </p>
                            </>
                          )}
                        </div>

                        {cancelError && (
                          <p className="text-xs text-center" style={{ color: '#f87171' }}>{cancelError}</p>
                        )}

                        <div className="flex gap-2">
                          <button
                            onClick={() => { setCancellingId(null); setCancelError('') }}
                            className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                            style={{ background: '#0a1220', color: '#6b8ab0', border: '1px solid #1a2d45' }}
                          >
                            Volver
                          </button>
                          <button
                            onClick={() => cancelBooking(booking)}
                            disabled={cancelling}
                            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-150"
                            style={{
                              background: cancelling ? '#1a2d45' : 'rgba(239,68,68,0.15)',
                              color: cancelling ? '#3a5070' : '#f87171',
                              border: '1px solid rgba(239,68,68,0.3)',
                            }}
                          >
                            {cancelling ? 'Cancelando...' : 'Sí, cancelar'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Resumen de prácticas */}
        {(() => {
          const completed = allBookings.filter(b => b.status === 'completed').length
          const cancelled = allBookings.filter(b => b.status === 'cancelled').length
          const carDone = allBookings.filter(b => b.status === 'completed' && b.practice_type === 'car').length
          const truckPista = allBookings.filter(b => b.status === 'completed' && b.practice_type === 'truck' && b.practice_subtype === 'pista').length
          const truckCirc = allBookings.filter(b => b.status === 'completed' && b.practice_type === 'truck' && b.practice_subtype === 'circulacion').length
          const truckOther = allBookings.filter(b => b.status === 'completed' && b.practice_type === 'truck' && !b.practice_subtype).length
          if (completed === 0 && cancelled === 0) return null
          return (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#0057B8' }}>Mis estadísticas</p>
              <div className="rounded-xl p-4" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {[
                    { label: 'Completadas', value: completed, color: '#34d399' },
                    { label: 'Canceladas', value: cancelled, color: '#f87171' },
                    { label: 'Total', value: allBookings.length, color: 'white' },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>{s.label}</p>
                    </div>
                  ))}
                </div>
                {completed > 0 && (
                  <div className="pt-3 space-y-1.5" style={{ borderTop: '1px solid #1a2d45' }}>
                    {carDone > 0 && (
                      <div className="flex justify-between text-xs">
                        <span style={{ color: '#6b8ab0' }}>🚗 Coche</span>
                        <span className="font-bold text-white">{carDone} prácticas</span>
                      </div>
                    )}
                    {truckPista > 0 && (
                      <div className="flex justify-between text-xs">
                        <span style={{ color: '#6b8ab0' }}>🚛 Camión Pista</span>
                        <span className="font-bold text-white">{truckPista} prácticas</span>
                      </div>
                    )}
                    {truckCirc > 0 && (
                      <div className="flex justify-between text-xs">
                        <span style={{ color: '#6b8ab0' }}>🚛 Camión Circulación</span>
                        <span className="font-bold text-white">{truckCirc} prácticas</span>
                      </div>
                    )}
                    {truckOther > 0 && (
                      <div className="flex justify-between text-xs">
                        <span style={{ color: '#6b8ab0' }}>🚛 Camión</span>
                        <span className="font-bold text-white">{truckOther} prácticas</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Exámenes */}
        {exams.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#0057B8' }}>Mis exámenes</p>
            <div className="rounded-xl overflow-hidden" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
              {exams.map((exam, idx) => {
                const isTheory = exam.exam_type === 'theory'
                const passed = exam.result === 'passed'
                const failed = exam.result === 'failed'
                const resultColor = passed ? '#34d399' : failed ? '#f87171' : '#fbbf24'
                const resultBg = passed ? 'rgba(52,211,153,0.1)' : failed ? 'rgba(239,68,68,0.1)' : 'rgba(251,191,36,0.1)'
                const resultLabel = passed ? 'Aprobado' : failed ? 'Suspendido' : 'Pendiente'
                return (
                  <div
                    key={exam.id}
                    className="px-4 py-3 flex items-center gap-3"
                    style={{ borderBottom: idx < exams.length - 1 ? '1px solid #0f1c2e' : 'none' }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                      style={{ background: isTheory ? '#0057B820' : '#38bdf820' }}>
                      {isTheory ? '📝' : '🚗'}
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm font-bold">{isTheory ? 'Examen teórico' : 'Examen práctico'}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>
                        {formatDate(exam.exam_date)}{exam.attempt_number > 1 ? ` · Intento ${exam.attempt_number}` : ''}
                        {exam.notes ? ` · ${exam.notes}` : ''}
                      </p>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: resultBg, color: resultColor }}>
                      {resultLabel}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Nueva reserva */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#0057B8' }}>
            Nueva reserva
          </p>

          {/* Sin instructor asignado */}
          {!student.instructor_id && (
            <div className="rounded-2xl p-6 text-center" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#0057B815', border: '1.5px solid #0057B830' }}>
                <svg className="w-6 h-6" style={{ color: '#0057B8' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-white font-bold">Pendiente de asignación</p>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: '#6b8ab0' }}>
                Aún no tienes profesor asignado.<br />Habla con la autoescuela para que te asignen uno.
              </p>
            </div>
          )}

          {student.instructor_id && (<>

          {/* ── Stepper de progreso ── */}
          {step !== 'success' && (
            <div className="flex items-start mb-5">
              {STEP_LABELS.map((label, i) => {
                const isActive = i === currentStepIndex
                const isDone = i < currentStepIndex
                return (
                  <div key={label} className="flex items-center" style={{ flex: i < STEP_LABELS.length - 1 ? '1' : 'none' }}>
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black"
                        style={{
                          background: isDone ? '#22c55e' : isActive ? '#0057B8' : '#0a1220',
                          border: `2px solid ${isDone ? '#22c55e' : isActive ? '#0057B8' : '#1a2d45'}`,
                          color: isDone || isActive ? 'white' : '#3a5070',
                          transition: 'background 0.3s, border-color 0.3s',
                        }}
                      >
                        {isDone
                          ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          : i + 1
                        }
                      </div>
                      <span
                        className="text-xs font-semibold whitespace-nowrap"
                        style={{
                          color: isActive ? '#5a9fe0' : isDone ? '#22c55e' : '#3a5070',
                          transition: 'color 0.3s',
                        }}
                      >
                        {label}
                      </span>
                    </div>
                    {i < STEP_LABELS.length - 1 && (
                      <div
                        className="flex-1 h-0.5 mx-2 mb-6 rounded-full"
                        style={{
                          background: i < currentStepIndex ? '#22c55e50' : '#1a2d45',
                          transition: 'background 0.3s',
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── SUCCESS ── */}
          {step === 'success' && (
            <div className="rounded-2xl p-8 text-center step-enter" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(52,211,153,0.1)' }}
              >
                <svg className="w-8 h-8" style={{ color: '#34d399' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              {bookingAllWeek ? (
                <>
                  <p className="text-white font-black text-xl">¡Semana reservada!</p>
                  <p className="text-sm mt-1 mb-4" style={{ color: '#6b8ab0' }}>
                    {selectedSlot} · {getPracticeLabel(selectedType, selectedSubtype)}
                  </p>
                  <div className="space-y-1.5 text-left mb-4">
                    {weekBookingResults.map(r => (
                      <div key={r.date} className="flex items-center justify-between px-3 py-2 rounded-xl text-sm" style={{ background: '#0a1220', border: `1px solid ${r.ok ? '#1a2d45' : 'rgba(239,68,68,0.2)'}` }}>
                        <span className="font-bold" style={{ color: r.ok ? 'white' : '#f87171' }}>
                          {getDayName(r.date)}, {formatDate(r.date)}
                        </span>
                        {r.ok
                          ? <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>OK</span>
                          : <span className="text-xs" style={{ color: '#f87171' }}>{r.error}</span>
                        }
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-white font-black text-xl">¡Reserva confirmada!</p>
                  <p className="text-sm mt-2" style={{ color: '#6b8ab0' }}>
                    {getDayName(selectedDate)}, {formatDate(selectedDate)}
                  </p>
                  <p className="text-sm" style={{ color: '#6b8ab0' }}>
                    {selectedSlot} · {getPracticeLabel(selectedType, selectedSubtype)} · {getDuration(selectedType, selectedSubtype)} min
                  </p>
                </>
              )}
              <button
                onClick={resetBooking}
                className="mt-4 px-6 py-3 rounded-xl text-sm font-bold text-white transition"
                style={{ background: '#0057B8' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#004494'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#0057B8'}
              >
                Hacer otra reserva
              </button>
            </div>
          )}

          {/* ── SALDO AGOTADO ── */}
          {/* Se corta aquí en vez de dejarle elegir tipo y día para que el servidor le rechace
              al final: el alumno tiene que enterarse antes de perder tiempo eligiendo hueco. */}
          {step === 'type' && bono.suspended && (
            <div className="rounded-2xl p-6 text-center step-enter" style={{ background: '#0d1829', border: '1.5px solid rgba(251,191,36,0.35)' }}>
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(251,191,36,0.12)' }}
              >
                <svg className="w-6 h-6" style={{ color: '#fbbf24' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.75-2.97l-6.93-12a2 2 0 00-3.5 0l-6.93 12A2 2 0 005.07 19z" />
                </svg>
              </div>
              <p className="font-black text-lg mb-2" style={{ color: '#fbbf24' }}>Saldo agotado</p>
              <p className="text-sm leading-relaxed" style={{ color: '#a0b8d0' }}>
                {SUSPENDED_MESSAGE}.
              </p>
              <p className="text-xs mt-4" style={{ color: '#3a5070' }}>
                Has usado tus {BONO_SIZE} prácticas. Tus reservas ya hechas se mantienen.
              </p>
            </div>
          )}

          {/* ── STEP: type ── */}
          {step === 'type' && !bono.suspended && (
            <div className="rounded-2xl p-5 space-y-4 step-enter" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
              <p className="text-white font-bold">¿Qué tipo de práctica?</p>

              {/* Aviso solo cuando queda poco: recordárselo siempre sería ruido */}
              {bono.remaining <= 2 && (
                <p
                  className="text-xs font-semibold px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}
                >
                  {bono.remaining === 1
                    ? 'Te queda 1 práctica antes de pasar por la oficina.'
                    : `Te quedan ${bono.remaining} prácticas antes de pasar por la oficina.`}
                </p>
              )}

              {/* Opciones de tipo */}
              <div className={`grid gap-3 ${student.practice_types.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {student.practice_types.map(type => (
                  <button
                    key={type}
                    onClick={() => { setSelectedType(type); setSelectedSubtype(null) }}
                    className="py-4 rounded-xl text-sm font-bold transition-all duration-200"
                    style={{
                      background: selectedType === type ? (type === 'car' ? '#0057B820' : type === 'truck' ? '#38bdf820' : '#a78bfa20') : '#0a1220',
                      border: `2px solid ${selectedType === type ? (type === 'car' ? '#0057B8' : type === 'truck' ? '#38bdf8' : '#a78bfa') : '#1a2d45'}`,
                      color: selectedType === type ? (type === 'car' ? '#0057B8' : type === 'truck' ? '#38bdf8' : '#a78bfa') : '#3a5070',
                    }}
                  >
                    {type === 'car' ? '🚗 Coche' : type === 'truck' ? '🚛 Camión' : '🏍️ Moto'}
                  </button>
                ))}
              </div>

              {/* Subtipo — camión o moto */}
              {(selectedType === 'truck' || selectedType === 'moto') && (
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#6b8ab0' }}>Modalidad</p>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { value: 'pista' as PracticeSubtype, label: 'Pista', extra: selectedType === 'moto' ? '30 min' : '45 min' },
                      { value: 'circulacion' as PracticeSubtype, label: 'Circulación', extra: '45 min' },
                    ]).map(({ value, label, extra }) => {
                      const color = selectedType === 'truck' ? '#38bdf8' : '#a78bfa'
                      return (
                        <button
                          key={value}
                          onClick={() => setSelectedSubtype(value)}
                          className="py-3 rounded-xl text-sm font-bold transition-all duration-200"
                          style={{
                            background: selectedSubtype === value ? `${color}20` : '#0a1220',
                            border: `2px solid ${selectedSubtype === value ? color : '#1a2d45'}`,
                            color: selectedSubtype === value ? color : '#3a5070',
                          }}
                        >
                          <span className="block">{label}</span>
                          <span className="text-xs font-normal opacity-70">{extra}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <button
                onClick={() => setStep('date')}
                disabled={(selectedType === 'truck' || selectedType === 'moto') && !selectedSubtype}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition"
                style={{
                  background: (selectedType === 'truck' || selectedType === 'moto') && !selectedSubtype ? '#1a2d45' : '#0057B8',
                  color: (selectedType === 'truck' || selectedType === 'moto') && !selectedSubtype ? '#3a5070' : 'white',
                }}
                onMouseEnter={e => { if (!((selectedType === 'truck' || selectedType === 'moto') && !selectedSubtype)) (e.currentTarget as HTMLElement).style.background = '#004494' }}
                onMouseLeave={e => { if (!((selectedType === 'truck' || selectedType === 'moto') && !selectedSubtype)) (e.currentTarget as HTMLElement).style.background = '#0057B8' }}
              >
                Continuar →
              </button>
            </div>
          )}

          {/* ── STEP: date ── */}
          {step === 'date' && (
            <div className="rounded-2xl p-5 space-y-4 step-enter" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
              <div className="flex items-center gap-3">
                <button onClick={() => setStep('type')} style={{ color: '#6b8ab0' }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <p className="text-white font-bold">Elige un día</p>
              </div>
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {availableDays.map(day => {
                  const dateStr = toDateString(day)
                  const blockedDay = blockedDays.find(b => b.date === dateStr)
                  const slots = getSlotsForDay(dateStr, selectedType, selectedSubtype)
                  const available = slots.filter(s => !s.taken).length
                  // Sin huecos puede significar dos cosas muy distintas para el alumno: que el día
                  // está lleno, o que simplemente ya ha pasado la última hora de hoy. Antes ambas
                  // decían "Completo" y parecía un fallo de la app.
                  const dayOver = available === 0 && slots.every(s => isSlotTooSoon(dateStr, s.time))
                  const isSelected = dateStr === selectedDate
                  const { from: wFrom, to: wTo } = getWeekBounds(dateStr)
                  // Se cuenta sobre allBookings (histórico completo), no sobre myBookings: myBookings
                  // solo trae de hoy en adelante, así que las prácticas de lunes a ayer no entraban en
                  // el cómputo y el cliente contaba menos que /api/booking/create, que sí mira la semana
                  // entera. El alumno veía el día con huecos, elegía hora y el servidor le rechazaba al
                  // confirmar con "Has alcanzado el límite de N prácticas esta semana".
                  const weekCount = allBookings.filter(b => b.practice_date >= wFrom && b.practice_date <= wTo && b.status === 'confirmed').length
                  const dayCount = allBookings.filter(b => b.practice_date === dateStr && b.status === 'confirmed').length
                  const maxWeekly = student?.max_weekly_bookings ?? 5
                  const maxDaily = student?.exam_mode ? 2 : 1
                  const weekFull = weekCount >= maxWeekly
                  const dayFull = dayCount >= maxDaily

                  if (blockedDay) {
                    return (
                      <div
                        key={dateStr}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm"
                        style={{
                          background: 'rgba(239,68,68,0.05)',
                          border: '1.5px solid rgba(239,68,68,0.2)',
                          opacity: 0.7,
                        }}
                      >
                        <div className="text-left">
                          <p className="font-bold" style={{ color: '#f87171' }}>{getDayName(dateStr)}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>{formatDate(dateStr)}</p>
                        </div>
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}
                        >
                          🚫 {blockedDay.reason ?? 'No disponible'}
                        </span>
                      </div>
                    )
                  }

                  return (
                    <button
                      key={dateStr}
                      onClick={() => { if (!weekFull && !dayFull) { setSelectedDate(dateStr); setStep('time') } }}
                      disabled={available === 0 || weekFull || dayFull}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all duration-150"
                      style={{
                        background: isSelected ? '#0057B820' : '#0a1220',
                        border: `1.5px solid ${isSelected ? '#0057B8' : '#1a2d45'}`,
                        opacity: available === 0 || dayFull ? 0.4 : 1,
                        cursor: available === 0 || dayFull ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <div className="text-left">
                        <p className="font-bold" style={{ color: isSelected ? '#5a9fe0' : 'white' }}>{getDayName(dateStr)}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>{formatDate(dateStr)}</p>
                      </div>
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{
                          background: weekFull ? 'rgba(251,191,36,0.1)' : dayFull ? 'rgba(251,191,36,0.1)' : available === 0 ? '#0f1c2e' : '#0057B820',
                          color: weekFull ? '#fbbf24' : dayFull ? '#fbbf24' : available === 0 ? '#3a5070' : '#0057B8',
                        }}
                      >
                        {weekFull ? 'Sem. completa' : dayFull ? 'Ya reservado' : dayOver ? 'Ya no quedan horas' : available === 0 ? 'Completo' : `${available} huecos`}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── STEP: time ── */}
          {step === 'time' && selectedDate && (
            <div className="rounded-2xl p-5 space-y-4 step-enter" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
              <div className="flex items-center gap-3">
                <button onClick={() => setStep('date')} style={{ color: '#6b8ab0' }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <p className="text-white font-bold">Elige una hora</p>
                  <p className="text-xs" style={{ color: '#3a5070' }}>{getDayName(selectedDate)}, {formatDate(selectedDate)}</p>
                </div>
              </div>

              {/* Mañana */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#0057B8' }}>Mañana</p>
                <div className="grid grid-cols-3 gap-2">
                  {getSlotsForDay(selectedDate, selectedType, selectedSubtype)
                    .filter(s => s.time < '14:00')
                    .map(({ time, taken }) => (
                      <button
                        key={time}
                        onClick={() => {
                          setSelectedSlot(time)
                          setSelectedWeekDays(new Set(
                            availableDays.map(d => toDateString(d)).filter(dateStr => {
                              const slots = getSlotsForDay(dateStr, selectedType, selectedSubtype)
                              return slots.some(s => s.time === time && !s.taken)
                            })
                          ))
                          setStep('confirm')
                        }}
                        disabled={taken}
                        className="py-3 rounded-xl text-sm font-bold transition-all duration-150"
                        style={{
                          background: taken ? '#0a1220' : selectedSlot === time ? '#0057B8' : '#0a1220',
                          border: `1.5px solid ${taken ? '#0f1c2e' : selectedSlot === time ? '#0057B8' : '#1a2d45'}`,
                          color: taken ? '#1a2d45' : selectedSlot === time ? 'white' : '#a0b8d0',
                          cursor: taken ? 'not-allowed' : 'pointer',
                          textDecoration: taken ? 'line-through' : 'none',
                        }}
                      >
                        {time}
                      </button>
                    ))}
                </div>
              </div>

              {/* Tarde */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#0057B8' }}>Tarde</p>
                <div className="grid grid-cols-3 gap-2">
                  {getSlotsForDay(selectedDate, selectedType, selectedSubtype)
                    .filter(s => s.time >= '14:00')
                    .map(({ time, taken }) => (
                      <button
                        key={time}
                        onClick={() => {
                          setSelectedSlot(time)
                          setSelectedWeekDays(new Set(
                            availableDays.map(d => toDateString(d)).filter(dateStr => {
                              const slots = getSlotsForDay(dateStr, selectedType, selectedSubtype)
                              return slots.some(s => s.time === time && !s.taken)
                            })
                          ))
                          setStep('confirm')
                        }}
                        disabled={taken}
                        className="py-3 rounded-xl text-sm font-bold transition-all duration-150"
                        style={{
                          background: taken ? '#0a1220' : selectedSlot === time ? '#0057B8' : '#0a1220',
                          border: `1.5px solid ${taken ? '#0f1c2e' : selectedSlot === time ? '#0057B8' : '#1a2d45'}`,
                          color: taken ? '#1a2d45' : selectedSlot === time ? 'white' : '#a0b8d0',
                          cursor: taken ? 'not-allowed' : 'pointer',
                          textDecoration: taken ? 'line-through' : 'none',
                        }}
                      >
                        {time}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: confirm ── */}
          {step === 'confirm' && (
            <div className="rounded-2xl p-5 space-y-4 step-enter" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
              <div className="flex items-center gap-3">
                <button onClick={() => setStep('time')} style={{ color: '#6b8ab0' }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <p className="text-white font-bold">Confirmar reserva</p>
              </div>

              <div className="rounded-xl p-4 space-y-3" style={{ background: '#0a1220', border: '1px solid #1a2d45' }}>
                {[
                  { label: 'Día', value: `${getDayName(selectedDate)}, ${formatDate(selectedDate)}` },
                  {
                    label: 'Hora', value: (() => {
                      const [h, m] = selectedSlot.split(':').map(Number)
                      const end = h * 60 + m + getDuration(selectedType, selectedSubtype)
                      return `${selectedSlot} – ${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
                    })()
                  },
                  { label: 'Tipo', value: getPracticeLabel(selectedType, selectedSubtype) },
                  { label: 'Duración', value: `${getDuration(selectedType, selectedSubtype)} minutos` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center text-sm">
                    <span style={{ color: '#6b8ab0' }}>{label}</span>
                    <span className="font-bold text-white">{value}</span>
                  </div>
                ))}
              </div>

              {/* Lugar de recogida */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: '#6b8ab0' }}>Lugar de recogida</p>
                <div className="space-y-2">
                  {PICKUP_LOCATIONS.map(loc => (
                    <button
                      key={loc}
                      onClick={() => setSelectedLocation(loc)}
                      className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-left transition-all duration-150"
                      style={{
                        background: selectedLocation === loc ? '#0057B820' : '#0a1220',
                        border: `1.5px solid ${selectedLocation === loc ? '#0057B8' : '#1a2d45'}`,
                        color: selectedLocation === loc ? '#5a9fe0' : '#6b8ab0',
                      }}
                    >
                      📍 {loc}
                    </button>
                  ))}
                </div>
              </div>

              {submitError && (
                <div
                  className="rounded-xl px-4 py-3 text-sm"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
                >
                  {submitError}
                </div>
              )}

              <button
                onClick={confirmBooking}
                disabled={submitting || !selectedLocation}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition"
                style={{ background: submitting || !selectedLocation ? '#1a2d45' : '#0057B8', color: submitting || !selectedLocation ? '#3a5070' : 'white' }}
                onMouseEnter={e => { if (!submitting && selectedLocation) (e.currentTarget as HTMLElement).style.background = '#004494' }}
                onMouseLeave={e => { if (!submitting && selectedLocation) (e.currentTarget as HTMLElement).style.background = '#0057B8' }}
              >
                {submitting ? 'Confirmando...' : '✓ Confirmar práctica'}
              </button>

              {/* También te puede interesar */}
              {selectedWeekDays.size > 0 && (() => {
                const DAY_LETTER: Record<number, string> = { 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S' }
                const allWindowDays = availableDays.map(d => toDateString(d))
                const availableForSlot = new Set(
                  allWindowDays.filter(dateStr => {
                    const slots = getSlotsForDay(dateStr, selectedType, selectedSubtype)
                    return slots.some(s => s.time === selectedSlot && !s.taken)
                  })
                )
                if (availableForSlot.size < 2) return null
                const selectedCount = [...selectedWeekDays].filter(d => availableForSlot.has(d)).length
                return (
                  <div className="pt-2">
                    <p className="text-xs font-semibold mb-2" style={{ color: '#3a5070' }}>
                      También te puede interesar a las {selectedSlot}:
                    </p>
                    <div className="flex gap-1.5 mb-3">
                      {allWindowDays.map(dateStr => {
                        const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay()
                        const letter = DAY_LETTER[dayOfWeek] ?? '?'
                        const isAvailable = availableForSlot.has(dateStr)
                        const isSelected = selectedWeekDays.has(dateStr)
                        return (
                          <button
                            key={dateStr}
                            onClick={() => {
                              if (!isAvailable) return
                              setSelectedWeekDays(prev => {
                                const next = new Set(prev)
                                if (next.has(dateStr)) next.delete(dateStr)
                                else next.add(dateStr)
                                return next
                              })
                            }}
                            disabled={!isAvailable}
                            className="flex flex-col items-center flex-1 py-2.5 rounded-xl transition-all duration-150"
                            style={{
                              background: !isAvailable ? '#080f1a' : isSelected ? '#0057B820' : '#0a1220',
                              border: `1.5px solid ${!isAvailable ? '#0d1829' : isSelected ? '#0057B8' : '#1a2d45'}`,
                              cursor: isAvailable ? 'pointer' : 'default',
                            }}
                          >
                            <span className="text-sm font-black" style={{ color: !isAvailable ? '#1a2d45' : isSelected ? '#5a9fe0' : '#3a5070' }}>
                              {letter}
                            </span>
                            <span className="text-[9px] font-semibold mt-0.5" style={{ color: !isAvailable ? '#0f1c2e' : isSelected ? '#2a5a80' : '#1a3050' }}>
                              {formatDate(dateStr).split(' ')[0]}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    <button
                      onClick={confirmWeekBooking}
                      disabled={submitting || !selectedLocation || selectedCount === 0}
                      className="w-full py-3 rounded-xl text-sm font-bold transition"
                      style={{
                        background: '#0a1a2e',
                        border: `1.5px solid ${submitting || !selectedLocation || selectedCount === 0 ? '#1a2d45' : '#0057B860'}`,
                        color: submitting || !selectedLocation || selectedCount === 0 ? '#3a5070' : '#5a9fe0',
                      }}
                    >
                      {submitting
                        ? 'Reservando...'
                        : selectedCount === 0
                          ? 'Selecciona al menos un día'
                          : `Reservar ${selectedCount} día${selectedCount > 1 ? 's' : ''} seleccionado${selectedCount > 1 ? 's' : ''}`}
                    </button>
                  </div>
                )
              })()}
            </div>
          )}
          </>)}
        </div>
      </div>
    </div>
  )
}
