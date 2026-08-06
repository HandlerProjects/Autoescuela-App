'use client'

import { useEffect, useState } from 'react'
import { toDateString, getDuration, getBreak, getPracticeLabel } from '@/lib/utils'
import type { Instructor, PracticeType, PracticeSubtype } from '@/types'

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DAY_LABELS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

type BookingRow = {
  instructor_id: string
  practice_date: string
  practice_type: PracticeType
  practice_subtype: PracticeSubtype | null
  status: string
  pickup_location: string | null
  student: { full_name: string; order_number: number } | null
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function formatMinutes(mins: number): string {
  if (mins === 0) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

function calcPracticeTime(bookings: BookingRow[]): number {
  return bookings.reduce((acc, b) => acc + getDuration(b.practice_type, b.practice_subtype ?? undefined), 0)
}

function calcBreakTime(bookings: BookingRow[]): number {
  if (bookings.length <= 1) return 0
  return (bookings.length - 1) * getBreak(bookings[0].practice_type, bookings[0].practice_subtype ?? undefined)
}

function calcBreakTimeMixed(bookings: BookingRow[]): number {
  if (bookings.length <= 1) return 0
  return bookings.slice(0, -1).reduce((acc, b) => acc + getBreak(b.practice_type, b.practice_subtype ?? undefined), 0)
}

type ViewMode = 'week' | 'month'

export default function CuadrantePage() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart(today))
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [expandedCell, setExpandedCell] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [weekStart, currentMonth, currentYear, viewMode])

  async function fetchData() {
    setLoading(true)
    let from: string, to: string
    if (viewMode === 'week') {
      from = toDateString(weekStart)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      to = toDateString(weekEnd)
    } else {
      const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate()
      from = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
      to = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    }

    const res = await fetch(`/api/cuadrante/data?from=${from}&to=${to}`)
    if (res.status === 403) {
      setForbidden(true)
      setLoading(false)
      return
    }
    if (res.ok) {
      const data = await res.json()
      setInstructors(data.instructors ?? [])
      setBookings((data.bookings ?? []) as BookingRow[])
    }
    setLoading(false)
  }

  // Semana: 7 días desde weekStart
  const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  function bookingsFor(instructorId: string, dateStr: string) {
    return bookings.filter(b => b.instructor_id === instructorId && b.practice_date === dateStr)
  }

  function bookingsForInstructor(instructorId: string) {
    return bookings.filter(b => b.instructor_id === instructorId)
  }

  function bookingsForDate(dateStr: string) {
    return bookings.filter(b => b.practice_date === dateStr)
  }

  // Mes: agrupar por semana
  function getMonthWeeks(): Date[][] {
    const firstDay = new Date(currentYear, currentMonth, 1)
    const weekStartOfMonth = getWeekStart(firstDay)
    const weeks: Date[][] = []
    const cur = new Date(weekStartOfMonth)
    while (cur.getMonth() <= currentMonth || cur.getFullYear() < currentYear) {
      const week = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(cur)
        d.setDate(d.getDate() + i)
        return d
      })
      weeks.push(week)
      cur.setDate(cur.getDate() + 7)
      if (weeks.length > 6) break
    }
    return weeks
  }

  function prevPeriod() {
    if (viewMode === 'week') {
      const d = new Date(weekStart)
      d.setDate(d.getDate() - 7)
      setWeekStart(d)
    } else {
      if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
      else setCurrentMonth(m => m - 1)
    }
    setExpandedCell(null)
  }

  function nextPeriod() {
    if (viewMode === 'week') {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + 7)
      setWeekStart(d)
    } else {
      if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
      else setCurrentMonth(m => m + 1)
    }
    setExpandedCell(null)
  }

  function goToToday() {
    setWeekStart(getWeekStart(today))
    setCurrentMonth(today.getMonth())
    setCurrentYear(today.getFullYear())
    setExpandedCell(null)
  }

  const periodLabel = viewMode === 'week'
    ? (() => {
        const end = new Date(weekStart); end.setDate(end.getDate() + 6)
        return `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()].slice(0, 3)} – ${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`
      })()
    : `${MONTHS[currentMonth]} ${currentYear}`

  const todayStr = toDateString(today)

  if (forbidden) {
    return (
      <div className="p-8">
        <div className="rounded-2xl p-16 text-center" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          <p className="font-semibold text-white">No tienes acceso a esta sección</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">

      {/* Cabecera */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: '#0057B8' }}>Gestión</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Cuadrante de horas</h1>
          <p className="text-sm mt-1" style={{ color: '#6b8ab0' }}>Horas de práctica y descanso por profesor</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Toggle vista */}
          <div className="flex gap-1 rounded-xl p-1" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
            {(['week', 'month'] as const).map(v => (
              <button
                key={v}
                onClick={() => { setViewMode(v); setExpandedCell(null) }}
                className="px-4 py-1.5 rounded-lg text-xs font-bold transition"
                style={{
                  background: viewMode === v ? '#0057B8' : 'transparent',
                  color: viewMode === v ? 'white' : '#6b8ab0',
                }}
              >
                {v === 'week' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Navegación de período */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={prevPeriod}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition"
          style={{ background: '#0d1829', border: '1px solid #1a2d45', color: '#6b8ab0' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#6b8ab0'}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="text-white font-black text-lg min-w-[200px] text-center">{periodLabel}</p>
        <button
          onClick={nextPeriod}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition"
          style={{ background: '#0d1829', border: '1px solid #1a2d45', color: '#6b8ab0' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#6b8ab0'}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button
          onClick={goToToday}
          className="px-3 py-1.5 rounded-lg text-xs font-bold transition"
          style={{ background: '#0057B810', color: '#0057B8', border: '1px solid #0057B840' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#0057B820'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#0057B810'}
        >
          Hoy
        </button>
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: '#6b8ab0' }}>Cargando...</div>
      ) : viewMode === 'week' ? (
        <WeekView
          instructors={instructors}
          weekDays={weekDays}
          todayStr={todayStr}
          bookingsFor={bookingsFor}
          bookingsForInstructor={bookingsForInstructor}
          bookingsForDate={bookingsForDate}
          expandedCell={expandedCell}
          setExpandedCell={setExpandedCell}
        />
      ) : (
        <MonthView
          instructors={instructors}
          weeks={getMonthWeeks()}
          currentMonth={currentMonth}
          todayStr={todayStr}
          bookingsFor={bookingsFor}
          bookingsForInstructor={bookingsForInstructor}
        />
      )}
    </div>
  )
}

// ── Vista semanal ─────────────────────────────────────────────────────────────
function WeekView({
  instructors, weekDays, todayStr, bookingsFor, bookingsForInstructor, bookingsForDate, expandedCell, setExpandedCell
}: {
  instructors: Instructor[]
  weekDays: Date[]
  todayStr: string
  bookingsFor: (id: string, date: string) => BookingRow[]
  bookingsForInstructor: (id: string) => BookingRow[]
  bookingsForDate: (date: string) => BookingRow[]
  expandedCell: string | null
  setExpandedCell: (v: string | null) => void
}) {
  const weekDateStrs = weekDays.map(d => toDateString(d))

  return (
    <div className="space-y-4">
      {/* Tabla principal */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1a2d45' }}>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: '#3a5070', minWidth: '140px' }}>
                  Instructor
                </th>
                {weekDays.map((d, i) => {
                  const dateStr = weekDateStrs[i]
                  const isToday = dateStr === todayStr
                  const totalMins = calcPracticeTime(bookingsForDate(dateStr))
                  return (
                    <th key={dateStr} className="px-3 py-3 text-center" style={{ minWidth: '100px' }}>
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: isToday ? '#0057B8' : '#3a5070' }}>
                        {DAY_LABELS[i]}
                      </p>
                      <p className="text-xs font-black mt-0.5" style={{ color: isToday ? '#0057B8' : '#6b8ab0' }}>
                        {d.getDate()}
                      </p>
                      {totalMins > 0 && (
                        <p className="text-xs mt-0.5 font-semibold" style={{ color: '#3a5070' }}>
                          {formatMinutes(totalMins)}
                        </p>
                      )}
                    </th>
                  )
                })}
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider" style={{ color: '#0057B8', minWidth: '100px', borderLeft: '1px solid #1a2d45' }}>
                  Total semana
                </th>
              </tr>
            </thead>
            <tbody>
              {instructors.map((instructor, idx) => {
                const weekTotal = calcPracticeTime(bookingsForInstructor(instructor.id))
                const weekBreak = calcBreakTimeMixed(bookingsForInstructor(instructor.id))
                return (
                  <tr
                    key={instructor.id}
                    style={{ borderBottom: idx < instructors.length - 1 ? '1px solid #0f1c2e' : 'none' }}
                  >
                    {/* Nombre instructor */}
                    <td className="px-5 py-4">
                      <p className="text-white font-bold text-sm">{instructor.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>
                        {weekTotal > 0 ? `${formatMinutes(weekTotal)} práctica` : 'Sin prácticas'}
                      </p>
                    </td>

                    {/* Celdas por día */}
                    {weekDateStrs.map(dateStr => {
                      const dayBookings = bookingsFor(instructor.id, dateStr)
                      const practMins = calcPracticeTime(dayBookings)
                      const breakMins = calcBreakTimeMixed(dayBookings)
                      const isToday = dateStr === todayStr
                      const cellKey = `${instructor.id}-${dateStr}`
                      const isExpanded = expandedCell === cellKey

                      if (dayBookings.length === 0) {
                        return (
                          <td key={dateStr} className="px-3 py-4 text-center">
                            <p className="text-xs" style={{ color: '#1a2d45' }}>—</p>
                          </td>
                        )
                      }

                      return (
                        <td key={dateStr} className="px-2 py-2">
                          <button
                            onClick={() => setExpandedCell(isExpanded ? null : cellKey)}
                            className="w-full rounded-xl px-3 py-2.5 text-left transition-all"
                            style={{
                              background: isExpanded ? '#0057B820' : isToday ? '#0057B810' : '#0a1220',
                              border: `1px solid ${isExpanded ? '#0057B840' : isToday ? '#0057B830' : '#1a2d45'}`,
                            }}
                          >
                            <p className="text-xs font-black" style={{ color: '#0057B8' }}>
                              {formatMinutes(practMins)}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>
                              {dayBookings.length} {dayBookings.length === 1 ? 'práctica' : 'prácticas'}
                            </p>
                            {breakMins > 0 && (
                              <p className="text-xs mt-0.5" style={{ color: '#1a2d45' }}>
                                +{formatMinutes(breakMins)} descanso
                              </p>
                            )}
                          </button>
                        </td>
                      )
                    })}

                    {/* Total semana */}
                    <td className="px-4 py-4 text-center" style={{ borderLeft: '1px solid #1a2d45' }}>
                      {weekTotal > 0 ? (
                        <>
                          <p className="text-sm font-black" style={{ color: '#0057B8' }}>{formatMinutes(weekTotal)}</p>
                          {weekBreak > 0 && (
                            <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>+{formatMinutes(weekBreak)} desc.</p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs" style={{ color: '#1a2d45' }}>—</p>
                      )}
                    </td>
                  </tr>
                )
              })}

              {/* Fila totales diarios */}
              <tr style={{ borderTop: '2px solid #1a2d45', background: '#0a1220' }}>
                <td className="px-5 py-3">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#3a5070' }}>Total día</p>
                </td>
                {weekDateStrs.map(dateStr => {
                  const dayBookings = bookingsForDate(dateStr)
                  const total = calcPracticeTime(dayBookings)
                  return (
                    <td key={dateStr} className="px-3 py-3 text-center">
                      {total > 0 ? (
                        <p className="text-xs font-black" style={{ color: '#6b8ab0' }}>{formatMinutes(total)}</p>
                      ) : (
                        <p className="text-xs" style={{ color: '#1a2d45' }}>—</p>
                      )}
                    </td>
                  )
                })}
                <td className="px-4 py-3 text-center" style={{ borderLeft: '1px solid #1a2d45' }}>
                  <p className="text-sm font-black" style={{ color: 'white' }}>
                    {formatMinutes(calcPracticeTime(weekDateStrs.flatMap(d => bookingsForDate(d))))}
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Detalle celda expandida */}
      {expandedCell && (() => {
        const parts = expandedCell.split('-')
        const date = parts.slice(-3).join('-')
        const instId = parts.slice(0, -3).join('-')
        const instructor = instructors.find(i => i.id === instId)
        const dayBookings = bookingsFor(instId, date)

        return (
          <div className="rounded-2xl overflow-hidden" style={{ background: '#0d1829', border: '1px solid #0057B840' }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ background: '#0057B810', borderBottom: '1px solid #0057B820' }}>
              <p className="text-sm font-bold text-white">
                {instructor?.name} · {new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <button onClick={() => setExpandedCell(null)} style={{ color: '#6b8ab0' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="divide-y" style={{ borderColor: '#0f1c2e' }}>
              {dayBookings.map((b, i) => {
                const practMins = getDuration(b.practice_type, b.practice_subtype ?? undefined)
                const breakMins = i < dayBookings.length - 1 ? getBreak(b.practice_type, b.practice_subtype ?? undefined) : 0
                return (
                  <div key={i} className="px-5 py-3 flex items-center gap-4">
                    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{
                      background: b.practice_type === 'car' ? '#0057B8' : b.practice_type === 'moto' ? '#a78bfa' : '#38bdf8'
                    }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{b.student?.full_name ?? '—'}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>
                        {getPracticeLabel(b.practice_type, b.practice_subtype ?? undefined)} · {practMins}min práctica{breakMins > 0 ? ` · ${breakMins}min descanso` : ''}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>
                        {b.pickup_location || 'Sin lugar de recogida indicado'}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-lg font-semibold flex-shrink-0" style={{
                      background: b.status === 'completed' ? 'rgba(52,211,153,0.1)' : '#0057B810',
                      color: b.status === 'completed' ? '#34d399' : '#0057B8',
                    }}>
                      {b.status === 'completed' ? 'Completada' : 'Confirmada'}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="px-5 py-3 flex items-center gap-6" style={{ background: '#0a1220', borderTop: '1px solid #1a2d45' }}>
              <div>
                <p className="text-xs" style={{ color: '#3a5070' }}>Práctica total</p>
                <p className="text-sm font-black" style={{ color: '#0057B8' }}>{formatMinutes(calcPracticeTime(dayBookings))}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: '#3a5070' }}>Descanso total</p>
                <p className="text-sm font-black" style={{ color: '#6b8ab0' }}>{formatMinutes(calcBreakTimeMixed(dayBookings))}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: '#3a5070' }}>Prácticas</p>
                <p className="text-sm font-black text-white">{dayBookings.length}</p>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Resumen semanal por instructor */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(instructors.length, 4)}, 1fr)` }}>
        {instructors.map(instructor => {
          const allBookings = bookingsForInstructor(instructor.id)
          const practMins = calcPracticeTime(allBookings)
          const breakMins = calcBreakTimeMixed(allBookings)
          const byType = {
            car: allBookings.filter(b => b.practice_type === 'car').length,
            truck: allBookings.filter(b => b.practice_type === 'truck').length,
            moto: allBookings.filter(b => b.practice_type === 'moto').length,
          }
          return (
            <div key={instructor.id} className="rounded-2xl p-5" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
              <p className="text-white font-black text-sm mb-3">{instructor.name}</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs" style={{ color: '#3a5070' }}>Práctica</p>
                  <p className="text-sm font-black" style={{ color: practMins > 0 ? '#0057B8' : '#1a2d45' }}>{formatMinutes(practMins)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs" style={{ color: '#3a5070' }}>Descanso</p>
                  <p className="text-sm font-semibold" style={{ color: '#3a5070' }}>{formatMinutes(breakMins)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs" style={{ color: '#3a5070' }}>Total prácticas</p>
                  <p className="text-sm font-black text-white">{allBookings.length}</p>
                </div>
                {allBookings.length > 0 && (
                  <div className="flex gap-2 mt-2 pt-2" style={{ borderTop: '1px solid #0f1c2e' }}>
                    {byType.car > 0 && <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: '#0057B820', color: '#0057B8' }}>🚗 {byType.car}</span>}
                    {byType.truck > 0 && <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: '#38bdf820', color: '#38bdf8' }}>🚚 {byType.truck}</span>}
                    {byType.moto > 0 && <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: '#a78bfa20', color: '#a78bfa' }}>🏍️ {byType.moto}</span>}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Vista mensual ─────────────────────────────────────────────────────────────
function MonthView({
  instructors, weeks, currentMonth, todayStr, bookingsFor, bookingsForInstructor
}: {
  instructors: Instructor[]
  weeks: Date[][]
  currentMonth: number
  todayStr: string
  bookingsFor: (id: string, date: string) => BookingRow[]
  bookingsForInstructor: (id: string) => BookingRow[]
}) {
  return (
    <div className="space-y-6">
      {instructors.map(instructor => {
        const allBookings = bookingsForInstructor(instructor.id)
        const totalMins = calcPracticeTime(allBookings)
        const totalBreak = calcBreakTimeMixed(allBookings)

        return (
          <div key={instructor.id} className="rounded-2xl overflow-hidden" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
            {/* Cabecera instructor */}
            <div className="px-5 py-4 flex items-center justify-between" style={{ background: '#0a1220', borderBottom: '1px solid #1a2d45' }}>
              <div>
                <p className="text-white font-black">{instructor.name}</p>
                <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>{allBookings.length} prácticas este mes</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs" style={{ color: '#3a5070' }}>Práctica</p>
                  <p className="text-lg font-black" style={{ color: totalMins > 0 ? '#0057B8' : '#1a2d45' }}>{formatMinutes(totalMins)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs" style={{ color: '#3a5070' }}>Descanso</p>
                  <p className="text-lg font-black" style={{ color: '#3a5070' }}>{formatMinutes(totalBreak)}</p>
                </div>
              </div>
            </div>

            {/* Calendario mensual del instructor */}
            <div className="p-4">
              <div className="grid grid-cols-7 mb-1">
                {DAY_LABELS.map(d => (
                  <div key={d} className="text-center text-xs font-bold py-1" style={{ color: '#3a5070' }}>{d}</div>
                ))}
              </div>
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1">
                  {week.map(day => {
                    const dateStr = toDateString(day)
                    const inMonth = day.getMonth() === currentMonth
                    const dayBookings = inMonth ? bookingsFor(instructor.id, dateStr) : []
                    const mins = calcPracticeTime(dayBookings)
                    const isToday = dateStr === todayStr

                    return (
                      <div
                        key={dateStr}
                        className="rounded-lg p-1.5 min-h-[52px]"
                        style={{
                          background: dayBookings.length > 0 ? (isToday ? '#0057B820' : '#0a1220') : 'transparent',
                          border: `1px solid ${isToday ? '#0057B840' : dayBookings.length > 0 ? '#1a2d45' : 'transparent'}`,
                          opacity: inMonth ? 1 : 0.2,
                        }}
                      >
                        <p className="text-xs font-bold" style={{ color: isToday ? '#0057B8' : inMonth ? '#6b8ab0' : '#3a5070' }}>
                          {day.getDate()}
                        </p>
                        {mins > 0 && (
                          <>
                            <p className="text-xs font-black leading-tight mt-0.5" style={{ color: '#0057B8', fontSize: '10px' }}>{formatMinutes(mins)}</p>
                            <p className="text-xs" style={{ color: '#3a5070', fontSize: '9px' }}>{dayBookings.length} práct.</p>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Resumen semanas del mes */}
            <div className="px-4 pb-4 grid grid-cols-4 gap-3">
              {weeks.map((week, wi) => {
                const weekBookings = week.flatMap(d => {
                  const dateStr = toDateString(d)
                  return d.getMonth() === currentMonth ? bookingsFor(instructor.id, dateStr) : []
                })
                const weekMins = calcPracticeTime(weekBookings)
                return (
                  <div key={wi} className="rounded-xl p-3 text-center" style={{ background: '#0a1220', border: '1px solid #0f1c2e' }}>
                    <p className="text-xs font-bold" style={{ color: '#3a5070' }}>Sem. {wi + 1}</p>
                    <p className="text-sm font-black mt-1" style={{ color: weekMins > 0 ? '#0057B8' : '#1a2d45' }}>{formatMinutes(weekMins)}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#1a2d45' }}>{weekBookings.length} práct.</p>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
