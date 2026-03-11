'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, toDateString } from '@/lib/utils'
import type { Student, Booking } from '@/types'
import Link from 'next/link'

interface StudentAlert {
  student: Student
  lastBooking: Booking | null
  daysSinceLastPractice: number
  pendingBookings: number
}

export default function AlertasPage() {
  const supabase = createClient()
  const [alerts, setAlerts] = useState<StudentAlert[]>([])
  const [noShows, setNoShows] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [threshold, setThreshold] = useState(14)

  useEffect(() => { fetchData() }, [threshold])

  async function fetchData() {
    setLoading(true)
    const today = toDateString(new Date())

    const [{ data: students }, { data: bookings }, { data: noShowData }] = await Promise.all([
      supabase.from('students').select('*').eq('is_active', true),
      supabase.from('bookings').select('*').neq('status', 'cancelled').order('practice_date', { ascending: false }),
      supabase.from('bookings').select('*, student:students(full_name, order_number)').eq('no_show', true).gte('practice_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
    ])

    if (students && bookings) {
      const studentAlerts: StudentAlert[] = []

      for (const student of students) {
        const studentBookings = bookings.filter(b => b.student_id === student.id)
        const pastBookings = studentBookings.filter(b => b.practice_date < today && b.status === 'completed')
        const pendingBookings = studentBookings.filter(b => b.practice_date >= today && b.status === 'confirmed').length
        const lastBooking = pastBookings[0] ?? null

        let daysSince = 999
        if (lastBooking) {
          const last = new Date(lastBooking.practice_date)
          const now = new Date()
          daysSince = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
        } else {
          const created = new Date(student.created_at)
          const now = new Date()
          daysSince = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
        }

        if (daysSince >= threshold && pendingBookings === 0) {
          studentAlerts.push({ student, lastBooking, daysSinceLastPractice: daysSince, pendingBookings })
        }
      }

      studentAlerts.sort((a, b) => b.daysSinceLastPractice - a.daysSinceLastPractice)
      setAlerts(studentAlerts)
    }

    if (noShowData) setNoShows(noShowData)
    setLoading(false)
  }

  async function markNoShow(bookingId: string) {
    await supabase.from('bookings').update({ no_show: true, status: 'cancelled' }).eq('id', bookingId)
    fetchData()
  }

  return (
    <div className="p-8">

      {/* Cabecera */}
      <div className="mb-8">
        <p className="text-sm font-medium mb-1" style={{ color: '#0057B8' }}>Seguimiento</p>
        <h1 className="text-3xl font-black text-white tracking-tight">Alertas</h1>
        <p className="text-sm mt-1" style={{ color: '#6b8ab0' }}>Alumnos que necesitan atención</p>
      </div>

      {/* Selector de umbral */}
      <div className="flex items-center gap-4 mb-8 p-4 rounded-2xl" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
        <p className="text-sm font-semibold text-white">Alertar si llevan más de</p>
        <div className="flex gap-2">
          {[7, 14, 21, 30].map(days => (
            <button
              key={days}
              onClick={() => setThreshold(days)}
              className="px-3 py-1.5 rounded-lg text-sm font-bold transition"
              style={{
                background: threshold === days ? '#0057B8' : '#0a1220',
                color: threshold === days ? 'white' : '#6b8ab0',
                border: `1px solid ${threshold === days ? '#0057B8' : '#1a2d45'}`,
              }}
            >
              {days} días
            </button>
          ))}
        </div>
        <p className="text-sm font-semibold text-white">sin practicar</p>
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: '#6b8ab0' }}>Cargando...</div>
      ) : (
        <div className="space-y-6">

          {/* Alumnos inactivos */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <h2 className="text-white font-bold">Sin practicar · {alerts.length} alumnos</h2>
            </div>

            {alerts.length === 0 ? (
              <div className="rounded-2xl p-10 text-center" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
                <p className="text-white font-semibold">¡Todo en orden!</p>
                <p className="text-sm mt-1" style={{ color: '#6b8ab0' }}>Ningún alumno lleva más de {threshold} días sin practicar</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map(({ student, lastBooking, daysSinceLastPractice }) => (
                  <div
                    key={student.id}
                    className="rounded-2xl px-5 py-4 flex items-center gap-4"
                    style={{ background: '#0d1829', border: '1px solid #1a2d45' }}
                  >
                    {/* Indicador urgencia */}
                    <div
                      className="w-2 h-12 rounded-full flex-shrink-0"
                      style={{ background: daysSinceLastPractice > 30 ? '#f87171' : daysSinceLastPractice > 21 ? '#fb923c' : '#fbbf24' }}
                    />

                    <div className="flex-1">
                      <p className="text-white font-bold">{student.full_name}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>
                        {lastBooking
                          ? `Última práctica: ${formatDate(lastBooking.practice_date)}`
                          : 'Sin prácticas registradas'}
                      </p>
                    </div>

                    <div className="text-center px-4">
                      <p className="text-2xl font-black" style={{ color: daysSinceLastPractice > 30 ? '#f87171' : '#fb923c' }}>
                        {daysSinceLastPractice === 999 ? '—' : daysSinceLastPractice}
                      </p>
                      <p className="text-xs" style={{ color: '#3a5070' }}>días</p>
                    </div>

                    <Link
                      href={`/admin/alumnos/${student.id}`}
                      className="px-4 py-2 rounded-xl text-sm font-bold transition"
                      style={{ background: '#0057B820', color: '#0057B8' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#0057B840'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#0057B820'}
                    >
                      Ver perfil
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* No-shows recientes */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <h2 className="text-white font-bold">No-shows últimos 30 días · {noShows.length}</h2>
            </div>

            {noShows.length === 0 ? (
              <div className="rounded-2xl p-10 text-center" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
                <p className="text-white font-semibold">Sin no-shows recientes</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
                {noShows.map((booking, idx) => (
                  <div
                    key={booking.id}
                    className="px-5 py-4 flex items-center gap-4"
                    style={{ borderBottom: idx < noShows.length - 1 ? '1px solid #0f1c2e' : 'none' }}
                  >
                    <div className="flex-1">
                      <p className="text-white font-bold text-sm">{(booking.student as any)?.full_name ?? '—'}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>
                        {formatDate(booking.practice_date)} · #{(booking.student as any)?.order_number}
                      </p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                      No-show
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}