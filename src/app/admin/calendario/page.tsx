'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatTime, toDateString, getDayName, formatDate, getPracticeLabel, generateTimeSlots } from '@/lib/utils'
import type { Booking } from '@/types'

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

export default function CalendarioPage() {
  const supabase = createClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [blockedDays, setBlockedDays] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'car' | 'truck'>('all')

  useEffect(() => { fetchData() }, [currentMonth, currentYear])

  async function fetchData() {
    setLoading(true)
    const from = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
    const lastDay = getDaysInMonth(currentYear, currentMonth)
    const to = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const [{ data: bookingsData }, { data: blockedData }] = await Promise.all([
      supabase
        .from('bookings')
        .select('*, student:students(full_name, order_number)')
        .gte('practice_date', from)
        .lte('practice_date', to)
        .neq('status', 'cancelled')
        .order('start_time', { ascending: true }),
      supabase
        .from('blocked_days')
        .select('date')
        .gte('date', from)
        .lte('date', to),
    ])

    if (bookingsData) setBookings(bookingsData)
    if (blockedData) setBlockedDays(blockedData.map(b => b.date))
    setLoading(false)
  }

  function bookingsForDate(dateStr: string) {
    return bookings.filter(b => {
      const matchDate = b.practice_date === dateStr
      const matchFilter = filter === 'all' || b.practice_type === filter
      return matchDate && matchFilter
    })
  }

  function getSlotsForDate(dateStr: string) {
    const carSlots = generateTimeSlots('car').map(slot => ({
      time: slot,
      type: 'car' as const,
      booking: bookings.find(b => b.practice_date === dateStr && b.start_time.substring(0, 5) === slot && b.practice_type === 'car'),
    }))
    const truckSlots = generateTimeSlots('truck').map(slot => ({
      time: slot,
      type: 'truck' as const,
      booking: bookings.find(b => b.practice_date === dateStr && b.start_time.substring(0, 5) === slot && b.practice_type === 'truck'),
    }))
    if (filter === 'car') return carSlots
    if (filter === 'truck') return truckSlots
    return [...carSlots, ...truckSlots].sort((a, b) => a.time.localeCompare(b.time))
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

  return (
    <div className="p-8">

      {/* Cabecera */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: '#0057B8' }}>Agenda</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Calendario</h1>
        </div>
        <div className="flex gap-1 rounded-xl p-1" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          {(['all', 'car', 'truck'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
              style={{
                background: filter === f ? '#0057B8' : 'transparent',
                color: filter === f ? 'white' : '#6b8ab0',
              }}
            >
              {f === 'all' ? 'Todos' : getPracticeLabel(f)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">

        {/* Calendario mensual */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>

          {/* Nav mes */}
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1a2d45' }}>
            <button onClick={prevMonth} style={{ color: '#6b8ab0' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#6b8ab0'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-white font-black">{MONTHS[currentMonth]} {currentYear}</h2>
            <button onClick={nextMonth} style={{ color: '#6b8ab0' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#6b8ab0'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Días semana */}
          <div className="grid grid-cols-7 px-4 pt-3">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-bold py-1.5" style={{ color: '#3a5070' }}>{d}</div>
            ))}
          </div>

          {/* Celdas */}
          <div className="grid grid-cols-7 gap-1 px-4 pb-4">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const date = new Date(currentYear, currentMonth, day)
              const dateStr = toDateString(date)
              const isWeekend = date.getDay() === 0 || date.getDay() === 6
              const isToday = dateStr === toDateString(today)
              const isSelected = dateStr === selectedDate
              const isBlocked = blockedDays.includes(dateStr)
              const dayBookings = bookingsForDate(dateStr)
              const carCount = dayBookings.filter(b => b.practice_type === 'car').length
              const truckCount = dayBookings.filter(b => b.practice_type === 'truck').length
              const hasBookings = dayBookings.length > 0

              return (
                <button
                  key={day}
                  onClick={() => !isWeekend && !isBlocked && setSelectedDate(isSelected ? null : dateStr)}
                  className="rounded-xl p-1.5 transition-all duration-150 text-left"
                  style={{
                    background: isSelected ? '#0057B8' : isBlocked ? 'rgba(239,68,68,0.08)' : isToday ? '#0057B810' : 'transparent',
                    border: `1.5px solid ${isSelected ? '#0057B8' : isToday ? '#0057B840' : 'transparent'}`,
                    cursor: isWeekend || isBlocked ? 'default' : 'pointer',
                    opacity: isWeekend ? 0.2 : 1,
                    minHeight: '56px',
                  }}
                  onMouseEnter={e => { if (!isWeekend && !isBlocked && !isSelected) (e.currentTarget as HTMLElement).style.background = '#0057B810' }}
                  onMouseLeave={e => { if (!isWeekend && !isBlocked && !isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <p className="text-xs font-black mb-1" style={{
                    color: isSelected ? 'white' : isBlocked ? '#f87171' : isToday ? '#0057B8' : '#a0b8d0'
                  }}>
                    {day}
                  </p>
                  {isBlocked && (
                    <div className="w-full h-1 rounded-full" style={{ background: 'rgba(239,68,68,0.4)' }} />
                  )}
                  {!isBlocked && (
                    <div className="space-y-0.5">
                      {carCount > 0 && (
                        <div className="flex items-center gap-0.5">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: isSelected ? 'rgba(255,255,255,0.7)' : '#0057B8' }} />
                          <p className="text-xs font-bold leading-none" style={{ color: isSelected ? 'rgba(255,255,255,0.8)' : '#0057B8', fontSize: '10px' }}>{carCount}</p>
                        </div>
                      )}
                      {truckCount > 0 && (
                        <div className="flex items-center gap-0.5">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: isSelected ? 'rgba(255,255,255,0.7)' : '#38bdf8' }} />
                          <p className="text-xs font-bold leading-none" style={{ color: isSelected ? 'rgba(255,255,255,0.8)' : '#38bdf8', fontSize: '10px' }}>{truckCount}</p>
                        </div>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Leyenda */}
          <div className="px-5 py-3 flex items-center gap-4" style={{ borderTop: '1px solid #1a2d45' }}>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: '#0057B8' }} />
              <p className="text-xs" style={{ color: '#3a5070' }}>Coche</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: '#38bdf8' }} />
              <p className="text-xs" style={{ color: '#3a5070' }}>Camión</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(239,68,68,0.4)' }} />
              <p className="text-xs" style={{ color: '#3a5070' }}>Bloqueado</p>
            </div>
          </div>
        </div>

        {/* Panel detalle día */}
        <div>
          {!selectedDate ? (
            <div className="rounded-2xl p-12 text-center h-full flex flex-col items-center justify-center" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
              <svg className="w-12 h-12 mx-auto mb-4" style={{ color: '#1a2d45' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-white font-semibold">Selecciona un día</p>
              <p className="text-sm mt-1" style={{ color: '#3a5070' }}>Pincha en cualquier día del calendario para ver sus reservas y slots</p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>

              {/* Cabecera día */}
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #1a2d45', background: '#0057B810' }}>
                <div>
                  <p className="text-white font-black">{getDayName(selectedDate)}</p>
                  <p className="text-sm" style={{ color: '#6b8ab0' }}>{formatDate(selectedDate)}</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{ background: '#0057B820', color: '#0057B8' }}>
                    {bookingsForDate(selectedDate).length} reservas
                  </span>
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="p-1 rounded-lg transition"
                    style={{ color: '#3a5070' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#3a5070'}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Slots */}
              <div className="overflow-y-auto" style={{ maxHeight: '520px' }}>

                {/* Mañana */}
                <div>
                  <div className="px-5 py-2" style={{ background: '#0a1220', borderBottom: '1px solid #1a2d45' }}>
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0057B8' }}>Mañana · 08:00 – 13:30</p>
                  </div>
                  {getSlotsForDate(selectedDate)
                    .filter(s => s.time < '14:00')
                    .map(({ time, type, booking }) => (
                      <div
                        key={`${time}-${type}`}
                        className="px-5 py-3 flex items-center gap-3 transition"
                        style={{ borderBottom: '1px solid #0f1c2e' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#0f1c2e'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                      >
                        <p className="text-xs font-black font-mono w-12 flex-shrink-0" style={{ color: '#3a5070' }}>{time}</p>
                        <div className="w-px h-6 flex-shrink-0" style={{ background: '#1a2d45' }} />
                        {booking ? (
                          <>
                            <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: type === 'car' ? '#0057B8' : '#38bdf8' }} />
                            <div className="flex-1">
                              <p className="text-white text-sm font-bold">{(booking.student as any)?.full_name ?? '—'}</p>
                              <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>
                                {getPracticeLabel(type)} · #{(booking.student as any)?.order_number}
                              </p>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{
                              background: type === 'car' ? '#0057B820' : '#38bdf820',
                              color: type === 'car' ? '#0057B8' : '#38bdf8',
                            }}>
                              {getPracticeLabel(type)}
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: '#1a2d45' }} />
                            <p className="text-xs flex-1" style={{ color: '#1a2d45' }}>Libre · {getPracticeLabel(type)}</p>
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: '#0a1220', color: '#1a2d45' }}>
                              Libre
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                </div>

                {/* Tarde */}
                <div>
                  <div className="px-5 py-2" style={{ background: '#0a1220', borderBottom: '1px solid #1a2d45' }}>
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0057B8' }}>Tarde · 16:00 – 19:15</p>
                  </div>
                  {getSlotsForDate(selectedDate)
                    .filter(s => s.time >= '14:00')
                    .map(({ time, type, booking }) => (
                      <div
                        key={`${time}-${type}`}
                        className="px-5 py-3 flex items-center gap-3 transition"
                        style={{ borderBottom: '1px solid #0f1c2e' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#0f1c2e'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                      >
                        <p className="text-xs font-black font-mono w-12 flex-shrink-0" style={{ color: '#3a5070' }}>{time}</p>
                        <div className="w-px h-6 flex-shrink-0" style={{ background: '#1a2d45' }} />
                        {booking ? (
                          <>
                            <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: type === 'car' ? '#0057B8' : '#38bdf8' }} />
                            <div className="flex-1">
                              <p className="text-white text-sm font-bold">{(booking.student as any)?.full_name ?? '—'}</p>
                              <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>
                                {getPracticeLabel(type)} · #{(booking.student as any)?.order_number}
                              </p>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{
                              background: type === 'car' ? '#0057B820' : '#38bdf820',
                              color: type === 'car' ? '#0057B8' : '#38bdf8',
                            }}>
                              {getPracticeLabel(type)}
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: '#1a2d45' }} />
                            <p className="text-xs flex-1" style={{ color: '#1a2d45' }}>Libre · {getPracticeLabel(type)}</p>
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: '#0a1220', color: '#1a2d45' }}>
                              Libre
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}