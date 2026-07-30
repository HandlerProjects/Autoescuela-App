'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getPracticeLabel } from '@/lib/utils'
import type { Student, PracticeType } from '@/types'
import Link from 'next/link'

export default function InstructorAlumnoPerfilPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const supabase = createClient()

  const [student, setStudent] = useState<Student | null>(null)
  const [instructorId, setInstructorId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [togglingExam, setTogglingExam] = useState(false)
  const [copied, setCopied] = useState(false)
  const [notes, setNotes] = useState('')
  const [editNotes, setEditNotes] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    setLoading(true)
    // Identidad y rol resueltos vía getSessionUser() (canónico, src/lib/auth.ts) en vez de
    // consultar la tabla instructors directamente desde el cliente.
    const meRes = await fetch('/api/auth/me')
    if (!meRes.ok) { router.push('/instructor/alumnos'); return }
    const me = await meRes.json()
    if (me.role !== 'instructor') { router.push('/instructor/alumnos'); return }
    setInstructorId(me.id)

    const { data: studentData } = await supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .eq('instructor_id', me.id)
      .single()

    if (!studentData) { router.push('/instructor/alumnos'); return }

    setStudent(studentData)
    setNotes(studentData.notes ?? '')
    setLoading(false)
  }

  async function toggleExamMode() {
    if (!student) return
    setTogglingExam(true)
    const newVal = !student.exam_mode
    await supabase.from('students').update({ exam_mode: newVal }).eq('id', student.id).eq('instructor_id', instructorId)
    setStudent(prev => prev ? { ...prev, exam_mode: newVal } : prev)
    setTogglingExam(false)
  }

  async function savePreferredSchedule(value: string) {
    if (!student) return
    const newVal = student.preferred_schedule === value ? null : value
    await supabase.from('students').update({ preferred_schedule: newVal }).eq('id', id).eq('instructor_id', instructorId)
    setStudent(prev => prev ? { ...prev, preferred_schedule: newVal } : prev)
  }

  async function togglePreferredDay(day: number) {
    if (!student) return
    const current = student.preferred_days ?? []
    const newDays = current.includes(day) ? current.filter(d => d !== day) : [...current, day].sort((a, b) => a - b)
    await supabase.from('students').update({ preferred_days: newDays }).eq('id', id).eq('instructor_id', instructorId)
    setStudent(prev => prev ? { ...prev, preferred_days: newDays } : prev)
  }

  async function saveNotes() {
    setSavingNotes(true)
    await supabase.from('students').update({ notes: notes.trim() || null }).eq('id', id).eq('instructor_id', instructorId)
    setStudent(prev => prev ? { ...prev, notes: notes.trim() || null } : prev)
    setSavingNotes(false)
    setEditNotes(false)
  }

  async function copyLink() {
    if (!student) return
    await navigator.clipboard.writeText(`${window.location.origin}/s/${student.token}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const typeColors: Record<PracticeType, { bg: string; text: string }> = {
    car: { bg: '#0057B820', text: '#0057B8' },
    truck: { bg: '#38bdf820', text: '#38bdf8' },
    moto: { bg: '#a78bfa20', text: '#a78bfa' },
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-96">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0057B8', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!student) return null

  return (
    <div className="px-4 py-6 md:p-8 max-w-4xl">

      {/* Cabecera */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/instructor/alumnos"
          className="p-2 rounded-xl transition"
          style={{ color: '#6b8ab0' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#6b8ab0'}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <p className="text-sm font-medium mb-0.5" style={{ color: '#0057B8' }}>Perfil de alumno</p>
          <h1 className="text-3xl font-black text-white tracking-tight">{student.full_name}</h1>
        </div>
        <span className="text-sm font-black px-3 py-1.5 rounded-lg flex-shrink-0" style={{ background: '#0057B820', color: '#0057B8' }}>
          #{student.order_number}
        </span>
      </div>

      <div className="space-y-4">

        {/* Datos básicos */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0057B8' }}>Datos</p>

          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: '#3a5070' }}>DNI</p>
            <p className="text-white font-mono font-bold">{student.dni}</p>
          </div>

          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: '#3a5070' }}>Teléfono</p>
            <p className="text-sm font-bold" style={{ color: student.phone ? 'white' : '#3a5070' }}>
              {student.phone ?? 'Sin teléfono'}
            </p>
          </div>

          {student.email && (
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: '#3a5070' }}>Email</p>
              <p className="text-sm font-bold break-all text-white">{student.email}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: '#3a5070' }}>Prácticas habilitadas</p>
            <div className="flex gap-2">
              {(student.practice_types as PracticeType[]).map(t => (
                <span key={t} className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{
                  background: typeColors[t]?.bg,
                  color: typeColors[t]?.text,
                }}>
                  {getPracticeLabel(t)}
                </span>
              ))}
            </div>
          </div>

          {/* Modo examen — único campo editable de esta tarjeta */}
          <div className="pt-3" style={{ borderTop: '1px solid #1a2d45' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: student.exam_mode ? '#f59e0b' : '#0057B8' }}>
                  {student.exam_mode ? '🎯 Modo examen activo' : 'Modo examen'}
                </p>
                <p className="text-xs" style={{ color: '#3a5070' }}>
                  {student.exam_mode
                    ? 'Puede reservar mañana + tarde el mismo día'
                    : 'Máximo 1 práctica por día · 5 por semana'}
                </p>
              </div>
              <button
                onClick={toggleExamMode}
                disabled={togglingExam}
                className="px-4 py-2 rounded-xl text-xs font-bold transition"
                style={{
                  background: student.exam_mode ? '#f59e0b20' : '#0a1220',
                  border: `1.5px solid ${student.exam_mode ? '#f59e0b' : '#1a2d45'}`,
                  color: student.exam_mode ? '#f59e0b' : '#3a5070',
                  opacity: togglingExam ? 0.6 : 1,
                }}
              >
                {student.exam_mode ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        </div>

        {/* Preferencias y notas */}
        <div className="rounded-2xl p-5 space-y-5" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0057B8' }}>Preferencias y notas</p>

          {/* Horario preferido */}
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: '#3a5070' }}>Horario preferido</p>
            <div className="flex gap-2">
              {([
                { value: 'morning', label: 'Mañanas' },
                { value: 'afternoon', label: 'Tardes' },
                { value: 'any', label: 'Indiferente' },
              ] as const).map(({ value, label }) => {
                const active = student.preferred_schedule === value
                return (
                  <button
                    key={value}
                    onClick={() => savePreferredSchedule(value)}
                    className="flex-1 py-2 rounded-xl text-xs font-bold transition"
                    style={{
                      background: active ? '#0057B820' : '#0a1220',
                      border: `1.5px solid ${active ? '#0057B8' : '#1a2d45'}`,
                      color: active ? '#0057B8' : '#3a5070',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Días preferidos */}
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: '#3a5070' }}>Días preferidos</p>
            <div className="flex gap-1.5">
              {['L', 'M', 'X', 'J', 'V', 'S'].map((day, idx) => {
                const active = (student.preferred_days ?? []).includes(idx)
                return (
                  <button
                    key={idx}
                    onClick={() => togglePreferredDay(idx)}
                    className="w-9 h-9 rounded-xl text-xs font-black transition flex items-center justify-center"
                    style={{
                      background: active ? '#0057B820' : '#0a1220',
                      border: `1.5px solid ${active ? '#0057B8' : '#1a2d45'}`,
                      color: active ? '#0057B8' : '#3a5070',
                    }}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Notas */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold" style={{ color: '#3a5070' }}>Notas internas</p>
              {!editNotes && (
                <button
                  onClick={() => { setEditNotes(true); setNotes(student.notes ?? '') }}
                  className="text-xs font-semibold transition"
                  style={{ color: '#3a5070' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#3a5070'}
                >
                  Editar
                </button>
              )}
            </div>
            {editNotes ? (
              <div className="space-y-2">
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Alumno nervioso, prefiere las mañanas del miércoles, empieza con coche..."
                  rows={4}
                  className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none resize-none"
                  style={{ background: '#0a1220', border: '1.5px solid #0057B8' }}
                />
                <div className="flex gap-2">
                  <button onClick={() => setEditNotes(false)} className="flex-1 py-2 rounded-lg text-xs font-bold"
                    style={{ background: '#0a1220', color: '#6b8ab0', border: '1px solid #1a2d45' }}>Cancelar</button>
                  <button onClick={saveNotes} disabled={savingNotes} className="flex-1 py-2 rounded-lg text-xs font-bold text-white"
                    style={{ background: '#0057B8' }}>{savingNotes ? 'Guardando...' : 'Guardar'}</button>
                </div>
              </div>
            ) : (
              <p
                className="text-sm leading-relaxed"
                style={{ color: student.notes ? '#a0b8d0' : '#3a5070', fontStyle: student.notes ? 'normal' : 'italic' }}
              >
                {student.notes ?? 'Sin notas'}
              </p>
            )}
          </div>
        </div>

        {/* Credenciales de acceso */}
        <div className="rounded-2xl p-5" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#0057B8' }}>Acceso alumno</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: '#3a5070' }}>DNI</span>
              <span className="text-sm font-black font-mono text-white">{student.dni}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: '#3a5070' }}>PIN</span>
              <span className="text-sm font-black font-mono text-white">
                {student.dni.replace(/\D/g, '').slice(-4)}
              </span>
            </div>
          </div>
          <p className="text-xs mt-3" style={{ color: '#3a5070' }}>El alumno entra en <span style={{ color: '#6b8ab0' }}>/alumno</span> · PIN = últimos 4 dígitos del DNI.</p>
        </div>

        {/* Enlace alumno */}
        <div className="rounded-2xl p-5" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#0057B8' }}>Enlace de reserva</p>
          <p className="text-xs font-mono mb-3 break-all" style={{ color: '#3a5070' }}>
            {typeof window !== 'undefined' ? `${window.location.origin}/s/${student.token}` : `/s/${student.token}`}
          </p>
          <button
            onClick={copyLink}
            className="w-full py-2.5 rounded-xl text-sm font-bold transition"
            style={{ background: copied ? 'rgba(52,211,153,0.1)' : '#0057B820', color: copied ? '#34d399' : '#0057B8' }}
          >
            {copied ? '✓ Copiado' : '🔗 Copiar enlace'}
          </button>
        </div>

      </div>
    </div>
  )
}
