'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatTime, getDayName, toDateString, getPracticeLabel, generateTimeSlots } from '@/lib/utils'
import type { Student, Booking, PracticeType, PracticeSubtype } from '@/types'

const SLOT_DURATION = 45
const MIN_ADVANCE_HOURS = 24

function getNextWorkingDays(count: number): Date[] {
  const days: Date[] = []
  const current = new Date()
  current.setHours(0, 0, 0, 0)
  let checked = 0
  while (days.length < count && checked < 60) {
    const day = current.getDay()
    if (day !== 0 && day !== 6) days.push(new Date(current))
    current.setDate(current.getDate() + 1)
    checked++
  }
  return days
}

function hoursUntil(dateStr: string, timeStr: string): number {
  const dt = new Date(`${dateStr}T${timeStr}:00`)
  return (dt.getTime() - Date.now()) / (1000 * 60 * 60)
}

function isSlotTooSoon(dateStr: string, timeStr: string): boolean {
  return hoursUntil(dateStr, timeStr) < MIN_ADVANCE_HOURS
}

type Step = 'type' | 'date' | 'time' | 'confirm' | 'success'

const STEP_ORDER: Step[] = ['type', 'date', 'time', 'confirm']
const STEP_LABELS = ['Tipo', 'Día', 'Hora', 'Confirmar']

