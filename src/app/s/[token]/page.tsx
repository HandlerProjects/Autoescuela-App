'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatTime, getDayName, toDateString, getPracticeLabel, generateTimeSlots } from '@/lib/utils'
import type { Student, Booking, PracticeType } from '@/types'

const SLOT_DURATION = 45

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

type Step = 'type' | 'date' | 'time' | 'confirm' | 'success'

export default function StudentPage() {
  const params = useParams()
  const token = params.token as string
  const supabase = createClient()

  const [student, setStudent] = useState<Student | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [myBookings, setMyBookings] = useState<Booking[]>([])
  const [takenSlots, setTakenSlots] = useState<{ date: string; start: string; type: PracticeType }[]>([])

  const [step, setStep] = useState<Step>('type')
  const [selectedType, setSelectedType] = useState<PracticeType>('car')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedSlot, setSelectedSlot] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

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
    await Promise.all([fetchMyBookings(data.id), fetchTakenSlots(data.instructor_id)])
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

  async function fetchTakenSlots(instructorId: string) {
    const from = toDateString(workingDays[0])
    const to = toDateString(workingDays[workingDays.length - 1])
    const { data } = await supabase
      .from('bookings')
      .select('practice_date, start_time, practice_type')
      .eq('instructor_id', instructorId)
      .gte('practice_date', from)
      .lte('practice_date', to)
      .neq('status', 'cancelled')
    if (data) {
      setTakenSlots(data.map(b => ({
        date: b.practice_date,
        start: b.start_time.substring(0, 5),
        type: b.practice_type,
      })))
    }
  }

  function isSlotTaken(date: string, slot: string, type: PracticeType) {
    return takenSlots.some(t => t.date === date && t.start === slot && t.type === type)
  }

  function getSlotsForDay(date: string, type: PracticeType) {
    return generateTimeSlots(type).map(slot => ({
      time: slot,
      taken: isSlotTaken(date, slot, type),
    }))
  }

  async function confirmBooking() {
    if (!student || !selectedDate || !selectedSlot) return
    setSubmitting(true)
    setSubmitError('')

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
      status: 'confirmed',
    })

    if (error) {
      setSubmitError('No se pudo confirmar la reserva. Inténtalo de nuevo.')
      setSubmitting(false)
      return
    }

    await fetchMyBookings(student.id)
    await fetchTakenSlots(student.instructor_id)
    setStep('success')
    setSubmitting(false)
  }

  function resetBooking() {
    setStep('type')
    setSelectedDate('')
    setSelectedSlot('')
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

  return (
    <div className="min-h-screen pb-12" style={{ background: '#0a0f1a' }}>

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
              {myBookings.map(booking => (
                <div
                  key={booking.id}
                  className="rounded-xl px-4 py-3 flex items-center gap-3"
                  style={{ background: '#0d1829', border: '1px solid #1a2d45' }}
                >
                  <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: booking.practice_type === 'car' ? '#0057B8' : '#38bdf8' }} />
                  <div className="flex-1">
                    <p className="text-white text-sm font-bold">
                      {getDayName(booking.practice_date)}, {formatDate(booking.practice_date)}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>
                      {formatTime(booking.start_time)} – {formatTime(booking.end_time)} · {getPracticeLabel(booking.practice_type)}
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>
                    Confirmada
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nueva reserva */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#0057B8' }}>
            Nueva reserva
          </p>

          {/* SUCCESS */}
          {step === 'success' && (
            <div className="rounded-2xl p-8 text-center" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(52,211,153,0.1)' }}>
                <svg className="w-8 h-8" style={{ color: '#34d399' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-black text-xl">¡Reserva confirmada!</p>
              <p className="text-sm mt-2" style={{ color: '#6b8ab0' }}>
                {getDayName(selectedDate)}, {formatDate(selectedDate)}
              </p>
              <p className="text-sm" style={{ color: '#6b8ab0' }}>
                {selectedSlot} · {getPracticeLabel(selectedType)} · 45 min
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

          {/* STEP: type */}
          {step === 'type' && (
            <div className="rounded-2xl p-5 space-y-4" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
              <p className="text-white font-bold">¿Qué tipo de práctica?</p>
              <div className="grid grid-cols-2 gap-3">
                {student.practice_types.map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className="py-4 rounded-xl text-sm font-bold transition-all duration-150"
                    style={{
                      background: selectedType === type
                        ? type === 'car' ? '#0057B820' : '#38bdf820'
                        : '#0a1220',
                      border: `2px solid ${selectedType === type
                        ? type === 'car' ? '#0057B8' : '#38bdf8'
                        : '#1a2d45'}`,
                      color: selectedType === type
                        ? type === 'car' ? '#0057B8' : '#38bdf8'
                        : '#3a5070',
                    }}
                  >
                    {type === 'car' ? '🚗' : '🚛'} {getPracticeLabel(type)}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep('date')}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition"
                style={{ background: '#0057B8' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#004494'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#0057B8'}
              >
                Continuar →
              </button>
            </div>
          )}

          {/* STEP: date */}
          {step === 'date' && (
            <div className="rounded-2xl p-5 space-y-4" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
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
                  const slots = getSlotsForDay(dateStr, selectedType)
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
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{
                        background: available === 0 ? '#0f1c2e' : '#0057B820',
                        color: available === 0 ? '#3a5070' : '#0057B8',
                      }}>
                        {available === 0 ? 'Completo' : `${available} huecos`}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP: time */}
          {step === 'time' && selectedDate && (
            <div className="rounded-2xl p-5 space-y-4" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
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
                  {getSlotsForDay(selectedDate, selectedType)
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
                  {getSlotsForDay(selectedDate, selectedType)
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

          {/* STEP: confirm */}
          {step === 'confirm' && (
            <div className="rounded-2xl p-5 space-y-4" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
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
                  { label: 'Hora', value: (() => {
                    const [h, m] = selectedSlot.split(':').map(Number)
                    const end = h * 60 + m + SLOT_DURATION
                    return `${selectedSlot} – ${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
                  })() },
                  { label: 'Tipo', value: getPracticeLabel(selectedType) },
                  { label: 'Duración', value: '45 minutos' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center text-sm">
                    <span style={{ color: '#6b8ab0' }}>{label}</span>
                    <span className="font-bold text-white">{value}</span>
                  </div>
                ))}
              </div>

              {submitError && (
                <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
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