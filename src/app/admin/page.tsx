'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatTime, formatDate, getDayName, toDateString, getPracticeLabel, getStatusColor, getStatusLabel } from '@/lib/utils'
import type { Booking } from '@/types'
import Link from 'next/link'

export default function AdminPage() {
  const supabase = createClient()
  const today = toDateString(new Date())

  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'car' | 'truck'>('all')

  useEffect(() => { fetchBookings() }, [])

  async function fetchBookings() {
    setLoading(true)
    const { data, error } = await supabase
      .from('bookings')
      .select('*, student:students(full_name, order_number, practice_types)')
      .eq('practice_date', today)
      .neq('status', 'cancelled')
      .order('start_time', { ascending: true })
    if (!error && data) setBookings(data)
    setLoading(false)
  }

  async function markCompleted(id: string) {
    await supabase.from('bookings').update({ status: 'completed' }).eq('id', id)
    fetchBookings()
  }

  async function cancelBooking(id: string) {
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    fetchBookings()
  }

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.practice_type === filter)
  const carCount = bookings.filter(b => b.practice_type === 'car').length
  const truckCount = bookings.filter(b => b.practice_type === 'truck').length
  const completedCount = bookings.filter(b => b.status === 'completed').length

  return (
    <div className="p-8">

      {/* Cabecera */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: '#0057B8' }}>Panel de control</p>
          <h1 className="text-3xl font-black text-white tracking-tight">
            {getDayName(today)}
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6b8ab0' }}>{formatDate(today)}</p>
        </div>
        <Link
          href="/admin/alumnos/nuevo"
          className="flex items-center gap-2 font-bold text-sm px-5 py-3 rounded-xl transition-all duration-200 text-white shadow-lg"
          style={{ background: '#0057B8' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#004494'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#0057B8'}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo alumno
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total hoy', value: bookings.length, color: 'white' },
          { label: 'Coche', value: carCount, color: '#0057B8' },
          { label: 'Camión', value: truckCount, color: '#38bdf8' },
          { label: 'Completadas', value: completedCount, color: '#34d399' },
        ].map(stat => (
          <div key={stat.label} className="rounded-2xl p-5" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6b8ab0' }}>{stat.label}</p>
            <p className="text-4xl font-black" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6">
        {(['all', 'car', 'truck'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150"
            style={{
              background: filter === f ? '#0057B8' : '#0d1829',
              color: filter === f ? 'white' : '#6b8ab0',
              border: filter === f ? '1px solid #0057B8' : '1px solid #1a2d45',
            }}
          >
            {f === 'all' ? 'Todos' : getPracticeLabel(f)}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-sm" style={{ color: '#6b8ab0' }}>Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          <svg className="w-12 h-12 mx-auto mb-4" style={{ color: '#1a2d45' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="font-semibold text-white">Sin reservas hoy</p>
          <p className="text-sm mt-1" style={{ color: '#6b8ab0' }}>No hay prácticas programadas para hoy</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(booking => (
            <div
              key={booking.id}
              className="rounded-2xl px-5 py-4 flex items-center gap-4 transition-all duration-150"
              style={{ background: '#0d1829', border: '1px solid #1a2d45' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = '#0057B840'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#1a2d45'}
            >
              {/* Franja de color */}
              <div className="w-1 h-12 rounded-full flex-shrink-0" style={{ background: booking.practice_type === 'car' ? '#0057B8' : '#38bdf8' }} />

              {/* Hora */}
              <div className="text-center min-w-[56px]">
                <p className="text-white font-black text-xl leading-none">{formatTime(booking.start_time)}</p>
                <p className="text-xs mt-1" style={{ color: '#3a5070' }}>{formatTime(booking.end_time)}</p>
              </div>

              <div className="w-px h-10" style={{ background: '#1a2d45' }} />

              {/* Info alumno */}
              <div className="flex-1">
                <p className="text-white font-bold text-sm">{(booking.student as any)?.full_name ?? '—'}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{
                      background: booking.practice_type === 'car' ? '#0057B820' : '#38bdf820',
                      color: booking.practice_type === 'car' ? '#0057B8' : '#38bdf8',
                    }}
                  >
                    {getPracticeLabel(booking.practice_type)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${getStatusColor(booking.status)}`}>
                    {getStatusLabel(booking.status)}
                  </span>
                </div>
              </div>

              {/* Nº orden */}
              <div className="text-xs font-mono px-3 py-1.5 rounded-lg" style={{ background: '#0f1c2e', color: '#3a5070' }}>
                #{(booking.student as any)?.order_number ?? '—'}
              </div>

              {/* Acciones */}
              {booking.status === 'confirmed' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => markCompleted(booking.id)}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all duration-150"
                    style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(52,211,153,0.2)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(52,211,153,0.1)'}
                  >
                    ✓ Completar
                  </button>
                  <button
                    onClick={() => cancelBooking(booking.id)}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all duration-150"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.2)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}