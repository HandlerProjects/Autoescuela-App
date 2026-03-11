'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, getDayName, toDateString } from '@/lib/utils'
import type { BlockedDay } from '@/types'

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

  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [blockedDays, setBlockedDays] = useState<BlockedDay[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchBlockedDays() }, [currentMonth, currentYear])

  async function fetchBlockedDays() {
    setLoading(true)
    const from = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
    const lastDay = getDaysInMonth(currentYear, currentMonth)
    const to = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${lastDay}`

    const { data } = await supabase
      .from('blocked_days')
      .select('*')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })

    if (data) setBlockedDays(data)
    setLoading(false)
  }

  function isBlocked(dateStr: string) {
    return blockedDays.some(b => b.date === dateStr)
  }

  async function toggleDay(dateStr: string) {
    const blocked = isBlocked(dateStr)
    if (blocked) {
      await supabase.from('blocked_days').delete().eq('date', dateStr)
      setBlockedDays(prev => prev.filter(b => b.date !== dateStr))
      setSelectedDate(null)
    } else {
      setSelectedDate(dateStr)
      setReason('')
    }
  }

  async function saveBlockedDay() {
    if (!selectedDate) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase.from('blocked_days').insert({
      instructor_id: user.id,
      date: selectedDate,
      reason: reason.trim() || null,
    }).select().single()

    if (data) setBlockedDays(prev => [...prev, data])
    setSelectedDate(null)
    setReason('')
    setSaving(false)
  }

  function prevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
    else setCurrentMonth(m => m - 1)
  }

  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
    else setCurrentMonth(m => m + 1)
  }

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)

  return (
    <div className="p-8 max-w-3xl">

      {/* Cabecera */}
      <div className="mb-8">
        <p className="text-sm font-medium mb-1" style={{ color: '#0057B8' }}>Configuración</p>
        <h1 className="text-3xl font-black text-white tracking-tight">Festivos y vacaciones</h1>
        <p className="text-sm mt-1" style={{ color: '#6b8ab0' }}>Los días bloqueados no aparecerán disponibles para los alumnos</p>
      </div>

      <div className="grid grid-cols-2 gap-6">

        {/* Calendario */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>

          {/* Nav mes */}
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1a2d45' }}>
            <button onClick={prevMonth} style={{ color: '#6b8ab0' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#6b8ab0'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <p className="text-white font-black">{MONTHS[currentMonth]} {currentYear}</p>
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
          <div className="grid grid-cols-7 px-3 pt-3">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-bold py-1.5" style={{ color: '#3a5070' }}>{d}</div>
            ))}
          </div>

          {/* Celdas */}
          <div className="grid grid-cols-7 gap-1 px-3 pb-3">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const date = new Date(currentYear, currentMonth, day)
              const dateStr = toDateString(date)
              const isWeekend = date.getDay() === 0 || date.getDay() === 6
              const blocked = isBlocked(dateStr)
              const isToday = dateStr === toDateString(today)
              const isPast = date < today

              return (
                <button
                  key={day}
                  onClick={() => !isWeekend && !isPast && toggleDay(dateStr)}
                  className="rounded-lg text-sm font-bold py-2 transition-all duration-150"
                  style={{
                    background: blocked ? 'rgba(239,68,68,0.15)' : selectedDate === dateStr ? '#0057B820' : 'transparent',
                    color: blocked ? '#f87171' : isWeekend ? '#1a2d45' : isPast ? '#1a2d45' : isToday ? '#0057B8' : '#a0b8d0',
                    border: isToday ? '1px solid #0057B840' : '1px solid transparent',
                    cursor: isWeekend || isPast ? 'default' : 'pointer',
                    textDecoration: blocked ? 'line-through' : 'none',
                  }}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>

        {/* Panel derecho */}
        <div className="space-y-4">

          {/* Formulario añadir motivo */}
          {selectedDate && (
            <div className="rounded-2xl p-5 space-y-3" style={{ background: '#0d1829', border: '1px solid #0057B8' }}>
              <p className="text-white font-bold">Bloquear {getDayName(selectedDate)}, {formatDate(selectedDate)}</p>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Motivo (opcional)"
                className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                style={{ background: '#0a1220', border: '1.5px solid #1a2d45' }}
                onFocus={e => e.target.style.borderColor = '#0057B8'}
                onBlur={e => e.target.style.borderColor = '#1a2d45'}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedDate(null)}
                  className="flex-1 py-2 rounded-lg text-sm font-bold"
                  style={{ background: '#0a1220', color: '#6b8ab0', border: '1px solid #1a2d45' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={saveBlockedDay}
                  disabled={saving}
                  className="flex-1 py-2 rounded-lg text-sm font-bold text-white transition"
                  style={{ background: '#0057B8' }}
                >
                  {saving ? 'Guardando...' : 'Bloquear día'}
                </button>
              </div>
            </div>
          )}

          {/* Lista de días bloqueados */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid #1a2d45' }}>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0057B8' }}>
                Bloqueados este mes · {blockedDays.length}
              </p>
            </div>
            {blockedDays.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm" style={{ color: '#3a5070' }}>Sin días bloqueados</p>
                <p className="text-xs mt-1" style={{ color: '#1a2d45' }}>Pulsa en el calendario para bloquear un día</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: '#0f1c2e' }}>
                {blockedDays.map(day => (
                  <div key={day.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-white text-sm font-bold">{getDayName(day.date)}, {formatDate(day.date)}</p>
                      {day.reason && <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>{day.reason}</p>}
                    </div>
                    <button
                      onClick={() => toggleDay(day.date)}
                      className="text-xs px-3 py-1.5 rounded-lg font-bold transition"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.2)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'}
                    >
                      Desbloquear
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}