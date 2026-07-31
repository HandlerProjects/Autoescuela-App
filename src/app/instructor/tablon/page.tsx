'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getPracticeLabel } from '@/lib/utils'
import type { PracticeType } from '@/types'

interface QueueStudent {
  id: string
  full_name: string
  dni: string
  order_number: number
  phone: string | null
  practice_types: PracticeType[]
  notes: string | null
  created_at: string
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'Hace un momento'
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`
  return `Hace ${Math.floor(diff / 86400)} día${Math.floor(diff / 86400) > 1 ? 's' : ''}`
}

function isRecent(dateStr: string): boolean {
  return Date.now() - new Date(dateStr).getTime() < 2 * 60 * 60 * 1000
}

const TYPE_COLORS: Record<PracticeType, { bg: string; color: string; emoji: string }> = {
  car:   { bg: 'rgba(0,87,184,0.15)',    color: '#0057B8', emoji: '🚗' },
  truck: { bg: 'rgba(56,189,248,0.15)',  color: '#38bdf8', emoji: '🚛' },
  moto:  { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa', emoji: '🏍️' },
}

export default function TablonPage() {
  const supabase = createClient()

  const [instructorId, setInstructorId] = useState<string | null>(null)
  const [instructorName, setInstructorName] = useState('')
  const [instructorTypes, setInstructorTypes] = useState<PracticeType[]>([])
  const [students, setStudents] = useState<QueueStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<PracticeType | 'all'>('all')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // init() (identidad + datos del instructor) y loadQueue() (lista del tablón) no dependen
    // entre sí — se lanzan en paralelo en vez de encadenados, y el spinner se quita cuando
    // ambos han terminado, no cuando termina el más lento de los dos en serie.
    let cancelled = false
    Promise.all([init(), loadQueue()]).finally(() => { if (!cancelled) setLoading(false) })
    refreshRef.current = setInterval(loadQueue, 30000)
    return () => { cancelled = true; if (refreshRef.current) clearInterval(refreshRef.current) }
  }, [])

  async function init() {
    const meRes = await fetch('/api/auth/me')
    if (!meRes.ok) return
    const me = await meRes.json()
    if (me.role !== 'instructor') return

    const { data: instructor } = await supabase
      .from('instructors')
      .select('id, name, practice_types')
      .eq('id', me.id)
      .single()

    if (instructor) {
      setInstructorId(instructor.id)
      setInstructorName(instructor.name)
      setInstructorTypes(instructor.practice_types ?? ['car'])
    }
  }

  async function loadQueue() {
    const res = await fetch('/api/tablon/list')
    const json = await res.json()
    if (json.students) setStudents(json.students)
  }

  async function handleClaim(studentId: string) {
    setClaiming(true)
    const res = await fetch('/api/tablon/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId }),
    })
    if (res.ok) {
      const { instructorName: name } = await res.json()
      setStudents(prev => prev.filter(s => s.id !== studentId))
      if (name || instructorName) {
        fetch('/api/notify-claimed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId, instructorName: name ?? instructorName }),
        }).catch(() => {})
      }
    }
    setConfirmId(null)
    setClaiming(false)
  }

  // Filtrar por tipos compatibles con el instructor
  const compatible = students.filter(s =>
    s.practice_types.some(t => instructorTypes.includes(t))
  )

  const filtered = filterType === 'all'
    ? compatible
    : compatible.filter(s => s.practice_types.includes(filterType))

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: '#0057B8' }}>Tablón de alumnos</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Alumnos disponibles</h1>
          <p className="text-sm mt-1" style={{ color: '#6b8ab0' }}>
            Compatibles con tus prácticas · se actualiza cada 30s
          </p>
        </div>
        {compatible.length > 0 && (
          <div className="px-4 py-2 rounded-xl" style={{ background: 'rgba(0,87,184,0.1)', border: '1px solid rgba(0,87,184,0.3)' }}>
            <span className="text-2xl font-black" style={{ color: '#60a5fa' }}>{compatible.length}</span>
            <span className="text-xs font-semibold ml-2" style={{ color: '#6b8ab0' }}>disponibles</span>
          </div>
        )}
      </div>

      {/* Filtros por tipo */}
      {instructorTypes.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setFilterType('all')}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition"
            style={{
              background: filterType === 'all' ? '#0057B8' : '#0d1829',
              color: filterType === 'all' ? 'white' : '#6b8ab0',
              border: `1px solid ${filterType === 'all' ? '#0057B8' : '#1a2d45'}`,
            }}
          >
            Todos ({compatible.length})
          </button>
          {instructorTypes.map(t => {
            const count = compatible.filter(s => s.practice_types.includes(t)).length
            return (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition"
                style={{
                  background: filterType === t ? TYPE_COLORS[t].color : '#0d1829',
                  color: filterType === t ? 'white' : '#6b8ab0',
                  border: `1px solid ${filterType === t ? TYPE_COLORS[t].color : '#1a2d45'}`,
                }}
              >
                {TYPE_COLORS[t].emoji} {getPracticeLabel(t)} ({count})
              </button>
            )
          })}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0057B8', borderTopColor: 'transparent' }} />
        </div>
      ) : !instructorId ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          <p className="text-white font-semibold">Sin instructor asignado</p>
          <p className="text-sm mt-1" style={{ color: '#6b8ab0' }}>Pide al administrador que vincule tu cuenta</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          <svg className="w-12 h-12 mx-auto mb-4" style={{ color: '#1a2d45' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="font-semibold text-white">Tablón vacío</p>
          <p className="text-sm mt-1" style={{ color: '#6b8ab0' }}>No hay alumnos compatibles en espera</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map((s, idx) => (
            <div
              key={s.id}
              className="rounded-2xl p-5 flex flex-col gap-4"
              style={{ background: '#0d1829', border: `1px solid ${isRecent(s.created_at) ? 'rgba(0,87,184,0.5)' : '#1a2d45'}` }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm"
                  style={{ background: 'rgba(0,87,184,0.15)', color: '#0057B8' }}>
                  {s.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-bold">{s.full_name}</p>
                    {isRecent(s.created_at) && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,87,184,0.2)', color: '#60a5fa' }}>
                        Nuevo
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono mt-0.5" style={{ color: '#3a5070' }}>
                    {s.dni} · #{String(s.order_number).padStart(3, '0')}
                  </p>
                  {s.phone && <p className="text-xs mt-1" style={{ color: '#6b8ab0' }}>📱 {s.phone}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs" style={{ color: '#3a5070' }}>Cola</p>
                  <p className="text-lg font-black" style={{ color: '#6b8ab0' }}>{idx + 1}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {s.practice_types.map(t => (
                  <span key={t} className="text-xs font-bold px-3 py-1.5 rounded-lg"
                    style={{ background: TYPE_COLORS[t].bg, color: TYPE_COLORS[t].color }}>
                    {TYPE_COLORS[t].emoji} {getPracticeLabel(t)}
                  </span>
                ))}
              </div>

              {s.notes && (
                <div className="rounded-xl px-4 py-3 text-sm italic" style={{ background: '#0a1220', color: '#6b8ab0', borderLeft: '3px solid #1a2d45' }}>
                  "{s.notes}"
                </div>
              )}

              <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid #0f1c2e' }}>
                <p className="text-xs" style={{ color: '#3a5070' }}>⏱ {timeAgo(s.created_at)}</p>

                {confirmId === s.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setConfirmId(null)}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                      style={{ background: '#0a1220', color: '#6b8ab0', border: '1px solid #1a2d45' }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleClaim(s.id)}
                      disabled={claiming}
                      className="text-xs px-4 py-1.5 rounded-lg font-bold text-white"
                      style={{ background: claiming ? '#1a2d45' : '#0057B8' }}
                    >
                      {claiming ? 'Asignando...' : '✓ Confirmar'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(s.id)}
                    className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl text-white transition-all"
                    style={{ background: '#0057B8' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#004494'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#0057B8'}
                  >
                    Elegir alumno
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
