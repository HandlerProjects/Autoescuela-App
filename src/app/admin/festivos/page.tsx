'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, getDayName, toDateString } from '@/lib/utils'
import { getInstructorSessions, type ScheduleOverride, type Session } from '@/lib/horarios'
import type { BlockedDay, BlockedSlot, Instructor } from '@/types'

interface AffectedBooking {
  id: string
  time: string
  endTime: string
  studentName: string
  practiceLabel: string
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

export default function FestivosPage() {
  const supabase = createClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [selectedInstructorId, setSelectedInstructorId] = useState<string | null>(null)
  const [isOwnInstructor, setIsOwnInstructor] = useState(false)
  const [blockedDays, setBlockedDays] = useState<BlockedDay[]>([])
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const [reason, setReason] = useState('')
  const [savingDay, setSavingDay] = useState(false)

  const [showSlotForm, setShowSlotForm] = useState(false)
  const [blockStart, setBlockStart] = useState('')
  const [blockEnd, setBlockEnd] = useState('')
  const [blockReason, setBlockReason] = useState('')
  const [savingSlot, setSavingSlot] = useState(false)

  // Horario especial de un día suelto: franjas propias y descanso propio, solo para esa fecha.
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([])
  const [editingSchedule, setEditingSchedule] = useState(false)
  const [formSessions, setFormSessions] = useState<Session[]>([])
  const [formBreak, setFormBreak] = useState<number | null>(null)
  const [formReason, setFormReason] = useState('')
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [scheduleError, setScheduleError] = useState('')
  // Clases que quedarían fuera del nuevo horario, pendientes de que el profesor las confirme.
  const [affected, setAffected] = useState<AffectedBooking[] | null>(null)

  useEffect(() => { initUser() }, [])
  useEffect(() => { if (selectedInstructorId) fetchData() }, [currentMonth, currentYear, selectedInstructorId])

  async function initUser() {
    // Identidad/rol vía /api/auth/me (getSessionUser canónico) en vez de consultar
    // instructors directamente — reduce esto a 1 salto de red para instructor y 2 para
    // admin (antes eran 2 y 3, con dos queries distintas a instructors).
    const meRes = await fetch('/api/auth/me')
    if (!meRes.ok) return
    const me = await meRes.json()

    if (me.role === 'instructor') {
      // Es un instructor — gestiona solo sus propios bloqueos
      setIsOwnInstructor(true)
      setSelectedInstructorId(me.id)
    } else {
      // Es admin (u otro rol no instructor) — puede gestionar cualquier instructor
      const res = await fetch('/api/profesores/list')
      if (res.ok) {
        const { instructors: allInstructors } = await res.json()
        if (allInstructors && allInstructors.length > 0) {
          setInstructors(allInstructors)
          setSelectedInstructorId(allInstructors[0].id)
        }
      }
    }
  }

  async function fetchData() {
    if (!selectedInstructorId) return
    setLoading(true)
    const from = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
    const lastDay = getDaysInMonth(currentYear, currentMonth)
    const to = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const [{ data: daysData }, { data: slotsData }] = await Promise.all([
      supabase.from('blocked_days').select('*')
        .eq('instructor_id', selectedInstructorId)
        .gte('date', from).lte('date', to)
        .order('date', { ascending: true }),
      supabase.from('blocked_slots').select('*')
        .eq('instructor_id', selectedInstructorId)
        .gte('date', from).lte('date', to)
        .order('date', { ascending: true }).order('start_time', { ascending: true }),
    ])

    if (daysData) setBlockedDays(daysData)
    if (slotsData) setBlockedSlots(slotsData)

    const res = await fetch(`/api/horarios/list?from=${from}&to=${to}&instructorId=${selectedInstructorId}`)
    if (res.ok) {
      const { overrides: data } = await res.json()
      setOverrides(data ?? [])
    }

    setLoading(false)
  }

  function overrideFor(dateStr: string): ScheduleOverride | null {
    return overrides.find(o => o.date === dateStr) ?? null
  }

  /** Abre el editor partiendo del horario que rige hoy ese día, para retocarlo en vez de escribirlo de cero. */
  function startEditingSchedule(dateStr: string) {
    const existing = overrideFor(dateStr)
    setFormSessions(existing?.sessions ?? getInstructorSessions(selectedInstructor))
    setFormBreak(existing?.break_minutes ?? null)
    setFormReason(existing?.reason ?? '')
    setScheduleError('')
    setAffected(null)
    setEditingSchedule(true)
  }

  /**
   * Primera llamada sin confirmar: solo pregunta qué clases quedarían fuera. Si hay alguna, se
   * enseñan y se espera confirmación. Si no hay ninguna, se guarda directamente.
   */
  async function saveSchedule(confirm: boolean) {
    if (!selectedDate || !selectedInstructorId) return
    setSavingSchedule(true)
    setScheduleError('')

    const res = await fetch('/api/horarios/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instructorId: selectedInstructorId,
        date: selectedDate,
        sessions: formSessions,
        breakMinutes: formBreak,
        reason: formReason.trim() || null,
        confirm,
      }),
    })

    const data = await res.json().catch(() => ({}))
    setSavingSchedule(false)

    if (!res.ok) {
      setScheduleError(data.error ?? 'No se pudo guardar el horario')
      return
    }

    if (data.preview) {
      if ((data.affected ?? []).length === 0) {
        await saveSchedule(true)
        return
      }
      setAffected(data.affected)
      return
    }

    setAffected(null)
    setEditingSchedule(false)
    await fetchData()
  }

  async function removeSchedule(dateStr: string) {
    if (!selectedInstructorId) return
    setSavingSchedule(true)
    await fetch('/api/horarios/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instructorId: selectedInstructorId, date: dateStr, remove: true }),
    })
    setSavingSchedule(false)
    setEditingSchedule(false)
    await fetchData()
  }

  function isBlockedDay(dateStr: string) {
    return blockedDays.some(b => b.date === dateStr)
  }

  function selectDate(dateStr: string) {
    setSelectedDate(prev => prev === dateStr ? null : dateStr)
    setReason('')
    setShowSlotForm(false)
    setBlockStart('')
    setBlockEnd('')
    setBlockReason('')
    setEditingSchedule(false)
    setAffected(null)
    setScheduleError('')
  }

  function switchInstructor(id: string) {
    setSelectedInstructorId(id)
    setSelectedDate(null)
    setShowSlotForm(false)
  }

  async function blockDay() {
    if (!selectedDate || !selectedInstructorId) return
    setSavingDay(true)

    const { data } = await supabase.from('blocked_days').insert({
      instructor_id: selectedInstructorId,
      date: selectedDate,
      reason: reason.trim() || null,
    }).select().single()

    if (data) {
      setBlockedDays(prev => [...prev, data])
      // Cancela reservas de ese día y notifica a los alumnos afectados
      fetch('/api/cancel-slot-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorId: selectedInstructorId,
          date: selectedDate,
          startTime: '00:00:00',
          endTime: '23:59:59',
          reason: reason.trim() || 'Día bloqueado',
        }),
      }).catch(() => {})
    }

    setReason('')
    setSavingDay(false)
  }

  async function unblockDay(dateStr: string) {
    if (!selectedInstructorId) return
    await supabase.from('blocked_days').delete()
      .eq('date', dateStr)
      .eq('instructor_id', selectedInstructorId)
    setBlockedDays(prev => prev.filter(b => b.date !== dateStr))
  }

  async function saveBlockedSlot() {
    if (!selectedDate || !selectedInstructorId || !blockStart || !blockEnd || blockStart >= blockEnd) return
    setSavingSlot(true)

    const { data: newSlot } = await supabase.from('blocked_slots').insert({
      instructor_id: selectedInstructorId,
      date: selectedDate,
      start_time: blockStart,
      end_time: blockEnd,
      reason: blockReason.trim() || null,
    }).select().single()

    if (newSlot) setBlockedSlots(prev => [...prev, newSlot])

    // Cancela reservas en ese rango y notifica a los alumnos
    fetch('/api/cancel-slot-bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instructorId: selectedInstructorId,
        date: selectedDate,
        startTime: blockStart,
        endTime: blockEnd,
        reason: blockReason.trim() || null,
      }),
    }).catch(() => {})

    setBlockStart('')
    setBlockEnd('')
    setBlockReason('')
    setShowSlotForm(false)
    setSavingSlot(false)
  }

  async function deleteBlockedSlot(id: string) {
    await supabase.from('blocked_slots').delete().eq('id', id)
    setBlockedSlots(prev => prev.filter(b => b.id !== id))
  }

  function prevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
    else setCurrentMonth(m => m - 1)
    setSelectedDate(null)
  }

  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
    else setCurrentMonth(m => m + 1)
    setSelectedDate(null)
  }

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
  const selectedInstructor = instructors.find(i => i.id === selectedInstructorId)

  return (
    <div className="p-8">

      {/* Cabecera */}
      <div className="mb-8">
        <p className="text-sm font-medium mb-1" style={{ color: '#0057B8' }}>Configuración</p>
        <h1 className="text-3xl font-black text-white tracking-tight">Festivos y horarios</h1>
        <p className="text-sm mt-1" style={{ color: '#6b8ab0' }}>Bloquea días completos o franjas horarias específicas</p>
      </div>

      {/* Selector de instructor (solo admin, si hay más de uno) */}
      {!isOwnInstructor && instructors.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {instructors.map(inst => (
            <button
              key={inst.id}
              onClick={() => switchInstructor(inst.id)}
              className="px-4 py-2 rounded-xl text-sm font-bold transition"
              style={{
                background: selectedInstructorId === inst.id ? '#0057B8' : '#0d1829',
                color: selectedInstructorId === inst.id ? 'white' : '#6b8ab0',
                border: `1.5px solid ${selectedInstructorId === inst.id ? '#0057B8' : '#1a2d45'}`,
              }}
            >
              {inst.name}
            </button>
          ))}
        </div>
      )}

      {!selectedInstructorId ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          <p className="text-white font-semibold">Cargando profesores...</p>
        </div>
      ) : (
        <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 1fr' }}>

          {/* Calendario */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>

            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1a2d45' }}>
              <button onClick={prevMonth} style={{ color: '#6b8ab0' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#6b8ab0'}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="text-center">
                <p className="text-white font-black">{MONTHS[currentMonth]} {currentYear}</p>
                {selectedInstructor && (
                  <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>{selectedInstructor.name}</p>
                )}
              </div>
              <button onClick={nextMonth} style={{ color: '#6b8ab0' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#6b8ab0'}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-7 px-3 pt-3">
              {DAYS.map(d => (
                <div key={d} className="text-center text-xs font-bold py-1.5" style={{ color: '#3a5070' }}>{d}</div>
              ))}
            </div>

            {loading ? (
              <div className="px-5 py-8 text-center text-sm" style={{ color: '#3a5070' }}>Cargando...</div>
            ) : (
              <div className="grid grid-cols-7 gap-1 px-3 pb-3">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const date = new Date(currentYear, currentMonth, day)
                  const dateStr = toDateString(date)
                  const blocked = isBlockedDay(dateStr)
                  const isSelected = dateStr === selectedDate
                  const isToday = dateStr === toDateString(today)
                  const slotCount = blockedSlots.filter(s => s.date === dateStr).length

                  return (
                    <button
                      key={day}
                      onClick={() => selectDate(dateStr)}
                      className="rounded-lg text-sm font-bold py-2 transition-all duration-150 relative"
                      style={{
                        background: isSelected
                          ? blocked ? 'rgba(239,68,68,0.2)' : '#0057B820'
                          : blocked ? 'rgba(239,68,68,0.1)' : 'transparent',
                        color: blocked ? '#f87171' : isSelected ? '#0057B8' : isToday ? '#0057B8' : '#a0b8d0',
                        border: `1.5px solid ${isSelected ? (blocked ? 'rgba(239,68,68,0.5)' : '#0057B840') : 'transparent'}`,
                        textDecoration: blocked ? 'line-through' : 'none',
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = blocked ? 'rgba(239,68,68,0.15)' : '#0057B810' }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = blocked ? 'rgba(239,68,68,0.1)' : 'transparent' }}
                    >
                      {day}
                      {slotCount > 0 && !blocked && (
                        <span className="absolute bottom-0.5 right-1" style={{ color: '#f87171', fontSize: '8px' }}>●</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Leyenda */}
            <div className="px-5 py-3 flex items-center gap-4 flex-wrap" style={{ borderTop: '1px solid #1a2d45' }}>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(239,68,68,0.5)' }} />
                <p className="text-xs" style={{ color: '#3a5070' }}>Día bloqueado</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span style={{ color: '#f87171', fontSize: '8px' }}>●</span>
                <p className="text-xs" style={{ color: '#3a5070' }}>Franja bloqueada</p>
              </div>
            </div>
          </div>

          {/* Panel derecho */}
          <div>
            {!selectedDate ? (
              <div className="rounded-2xl p-12 text-center h-full flex flex-col items-center justify-center" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
                <svg className="w-12 h-12 mx-auto mb-4" style={{ color: '#1a2d45' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <p className="text-white font-semibold">Selecciona un día</p>
                <p className="text-sm mt-1" style={{ color: '#3a5070' }}>Pincha en cualquier día del calendario para bloquearlo o añadir franjas horarias</p>
              </div>
            ) : (
              <div className="space-y-4">

                {/* Cabecera fecha seleccionada */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-black text-lg">{getDayName(selectedDate)}</p>
                    <p className="text-sm" style={{ color: '#6b8ab0' }}>{formatDate(selectedDate)}</p>
                  </div>
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="p-2 rounded-lg transition"
                    style={{ color: '#3a5070' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#3a5070'}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Sección 1: Día completo */}
                <div className="rounded-2xl overflow-hidden" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
                  <div className="px-5 py-3" style={{ background: '#0a1220', borderBottom: '1px solid #1a2d45' }}>
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f87171' }}>🚫 Día completo</p>
                  </div>
                  {isBlockedDay(selectedDate) ? (
                    <div className="px-5 py-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold" style={{ color: '#f87171' }}>Día bloqueado</p>
                        <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>
                          {blockedDays.find(b => b.date === selectedDate)?.reason ?? 'Sin motivo'}
                        </p>
                      </div>
                      <button
                        onClick={() => unblockDay(selectedDate)}
                        className="text-xs px-3 py-1.5 rounded-lg font-bold transition flex-shrink-0"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.2)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'}
                      >
                        Desbloquear
                      </button>
                    </div>
                  ) : (
                    <div className="px-5 py-4 space-y-3">
                      <p className="text-xs" style={{ color: '#6b8ab0' }}>
                        Los alumnos no podrán reservar ese día y se notificará a los que tenían práctica confirmada
                      </p>
                      <input
                        type="text"
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder="Motivo (ej: Festivo, Vacaciones...)"
                        className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                        style={{ background: '#0a1220', border: '1.5px solid #1a2d45' }}
                        onFocus={e => e.target.style.borderColor = '#f87171'}
                        onBlur={e => e.target.style.borderColor = '#1a2d45'}
                      />
                      <button
                        onClick={blockDay}
                        disabled={savingDay}
                        className="w-full py-2.5 rounded-xl text-sm font-bold transition"
                        style={{ background: savingDay ? '#1a2d45' : '#ef4444', color: savingDay ? '#3a5070' : 'white' }}
                      >
                        {savingDay ? 'Guardando...' : '🚫 Bloquear día completo'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Sección 2: Franjas horarias */}
                <div className="rounded-2xl overflow-hidden" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
                  <div className="px-5 py-3 flex items-center justify-between" style={{ background: '#0a1220', borderBottom: '1px solid #1a2d45' }}>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f87171' }}>🔒 Franjas horarias</p>
                      {blockedSlots.filter(b => b.date === selectedDate).length > 0 && (
                        <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>
                          {blockedSlots.filter(b => b.date === selectedDate).length} franja{blockedSlots.filter(b => b.date === selectedDate).length > 1 ? 's' : ''} bloqueada{blockedSlots.filter(b => b.date === selectedDate).length > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    {!isBlockedDay(selectedDate) && (
                      <button
                        onClick={() => { setShowSlotForm(v => !v); setBlockStart(''); setBlockEnd(''); setBlockReason('') }}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg transition"
                        style={{
                          background: showSlotForm ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)',
                          color: '#f87171',
                          border: '1px solid rgba(239,68,68,0.2)',
                        }}
                      >
                        {showSlotForm ? '✕ Cancelar' : '+ Nueva franja'}
                      </button>
                    )}
                  </div>

                  {showSlotForm && !isBlockedDay(selectedDate) && (
                    <div className="px-5 py-4 space-y-4" style={{ background: 'rgba(239,68,68,0.03)', borderBottom: '1px solid rgba(239,68,68,0.1)' }}>

                      <div>
                        <p className="text-xs font-semibold mb-2" style={{ color: '#6b8ab0' }}>Accesos rápidos</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: '☀️ Mañana entera', start: '08:00', end: '14:00' },
                            { label: '🌆 Tarde entera', start: '16:00', end: '19:30' },
                            { label: '🕐 Primera hora', start: '08:00', end: '10:00' },
                            { label: '🕔 Última hora', start: '18:00', end: '19:30' },
                          ].map(preset => (
                            <button
                              key={preset.label}
                              onClick={() => { setBlockStart(preset.start); setBlockEnd(preset.end) }}
                              className="py-2 px-3 rounded-xl text-xs font-semibold text-left transition"
                              style={{
                                background: blockStart === preset.start && blockEnd === preset.end ? 'rgba(239,68,68,0.15)' : '#0a1220',
                                border: `1.5px solid ${blockStart === preset.start && blockEnd === preset.end ? 'rgba(239,68,68,0.4)' : '#1a2d45'}`,
                                color: blockStart === preset.start && blockEnd === preset.end ? '#f87171' : '#6b8ab0',
                              }}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold mb-2" style={{ color: '#6b8ab0' }}>O elige horas exactas</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs mb-1" style={{ color: '#3a5070' }}>Desde</p>
                            <input
                              type="time"
                              value={blockStart}
                              onChange={e => setBlockStart(e.target.value)}
                              className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                              style={{ background: '#0a1220', border: '1.5px solid #1a2d45' }}
                            />
                          </div>
                          <div>
                            <p className="text-xs mb-1" style={{ color: '#3a5070' }}>Hasta</p>
                            <input
                              type="time"
                              value={blockEnd}
                              onChange={e => setBlockEnd(e.target.value)}
                              className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                              style={{ background: '#0a1220', border: '1.5px solid #1a2d45' }}
                            />
                          </div>
                        </div>
                      </div>

                      <input
                        type="text"
                        value={blockReason}
                        onChange={e => setBlockReason(e.target.value)}
                        placeholder="Motivo (ej: Médico, Examen teórico...)"
                        className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                        style={{ background: '#0a1220', border: '1.5px solid #1a2d45' }}
                      />

                      {blockStart && blockEnd && blockStart < blockEnd && (
                        <div className="rounded-xl px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                          <span style={{ color: '#f87171' }}>🔒</span>
                          <p className="text-sm font-bold" style={{ color: '#f87171' }}>
                            {blockStart} – {blockEnd}
                            {blockReason && <span className="font-normal text-xs ml-2" style={{ opacity: 0.7 }}>· {blockReason}</span>}
                          </p>
                        </div>
                      )}

                      <button
                        onClick={saveBlockedSlot}
                        disabled={savingSlot || !blockStart || !blockEnd || blockStart >= blockEnd}
                        className="w-full py-3 rounded-xl text-sm font-bold transition"
                        style={{
                          background: savingSlot || !blockStart || !blockEnd || blockStart >= blockEnd ? '#1a2d45' : '#ef4444',
                          color: savingSlot || !blockStart || !blockEnd || blockStart >= blockEnd ? '#3a5070' : 'white',
                        }}
                      >
                        {savingSlot ? 'Guardando...' : '🔒 Confirmar bloqueo'}
                      </button>
                    </div>
                  )}

                  {blockedSlots.filter(b => b.date === selectedDate).length === 0 ? (
                    <div className="px-5 py-6 text-center">
                      <p className="text-xs" style={{ color: '#1a2d45' }}>Sin franjas bloqueadas para este día</p>
                    </div>
                  ) : (
                    <div className="divide-y" style={{ borderColor: '#0f1c2e' }}>
                      {blockedSlots.filter(b => b.date === selectedDate).map(slot => (
                        <div key={slot.id} className="px-5 py-3.5 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm" style={{ background: 'rgba(239,68,68,0.1)' }}>
                            🔒
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-black" style={{ color: '#f87171' }}>
                              {slot.start_time.substring(0, 5)} – {slot.end_time.substring(0, 5)}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>{slot.reason ?? 'Sin motivo'}</p>
                          </div>
                          <button
                            onClick={() => deleteBlockedSlot(slot.id)}
                            className="text-xs px-3 py-1.5 rounded-lg font-bold transition"
                            style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'}
                          >
                            Eliminar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sección 3: Horario especial de este día */}
                {!isBlockedDay(selectedDate) && (() => {
                  const current = overrideFor(selectedDate)
                  const habitual = getInstructorSessions(selectedInstructor)

                  return (
                    <div className="rounded-2xl overflow-hidden" style={{ background: '#0d1829', border: `1px solid ${current ? '#0057B840' : '#1a2d45'}` }}>
                      <div className="px-5 py-3 flex items-center justify-between" style={{ background: '#0a1220', borderBottom: '1px solid #1a2d45' }}>
                        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0057B8' }}>🕐 Horario de este día</p>
                        {current && !editingSchedule && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#0057B820', color: '#0057B8' }}>
                            Especial
                          </span>
                        )}
                      </div>

                      {!editingSchedule ? (
                        <div className="px-5 py-4 space-y-3">
                          <div className="flex flex-wrap gap-2">
                            {(current?.sessions ?? habitual).map((s, i) => (
                              <span
                                key={i}
                                className="text-sm font-bold px-3 py-1.5 rounded-lg"
                                style={{
                                  background: current ? '#0057B820' : '#0a1220',
                                  color: current ? '#4d9ff5' : '#a0b8d0',
                                  border: `1px solid ${current ? '#0057B840' : '#1a2d45'}`,
                                }}
                              >
                                {s.start} – {s.end}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs" style={{ color: '#3a5070' }}>
                            Descanso entre prácticas:{' '}
                            <span className="font-bold" style={{ color: '#6b8ab0' }}>
                              {current?.break_minutes ?? selectedInstructor?.break_minutes ?? 10} min
                            </span>
                            {current?.reason && <> · {current.reason}</>}
                          </p>
                          {!current && (
                            <p className="text-xs" style={{ color: '#3a5070' }}>
                              Es su horario de siempre. Cámbialo solo para este día si entra antes, sale más tarde o acorta los descansos.
                            </p>
                          )}

                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => startEditingSchedule(selectedDate)}
                              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition"
                              style={{ background: '#0057B8' }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#004494'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#0057B8'}
                            >
                              {current ? 'Modificar' : 'Cambiar solo este día'}
                            </button>
                            {current && (
                              <button
                                onClick={() => removeSchedule(selectedDate)}
                                disabled={savingSchedule}
                                className="px-4 py-2.5 rounded-xl text-xs font-bold transition"
                                style={{ color: '#6b8ab0', border: '1px solid #1a2d45' }}
                              >
                                Volver al normal
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="px-5 py-4 space-y-4">
                          <div className="space-y-2">
                            {formSessions.map((s, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <input
                                  type="time"
                                  value={s.start}
                                  onChange={e => setFormSessions(f => f.map((x, j) => j === i ? { ...x, start: e.target.value } : x))}
                                  className="flex-1 rounded-xl px-3 py-2 text-white text-sm outline-none"
                                  style={{ background: '#0a1220', border: '1.5px solid #1a2d45' }}
                                />
                                <span className="text-xs" style={{ color: '#3a5070' }}>a</span>
                                <input
                                  type="time"
                                  value={s.end}
                                  onChange={e => setFormSessions(f => f.map((x, j) => j === i ? { ...x, end: e.target.value } : x))}
                                  className="flex-1 rounded-xl px-3 py-2 text-white text-sm outline-none"
                                  style={{ background: '#0a1220', border: '1.5px solid #1a2d45' }}
                                />
                                <button
                                  onClick={() => setFormSessions(f => f.filter((_, j) => j !== i))}
                                  disabled={formSessions.length === 1}
                                  className="px-2.5 py-2 rounded-lg text-xs font-bold transition flex-shrink-0"
                                  style={{
                                    color: formSessions.length === 1 ? '#1a2d45' : '#f87171',
                                    border: '1px solid #1a2d45',
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => setFormSessions(f => [...f, { start: '16:00', end: '19:00' }])}
                              className="w-full py-2 rounded-xl text-xs font-bold transition"
                              style={{ color: '#6b8ab0', border: '1px dashed #1a2d45' }}
                            >
                              + Añadir franja
                            </button>
                            {/* El hueco entre dos franjas es descanso: así se monta el café de media hora
                                sin tener que configurar nada aparte. */}
                            <p className="text-xs" style={{ color: '#3a5070' }}>
                              El tiempo entre una franja y la siguiente es descanso.
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-semibold mb-2" style={{ color: '#6b8ab0' }}>Descanso entre prácticas</p>
                            <div className="flex gap-2 flex-wrap">
                              {[null, 0, 5, 10, 15, 20, 30].map(mins => (
                                <button
                                  key={String(mins)}
                                  onClick={() => setFormBreak(mins)}
                                  className="px-3 py-2 rounded-lg text-xs font-bold transition"
                                  style={{
                                    background: formBreak === mins ? '#0057B820' : '#0a1220',
                                    border: `2px solid ${formBreak === mins ? '#0057B8' : '#1a2d45'}`,
                                    color: formBreak === mins ? '#0057B8' : '#3a5070',
                                  }}
                                >
                                  {mins === null ? 'El de siempre' : mins === 0 ? 'Sin descanso' : `${mins} min`}
                                </button>
                              ))}
                            </div>
                          </div>

                          <input
                            type="text"
                            value={formReason}
                            onChange={e => setFormReason(e.target.value)}
                            placeholder="Motivo (ej: Fiestas, asunto familiar...)"
                            className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                            style={{ background: '#0a1220', border: '1.5px solid #1a2d45' }}
                          />

                          {scheduleError && (
                            <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                              {scheduleError}
                            </p>
                          )}

                          <div className="flex gap-2">
                            <button
                              onClick={() => { setEditingSchedule(false); setAffected(null) }}
                              disabled={savingSchedule}
                              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition"
                              style={{ background: '#0a1220', color: '#6b8ab0', border: '1px solid #1a2d45' }}
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => saveSchedule(false)}
                              disabled={savingSchedule}
                              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition"
                              style={{ background: '#0057B8', opacity: savingSchedule ? 0.6 : 1 }}
                            >
                              {savingSchedule ? 'Comprobando...' : 'Guardar horario'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}

              </div>
            )}
          </div>
        </div>
      )}

      {/* ── AVISO: clases que se pierden con el nuevo horario ── */}
      {/* No se guarda nada hasta que alguien ve exactamente qué alumnos se quedan sin clase. */}
      {affected && affected.length > 0 && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={() => { if (!savingSchedule) setAffected(null) }}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="w-full max-w-md rounded-2xl overflow-hidden pointer-events-auto"
              style={{ background: '#0d1829', border: '2px solid #dc2626' }}
            >
              <div className="px-5 py-4" style={{ background: 'rgba(220,38,38,0.12)', borderBottom: '1px solid rgba(220,38,38,0.3)' }}>
                <p className="font-black text-lg" style={{ color: '#f87171' }}>
                  ⚠️ Se cancelarán {affected.length} {affected.length === 1 ? 'clase' : 'clases'}
                </p>
                <p className="text-xs mt-1" style={{ color: '#fca5a5' }}>
                  Con este horario estos alumnos se quedan fuera de tu jornada
                </p>
              </div>

              <div className="max-h-64 overflow-y-auto">
                {affected.map(b => (
                  <div key={b.id} className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid #0f1c2e' }}>
                    <p className="text-sm font-black font-mono w-24 flex-shrink-0" style={{ color: '#f87171' }}>
                      {b.time}–{b.endTime}
                    </p>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{b.studentName}</p>
                      <p className="text-xs" style={{ color: '#3a5070' }}>{b.practiceLabel}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-5 py-4 space-y-3" style={{ borderTop: '1px solid #1a2d45' }}>
                <p className="text-xs" style={{ color: '#6b8ab0' }}>
                  Se les avisará por email y podrán reservar otro hueco. No se les descuenta ninguna práctica.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAffected(null)}
                    disabled={savingSchedule}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold transition"
                    style={{ background: '#0a1220', color: '#6b8ab0', border: '1px solid #1a2d45' }}
                  >
                    No, dejarlo como está
                  </button>
                  <button
                    onClick={() => saveSchedule(true)}
                    disabled={savingSchedule}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition"
                    style={{ background: '#dc2626', opacity: savingSchedule ? 0.6 : 1 }}
                  >
                    {savingSchedule ? 'Guardando...' : 'Sí, cambiar horario'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