export default function StudentPage() {
  const params = useParams()
  const token = params.token as string
  const supabase = createClient()

  const [student, setStudent] = useState<Student | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [myBookings, setMyBookings] = useState<Booking[]>([])
  const [takenSlots, setTakenSlots] = useState<{ date: string; start: string; type: PracticeType; subtype: PracticeSubtype | null }[]>([])

  const [allBookings, setAllBookings] = useState<Booking[]>([])

  const [step, setStep] = useState<Step>('type')
  const [selectedType, setSelectedType] = useState<PracticeType>('car')
  const [selectedSubtype, setSelectedSubtype] = useState<PracticeSubtype | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedSlot, setSelectedSlot] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Cancel state
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  const workingDays = getNextWorkingDays(21)

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
    await Promise.all([fetchMyBookings(data.id), fetchTakenSlots(data.instructor_id), fetchAllBookings(data.id)])
    setLoading(false)
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

  async function fetchTakenSlots(instructorId: string) {
    const from = toDateString(workingDays[0])
    const to = toDateString(workingDays[workingDays.length - 1])
    const { data } = await supabase
      .from('bookings')
      .select('practice_date, start_time, practice_type, practice_subtype')
      .eq('instructor_id', instructorId)
      .gte('practice_date', from)
      .lte('practice_date', to)
      .neq('status', 'cancelled')
    if (data) {
      setTakenSlots(data.map(b => ({
        date: b.practice_date,
        start: b.start_time.substring(0, 5),
        type: b.practice_type,
        subtype: b.practice_subtype ?? null,
      })))
    }
  }

  function toMins(t: string): number {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }

  function breakFor(type: PracticeType, subtype: PracticeSubtype | null): number {
    return type === 'truck' && subtype === 'circulacion' ? 30 : 10
  }

  function isSlotBlocked(date: string, slotStart: string, slotType: PracticeType, slotSubtype: PracticeSubtype | null): boolean {
    const sStart = toMins(slotStart)
    const sEnd = sStart + SLOT_DURATION + breakFor(slotType, slotSubtype)
    return takenSlots.some(t => {
      if (t.date !== date) return false
      const bStart = toMins(t.start)
      const bEnd = bStart + SLOT_DURATION + breakFor(t.type, t.subtype)
      return bStart < sEnd && sStart < bEnd
    })
  }

  function getSlotsForDay(date: string, type: PracticeType, subtype: PracticeSubtype | null) {
    return generateTimeSlots(type, subtype).map(slot => ({
      time: slot,
      taken: isSlotBlocked(date, slot, type, subtype) || isSlotTooSoon(date, slot),
    }))
  }

  async function cancelBooking(booking: Booking) {
    setCancelling(true)
    setCancelError('')

    const isLate = hoursUntil(booking.practice_date, booking.start_time.substring(0, 5)) < MIN_ADVANCE_HOURS
    const updateData: Record<string, unknown> = { status: 'cancelled' }
    if (isLate) updateData.no_show = true

    const { error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', booking.id)

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
        body: JSON.stringify({ eventId: booking.calendar_event_id }),
      }).catch(() => {})
    }

    setCancellingId(null)
    await Promise.all([fetchMyBookings(student!.id), fetchTakenSlots(student!.instructor_id)])
    setCancelling(false)
  }

  async function confirmBooking() {
    if (!student || !selectedDate || !selectedSlot) return
    setSubmitting(true)
    setSubmitError('')

    const { data: existing } = await supabase
      .from('bookings')
      .select('id')
      .eq('student_id', student.id)
      .eq('status', 'confirmed')
      .gte('practice_date', toDateString(new Date()))
      .single()

    if (existing) {
      setSubmitError('Ya tienes una práctica reservada. Cancélala antes de hacer una nueva.')
      setSubmitting(false)
      return
    }

    const [h, m] = selectedSlot.split(':').map(Number)
    const endMinutes = h * 60 + m + SLOT_DURATION
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`

    const { error } = await supabase.from('bookings').insert({
      student_id: student.id,
      instructor_id: student.instructor_id,
      practice_date: selectedDate,
      start_time: selectedSlot,
      end_time: endTime,
      practice_type: selectedType,
      practice_subtype: selectedSubtype,
      status: 'confirmed',
    })

    if (error) {
      setSubmitError('No se pudo confirmar la reserva. Inténtalo de nuevo.')
      setSubmitting(false)
      return
    }

    // Obtener el ID de la reserva recién creada y crear evento en Google Calendar
    const { data: newBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('student_id', student.id)
      .eq('practice_date', selectedDate)
      .eq('start_time', selectedSlot)
      .single()

    if (newBooking) {
      fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: newBooking.id,
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

    await Promise.all([fetchMyBookings(student.id), fetchTakenSlots(student.instructor_id), fetchAllBookings(student.id)])
    setStep('success')
    setSubmitting(false)
  }

  function resetBooking() {
    setStep('type')
    setSelectedDate('')
    setSelectedSlot('')
    setSelectedSubtype(null)
    setSubmitError('')
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
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#0057B8' }}>
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13M3 13v5a1 1 0 001 1h1a2 2 0 004 0h8a2 2 0 004 0h1a1 1 0 001-1v-5M3 13h18" />
            </svg>
          </div>
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
                const isLateCancel = hoursUntil(booking.practice_date, booking.start_time.substring(0, 5)) < MIN_ADVANCE_HOURS

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
                        style={{ background: booking.practice_type === 'car' ? '#0057B8' : '#38bdf8' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-bold">
                          {getDayName(booking.practice_date)}, {formatDate(booking.practice_date)}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>
                          {formatTime(booking.start_time)} – {formatTime(booking.end_time)} · {getPracticeLabel(booking.practice_type, booking.practice_subtype)}
                        </p>
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

        {/* Nueva reserva */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#0057B8' }}>
            Nueva reserva
          </p>

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
              <p className="text-white font-black text-xl">¡Reserva confirmada!</p>
              <p className="text-sm mt-2" style={{ color: '#6b8ab0' }}>
                {getDayName(selectedDate)}, {formatDate(selectedDate)}
              </p>
              <p className="text-sm" style={{ color: '#6b8ab0' }}>
                {selectedSlot} · {getPracticeLabel(selectedType, selectedSubtype)} · 45 min
              </p>
              <button
                onClick={resetBooking}
                className="mt-6 px-6 py-3 rounded-xl text-sm font-bold text-white transition"
                style={{ background: '#0057B8' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#004494'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#0057B8'}
              >
                Hacer otra reserva
              </button>
            </div>
          )}

          {/* ── STEP: type ── */}
          {step === 'type' && (
            <div className="rounded-2xl p-5 space-y-4 step-enter" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
              <p className="text-white font-bold">¿Qué tipo de práctica?</p>

              {/* Opciones de tipo */}
              <div className={`grid gap-3 ${student.practice_types.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {student.practice_types.map(type => (
                  <button
                    key={type}
                    onClick={() => { setSelectedType(type); if (type === 'car') setSelectedSubtype(null) }}
                    className="py-4 rounded-xl text-sm font-bold transition-all duration-200"
                    style={{
                      background: selectedType === type ? (type === 'car' ? '#0057B820' : '#38bdf820') : '#0a1220',
                      border: `2px solid ${selectedType === type ? (type === 'car' ? '#0057B8' : '#38bdf8') : '#1a2d45'}`,
                      color: selectedType === type ? (type === 'car' ? '#0057B8' : '#38bdf8') : '#3a5070',
                    }}
                  >
                    {type === 'car' ? '🚗 Coche' : '🚛 Camión'}
                  </button>
                ))}
              </div>

              {/* Subtipo — solo si camión seleccionado */}
              {selectedType === 'truck' && (
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#6b8ab0' }}>Modalidad</p>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { value: 'pista' as PracticeSubtype, label: 'Pista' },
                      { value: 'circulacion' as PracticeSubtype, label: 'Circulación' },
                    ]).map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setSelectedSubtype(value)}
                        className="py-3 rounded-xl text-sm font-bold transition-all duration-200"
                        style={{
                          background: selectedSubtype === value ? '#38bdf820' : '#0a1220',
                          border: `2px solid ${selectedSubtype === value ? '#38bdf8' : '#1a2d45'}`,
                          color: selectedSubtype === value ? '#38bdf8' : '#3a5070',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setStep('date')}
                disabled={selectedType === 'truck' && !selectedSubtype}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition"
                style={{
                  background: selectedType === 'truck' && !selectedSubtype ? '#1a2d45' : '#0057B8',
                  color: selectedType === 'truck' && !selectedSubtype ? '#3a5070' : 'white',
                }}
                onMouseEnter={e => { if (!(selectedType === 'truck' && !selectedSubtype)) (e.currentTarget as HTMLElement).style.background = '#004494' }}
                onMouseLeave={e => { if (!(selectedType === 'truck' && !selectedSubtype)) (e.currentTarget as HTMLElement).style.background = '#0057B8' }}
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
                {workingDays.map(day => {
                  const dateStr = toDateString(day)
                  const slots = getSlotsForDay(dateStr, selectedType, selectedSubtype)
                  const available = slots.filter(s => !s.taken).length
                  const isSelected = dateStr === selectedDate

                  return (
                    <button
                      key={dateStr}
                      onClick={() => { setSelectedDate(dateStr); setStep('time') }}
                      disabled={available === 0}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all duration-150"
                      style={{
                        background: isSelected ? '#0057B820' : '#0a1220',
                        border: `1.5px solid ${isSelected ? '#0057B8' : '#1a2d45'}`,
                        opacity: available === 0 ? 0.4 : 1,
                        cursor: available === 0 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <div className="text-left">
                        <p className="font-bold" style={{ color: isSelected ? '#5a9fe0' : 'white' }}>{getDayName(dateStr)}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>{formatDate(dateStr)}</p>
                      </div>
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{
                          background: available === 0 ? '#0f1c2e' : '#0057B820',
                          color: available === 0 ? '#3a5070' : '#0057B8',
                        }}
                      >
                        {available === 0 ? 'Completo' : `${available} huecos`}
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
                        onClick={() => { setSelectedSlot(time); setStep('confirm') }}
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
                        onClick={() => { setSelectedSlot(time); setStep('confirm') }}
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
                      const end = h * 60 + m + SLOT_DURATION
                      return `${selectedSlot} – ${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
                    })()
                  },
                  { label: 'Tipo', value: getPracticeLabel(selectedType, selectedSubtype) },
                  { label: 'Duración', value: '45 minutos' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center text-sm">
                    <span style={{ color: '#6b8ab0' }}>{label}</span>
                    <span className="font-bold text-white">{value}</span>
                  </div>
                ))}
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
                disabled={submitting}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition"
                style={{ background: submitting ? '#1a2d45' : '#0057B8', color: submitting ? '#3a5070' : 'white' }}
                onMouseEnter={e => { if (!submitting) (e.currentTarget as HTMLElement).style.background = '#004494' }}
                onMouseLeave={e => { if (!submitting) (e.currentTarget as HTMLElement).style.background = '#0057B8' }}
              >
                {submitting ? 'Confirmando...' : '✓ Confirmar práctica'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
