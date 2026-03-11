'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatTime, toDateString, getPracticeLabel } from '@/lib/utils'
import type { Booking } from '@/types'

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  let day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1 // Lunes = 0
}

function getWeekDays(date: Date): Date[] {
  const day = date.getDay()
  const monday = new Date(date)
  monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

const MORNING_SLOTS = ['08:00','08:55','09:50','10:45','11:40','12:35']
const AFTERNOON_SLOTS = ['16:00','16:55','17:50','18:45']
const ALL_SLOTS = [...MORNING_SLOTS, ...AFTERNOON_SLOTS]

export default function CalendarioPage() {
  const supabase = createClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState<Date>(today)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'car' | 'truck'>('all')
  const [view, setView] = useState<'month' | 'week'>('month')

  const weekDays = getWeekDays(selectedDate)

  useEffect(() => { fetchBookings() }, [currentMonth, currentYear])

  async function fetchBookings() {
    setLoading(true)
    const from = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
    const lastDay = getDaysInMonth(currentYear, currentMonth)
    const to = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${lastDay}`

    const { data } = await supabase
      .from('bookings')
      .select('*, student:students(full_name, order_number)')
      .gte('practice_date', from)
      .lte('practice_date', to)
      .neq('status', 'cancelled')
      .order('start_time', { ascending: true })

    if (data) setBookings(data)
    setLoading(false)
  }

  function bookingsForDate(date: Date) {
    const str = toDateString(date)
    return bookings.filter(b => {
      const matchDate = b.practice_date === str
      const matchFilter = filter === 'all' || b.practice_type === filter
      return matchDate && matchFilter
    })
  }

  function bookingForSlot(date: Date, slot: string) {
    const str = toDateString(date)
    return bookings.find(b =>
      b.practice_date === str &&
      b.start_time.substring(0, 5) === slot &&
      (filter === 'all' || b.practice_type === filter)
    )
  }

  function prevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
    else setCurrentMonth(m => m - 1)
  }

  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
    else setCurrentMonth(m => m + 1)
  }

  function goToWeekOfDate(date: Date) {
    setSelectedDate(date)
    setView('week')
  }

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)

  return (
    <div className="p-8">

      {/* Cabecera */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: '#0057B8' }}>Agenda</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Calendario</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Filtro tipo */}
          <div className="flex gap-1 rounded-xl p-1" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
            {(['all', 'car', 'truck'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
                style={{
                  background: filter === f ? '#0057B8' : 'transparent',
                  color: filter === f ? 'white' : '#6b8ab0',
                }}
              >
                {f === 'all' ? 'Todos' : getPracticeLabel(f)}
              </button>
            ))}
          </div>
          {/* Vista */}
          <div className="flex gap-1 rounded-xl p-1" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
            {(['month', 'week'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
                style={{
                  background: view === v ? '#0057B8' : 'transparent',
                  color: view === v ? 'white' : '#6b8ab0',
                }}
              >
                {v === 'month' ? 'Mes' : 'Semana'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── VISTA MES ── */}
      {view === 'month' && (
        <div className="rounded-2xl overflow-hidden" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>

          {/* Nav mes */}
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1a2d45' }}>
            <button onClick={prevMonth} className="p-2 rounded-lg transition" style={{ color: '#6b8ab0' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#6b8ab0'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-white font-black text-lg">{MONTHS[currentMonth]} {currentYear}</h2>
            <button onClick={nextMonth} className="p-2 rounded-lg transition" style={{ color: '#6b8ab0' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#6b8ab0'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Días semana */}
          <div className="grid grid-cols-7 px-4 pt-3 pb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-bold uppercase tracking-wider py-2" style={{ color: '#3a5070' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Celdas */}
          <div className="grid grid-cols-7 gap-px px-4 pb-4" style={{ background: '#1a2d45' }}>
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="rounded-xl" style={{ background: '#0d1829', minHeight: '80px' }} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const date = new Date(currentYear, currentMonth, day)
              const isWeekend = date.getDay() === 0 || date.getDay() === 6
              const isToday = toDateString(date) === toDateString(today)
              const isSelected = toDateString(date) === toDateString(selectedDate)
              const dayBookings = bookingsForDate(date)
              const carCount = dayBookings.filter(b => b.practice_type === 'car').length
              const truckCount = dayBookings.filter(b => b.practice_type === 'truck').length

              return (
                <div
                  key={day}
                  onClick={() => !isWeekend && goToWeekOfDate(date)}
                  className="rounded-xl p-2 transition-all duration-150"
                  style={{
                    background: isSelected ? '#0057B820' : '#0d1829',
                    border: isToday ? '1.5px solid #0057B8' : isSelected ? '1.5px solid #0057B840' : '1.5px solid transparent',
                    minHeight: '80px',
                    cursor: isWeekend ? 'default' : 'pointer',
                    opacity: isWeekend ? 0.35 : 1,
                  }}
                  onMouseEnter={e => { if (!isWeekend) (e.currentTarget as HTMLElement).style.borderColor = '#0057B860' }}
                  onMouseLeave={e => { if (!isWeekend) (e.currentTarget as HTMLElement).style.borderColor = isToday ? '#0057B8' : isSelected ? '#0057B840' : 'transparent' }}
                >
                  <p className="text-sm font-bold mb-1" style={{ color: isToday ? '#0057B8' : isSelected ? '#5a9fe0' : '#a0b8d0' }}>
                    {day}
                  </p>
                  <div className="space-y-0.5">
                    {carCount > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#0057B8' }} />
                        <p className="text-xs font-semibold" style={{ color: '#0057B8' }}>{carCount} coche</p>
                      </div>
                    )}
                    {truckCount > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#38bdf8' }} />
                        <p className="text-xs font-semibold" style={{ color: '#38bdf8' }}>{truckCount} camión</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── VISTA SEMANA ── */}
      {view === 'week' && (
        <div>
          {/* Nav semana */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => {
                const d = new Date(selectedDate)
                d.setDate(d.getDate() - 7)
                setSelectedDate(d)
                if (d.getMonth() !== currentMonth) {
                  setCurrentMonth(d.getMonth())
                  setCurrentYear(d.getFullYear())
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{ background: '#0d1829', border: '1px solid #1a2d45', color: '#6b8ab0' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Semana anterior
            </button>
            <p className="text-white font-bold text-sm">
              {weekDays[0].getDate()} {MONTHS[weekDays[0].getMonth()]} — {weekDays[4].getDate()} {MONTHS[weekDays[4].getMonth()]} {currentYear}
            </p>
            <button
              onClick={() => {
                const d = new Date(selectedDate)
                d.setDate(d.getDate() + 7)
                setSelectedDate(d)
                if (d.getMonth() !== currentMonth) {
                  setCurrentMonth(d.getMonth())
                  setCurrentYear(d.getFullYear())
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{ background: '#0d1829', border: '1px solid #1a2d45', color: '#6b8ab0' }}
            >
              Semana siguiente
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Grid semana */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>

            {/* Header días */}
            <div className="grid grid-cols-6" style={{ borderBottom: '1px solid #1a2d45' }}>
              <div className="px-4 py-3" style={{ borderRight: '1px solid #1a2d45' }}>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#3a5070' }}>Hora</p>
              </div>
              {weekDays.slice(0, 5).map((day, i) => {
                const isToday = toDateString(day) === toDateString(today)
                const isWeekend = day.getDay() === 0 || day.getDay() === 6
                return (
                  <div
                    key={i}
                    className="px-3 py-3 text-center"
                    style={{
                      borderRight: i < 4 ? '1px solid #1a2d45' : 'none',
                      background: isToday ? '#0057B810' : 'transparent',
                    }}
                  >
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#3a5070' }}>{DAYS[i]}</p>
                    <p className="text-lg font-black mt-0.5" style={{ color: isToday ? '#0057B8' : '#a0b8d0' }}>
                      {day.getDate()}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Franjas horarias */}
            {[
              { label: 'Mañana', slots: MORNING_SLOTS },
              { label: 'Tarde', slots: AFTERNOON_SLOTS },
            ].map(session => (
              <div key={session.label}>
                <div className="px-4 py-2" style={{ background: '#0a1220', borderBottom: '1px solid #1a2d45', borderTop: '1px solid #1a2d45' }}>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0057B8' }}>{session.label}</p>
                </div>
                {session.slots.map(slot => (
                  <div key={slot} className="grid grid-cols-6" style={{ borderBottom: '1px solid #0f1c2e' }}>
                    {/* Hora */}
                    <div className="px-4 py-3 flex items-center" style={{ borderRight: '1px solid #1a2d45' }}>
                      <p className="text-xs font-bold font-mono" style={{ color: '#3a5070' }}>{slot}</p>
                    </div>
                    {/* Celdas por día */}
                    {weekDays.slice(0, 5).map((day, i) => {
                      const booking = bookingForSlot(day, slot)
                      const isToday = toDateString(day) === toDateString(today)
                      return (
                        <div
                          key={i}
                          className="px-2 py-1.5 min-h-[52px] flex items-center"
                          style={{
                            borderRight: i < 4 ? '1px solid #1a2d45' : 'none',
                            background: isToday ? '#0057B808' : 'transparent',
                          }}
                        >
                          {booking ? (
                            <div
                              className="w-full rounded-lg px-2 py-1.5"
                              style={{
                                background: booking.practice_type === 'car' ? '#0057B820' : '#38bdf820',
                                borderLeft: `3px solid ${booking.practice_type === 'car' ? '#0057B8' : '#38bdf8'}`,
                              }}
                            >
                              <p className="text-xs font-bold leading-tight" style={{ color: booking.practice_type === 'car' ? '#5a9fe0' : '#7dd3fc' }}>
                                {(booking.student as any)?.full_name?.split(' ')[0] ?? '—'}
                              </p>
                              <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>
                                {getPracticeLabel(booking.practice_type)}
                              </p>
                            </div>
                          ) : (
                            <div className="w-full h-8 rounded-lg" style={{ background: '#0a1220' }} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}