'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatTime, formatDate, getDayName, toDateString, getPracticeLabel, getStatusColor, getStatusLabel } from '@/lib/utils'
import type { Booking } from '@/types'

function getNextDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i + 1)
    return toDateString(d)
  })
}

export default function InstructorPage() {
  const supabase = createClient()
  const today = toDateString(new Date())

  const [instructorId, setInstructorId] = useState<string | null>(null)
  const [instructorName, setInstructorName] = useState('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [upcoming, setUpcoming] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'today' | 'upcoming'>('today')

  useEffect(() => { init() }, [])

  async function init() {
    // Identidad + nombre vía /api/auth/me (getSessionUser canónico) en un solo salto —
    // staff.name e instructors.name siempre coinciden (se crean juntos en /api/staff/invite),
    // así que no hace falta una segunda consulta a instructors solo para el nombre.
    const meRes = await fetch('/api/auth/me')
    if (!meRes.ok) { setLoading(false); return }
    const me = await meRes.json()
    if (me.role === 'instructor') {
      setInstructorId(me.id)
      setInstructorName(me.name ?? '')
      await Promise.all([fetchToday(me.id), fetchUpcoming(me.id)])
    } else {
      setLoading(false)
    }
  }

  async function fetchToday(id: string) {
    const { data } = await supabase
      .from('bookings')
      .select('*, student:students(full_name, order_number)')
      .eq('instructor_id', id)
      .eq('practice_date', today)
      .neq('status', 'cancelled')
      .order('start_time', { ascending: true })
    if (data) setBookings(data)
    setLoading(false)
  }

  async function fetchUpcoming(id: string) {
    const next7 = getNextDays(7)
    const { data } = await supabase
      .from('bookings')
      .select('*, student:students(full_name, order_number)')
      .eq('instructor_id', id)
      .in('practice_date', next7)
      .neq('status', 'cancelled')
      .order('practice_date', { ascending: true })
      .order('start_time', { ascending: true })
    if (data) setUpcoming(data)
  }

  async function markCompleted(booking: Booking) {
    await supabase.from('bookings').update({ status: 'completed' }).eq('id', booking.id)
    fetch('/api/notify-milestone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: booking.student_id, instructorId: booking.instructor_id }),
    }).catch(() => {})
    if (instructorId) fetchToday(instructorId)
  }

  const completedCount = bookings.filter(b => b.status === 'completed').length

  function BookingRow({ booking, showDate = false }: { booking: Booking; showDate?: boolean }) {
    return (
      <div
        className="rounded-2xl px-5 py-4 flex items-center gap-4"
        style={{ background: '#0d1829', border: '1px solid #1a2d45' }}
      >
        <div className="w-1 h-12 rounded-full flex-shrink-0" style={{
          background: booking.practice_type === 'car' ? '#0057B8' : booking.practice_type === 'moto' ? '#a78bfa' : '#38bdf8'
        }} />
        <div className="text-center min-w-[60px]">
          {showDate ? (
            <>
              <p className="text-white font-black text-sm leading-none">{formatDate(booking.practice_date)}</p>
              <p className="text-xs mt-0.5 font-bold" style={{ color: '#0057B8' }}>{formatTime(booking.start_time)}</p>
            </>
          ) : (
            <>
              <p className="text-white font-black text-xl leading-none">{formatTime(booking.start_time)}</p>
              <p className="text-xs mt-1" style={{ color: '#3a5070' }}>{formatTime(booking.end_time)}</p>
            </>
          )}
        </div>
        <div className="w-px h-10" style={{ background: '#1a2d45' }} />
        <div className="flex-1">
          <p className="text-white font-bold text-sm">{(booking.student as any)?.full_name ?? '—'}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{
              background: booking.practice_type === 'car' ? '#0057B820' : booking.practice_type === 'moto' ? '#a78bfa20' : '#38bdf820',
              color: booking.practice_type === 'car' ? '#0057B8' : booking.practice_type === 'moto' ? '#a78bfa' : '#38bdf8',
            }}>
              {getPracticeLabel(booking.practice_type, (booking as any).practice_subtype)}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={getStatusColor(booking.status)}>
              {getStatusLabel(booking.status)}
            </span>
          </div>
        </div>
        <div className="text-xs font-mono px-3 py-1.5 rounded-lg" style={{ background: '#0f1c2e', color: '#3a5070' }}>
          #{(booking.student as any)?.order_number ?? '—'}
        </div>
        {booking.status === 'confirmed' && !showDate && (
          <button
            onClick={() => markCompleted(booking)}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all duration-150"
            style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(52,211,153,0.2)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(52,211,153,0.1)'}
          >
            ✓ Completar
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: '#0057B8' }}>Panel de instructor</p>
          <h1 className="text-3xl font-black text-white tracking-tight">{getDayName(today)}</h1>
          <p className="text-sm mt-1" style={{ color: '#6b8ab0' }}>{formatDate(today)}{instructorName ? ` · ${instructorName}` : ''}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total hoy', value: bookings.length, color: 'white' },
          { label: 'Completadas', value: completedCount, color: '#34d399' },
          { label: 'Próximos 7 días', value: upcoming.length, color: '#0057B8' },
        ].map(stat => (
          <div key={stat.label} className="rounded-2xl p-5" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6b8ab0' }}>{stat.label}</p>
            <p className="text-4xl font-black" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'today',    label: `Hoy (${bookings.length})` },
          { key: 'upcoming', label: `Próximas (${upcoming.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key as 'today' | 'upcoming')}
            className="px-5 py-2.5 rounded-xl text-sm font-bold transition"
            style={{
              background: tab === key ? '#0057B8' : '#0d1829',
              color: tab === key ? 'white' : '#6b8ab0',
              border: `1px solid ${tab === key ? '#0057B8' : '#1a2d45'}`,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: '#6b8ab0' }}>Cargando...</div>
      ) : !instructorId ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          <p className="text-white font-semibold">Sin instructor asignado</p>
          <p className="text-sm mt-1" style={{ color: '#6b8ab0' }}>Pide al administrador que vincule tu cuenta</p>
        </div>
      ) : tab === 'today' ? (
        bookings.length === 0 ? (
          <div className="rounded-2xl p-16 text-center" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
            <p className="font-semibold text-white">Sin prácticas hoy</p>
            <p className="text-sm mt-1" style={{ color: '#6b8ab0' }}>No tienes prácticas programadas para hoy</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map(b => <BookingRow key={b.id} booking={b} />)}
          </div>
        )
      ) : (
        upcoming.length === 0 ? (
          <div className="rounded-2xl p-16 text-center" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
            <p className="font-semibold text-white">Sin prácticas en los próximos 7 días</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map(b => <BookingRow key={b.id} booking={b} showDate />)}
          </div>
        )
      )}
    </div>
  )
}
