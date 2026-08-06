'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatTime, getDayName, getPracticeLabel, getStatusLabel, getStatusColor } from '@/lib/utils'
import type { Student, Booking, Instructor } from '@/types'
import Link from 'next/link'

export default function AlumnoPerfilPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const supabase = createClient()

  const [student, setStudent] = useState<Student | null>(null)
  const [instructorName, setInstructorName] = useState<string | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [editPhone, setEditPhone] = useState(false)
  const [phone, setPhone] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)
  const [editEmail, setEditEmail] = useState(false)
  const [email, setEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)
  const [savingTypes, setSavingTypes] = useState(false)
  const [editLimits, setEditLimits] = useState(false)
  const [maxWeekly, setMaxWeekly] = useState(5)
  const [maxDaily, setMaxDaily] = useState(1)
  const [savingLimits, setSavingLimits] = useState(false)
  const [notes, setNotes] = useState('')
  const [editNotes, setEditNotes] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [editStartDate, setEditStartDate] = useState(false)
  const [savingStartDate, setSavingStartDate] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'instructor' | 'secretary' | null>(null)
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [editInstructor, setEditInstructor] = useState(false)
  const [selectedInstructorId, setSelectedInstructorId] = useState('')
  const [savingInstructor, setSavingInstructor] = useState(false)

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    setLoading(true)
    const [{ data: studentData }, { data: bookingsData }, meRes, instructorsRes] = await Promise.all([
      supabase.from('students').select('*, instructor:instructors(name)').eq('id', id).single(),
      supabase.from('bookings').select('*').eq('student_id', id).order('practice_date', { ascending: false }),
      fetch('/api/auth/me'),
      fetch('/api/profesores/list'),
    ])
    if (!studentData) { router.push('/admin/alumnos'); return }
    setInstructorName((studentData as any).instructor?.name ?? null)
    setStudent(studentData)
    setPhone(studentData.phone ?? '')
    setEmail(studentData.email ?? '')
    setMaxWeekly(studentData.max_weekly_bookings ?? 5)
    setMaxDaily(studentData.max_daily_bookings ?? 1)
    setNotes(studentData.notes ?? '')
    setStartDate(studentData.start_date ?? '')
    if (bookingsData) setBookings(bookingsData)
    if (meRes.ok) {
      const me = await meRes.json()
      setCurrentUserRole(me.role ?? null)
    }
    if (instructorsRes.ok) {
      const instructorsData = await instructorsRes.json()
      setInstructors(instructorsData.instructors ?? [])
    }
    setLoading(false)
  }

  async function saveInstructor() {
    setSavingInstructor(true)
    const instructorId = selectedInstructorId || null
    const res = await fetch('/api/alumnos/reassign-instructor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, instructorId }),
    })
    const data = await res.json()
    if (!res.ok || data.error) {
      alert(data.error ?? 'No se pudo cambiar el profesor')
      setSavingInstructor(false)
      return
    }
    setInstructorName(data.instructorName ?? null)
    setStudent(prev => prev ? { ...prev, instructor_id: instructorId } : prev)
    setSavingInstructor(false)
    setEditInstructor(false)
  }

  async function copyLink() {
    if (!student) return
    await navigator.clipboard.writeText(`${window.location.origin}/s/${student.token}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function savePhone() {
    if (!student) return
    setSavingPhone(true)
    await supabase.from('students').update({ phone: phone.trim() || null }).eq('id', id)
    setStudent(prev => prev ? { ...prev, phone: phone.trim() || null } : prev)
    setSavingPhone(false)
    setEditPhone(false)
  }

  async function saveLimits() {
    if (!student) return
    setSavingLimits(true)
    await supabase.from('students').update({ max_weekly_bookings: maxWeekly, max_daily_bookings: maxDaily }).eq('id', id)
    setStudent(prev => prev ? { ...prev, max_weekly_bookings: maxWeekly, max_daily_bookings: maxDaily } : prev)
    setSavingLimits(false)
    setEditLimits(false)
  }

  async function toggleExamMode() {
    if (!student) return
    const newVal = !student.exam_mode
    await supabase.from('students').update({ exam_mode: newVal }).eq('id', id)
    setStudent(prev => prev ? { ...prev, exam_mode: newVal } : prev)
  }

  async function togglePracticeType(type: 'car' | 'truck' | 'moto') {
    if (!student) return
    const has = student.practice_types.includes(type)
    // Evitar dejar el array vacío
    if (has && student.practice_types.length === 1) return
    const newTypes = has
      ? student.practice_types.filter(t => t !== type)
      : [...student.practice_types, type]
    setSavingTypes(true)
    await supabase.from('students').update({ practice_types: newTypes }).eq('id', id)
    setStudent(prev => prev ? { ...prev, practice_types: newTypes } : prev)
    setSavingTypes(false)
  }

  async function saveEmail() {
    if (!student) return
    setSavingEmail(true)
    await supabase.from('students').update({ email: email.trim() || null }).eq('id', id)
    setStudent(prev => prev ? { ...prev, email: email.trim() || null } : prev)
    setSavingEmail(false)
    setEditEmail(false)
  }

  async function saveNotes() {
    setSavingNotes(true)
    await supabase.from('students').update({ notes: notes.trim() || null }).eq('id', id)
    setStudent(prev => prev ? { ...prev, notes: notes.trim() || null } : prev)
    setSavingNotes(false)
    setEditNotes(false)
  }

  async function saveStartDate() {
    setSavingStartDate(true)
    await supabase.from('students').update({ start_date: startDate || null }).eq('id', id)
    setStudent(prev => prev ? { ...prev, start_date: startDate || null } : prev)
    setSavingStartDate(false)
    setEditStartDate(false)
  }

  async function savePreferredSchedule(value: string) {
    const newVal = student?.preferred_schedule === value ? null : value
    await supabase.from('students').update({ preferred_schedule: newVal }).eq('id', id)
    setStudent(prev => prev ? { ...prev, preferred_schedule: newVal } : prev)
  }

  async function togglePreferredDay(day: number) {
    const current = student?.preferred_days ?? []
    const newDays = current.includes(day) ? current.filter(d => d !== day) : [...current, day].sort((a, b) => a - b)
    await supabase.from('students').update({ preferred_days: newDays }).eq('id', id)
    setStudent(prev => prev ? { ...prev, preferred_days: newDays } : prev)
  }

  async function toggleActive() {
    if (!student) return
    const newStatus = !student.is_active
    if (!confirm(`¿${newStatus ? 'Activar' : 'Desactivar'} este alumno?`)) return
    await supabase.from('students').update({ is_active: newStatus }).eq('id', id)
    setStudent(prev => prev ? { ...prev, is_active: newStatus } : prev)
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-96">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0057B8', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!student) return null

  const totalBookings = bookings.length
  const completedBookings = bookings.filter(b => b.status === 'completed').length
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length
  const carBookings = bookings.filter(b => b.practice_type === 'car').length
  const truckBookings = bookings.filter(b => b.practice_type === 'truck').length
  const motoBookings = bookings.filter(b => b.practice_type === 'moto').length
  const lastBooking = bookings.find(b => b.status === 'completed')

  return (
    <div className="px-4 py-6 md:p-8 max-w-4xl">

      {/* Cabecera */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin/alumnos"
          prefetch={false}
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
        <div className="flex gap-2">
          <button
            onClick={toggleActive}
            className="px-4 py-2 rounded-xl text-sm font-bold transition"
            style={{
              background: student.is_active ? 'rgba(239,68,68,0.1)' : 'rgba(52,211,153,0.1)',
              color: student.is_active ? '#f87171' : '#34d399',
            }}
          >
            {student.is_active ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Columna izquierda — datos */}
        <div className="col-span-1 space-y-4">

          {/* Instructor asignado */}
          <div className="rounded-2xl p-5" style={{ background: '#0d1829', border: `1px solid ${instructorName ? '#0057B840' : '#1a2d45'}` }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0057B8' }}>Profesor</p>
              {(currentUserRole === 'admin' || currentUserRole === 'secretary') && !editInstructor && (
                <button
                  onClick={() => { setEditInstructor(true); setSelectedInstructorId(student.instructor_id ?? '') }}
                  className="text-xs font-semibold transition"
                  style={{ color: '#3a5070' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#3a5070'}
                >
                  Cambiar
                </button>
              )}
            </div>
            {editInstructor ? (
              <div className="space-y-2">
                <select
                  value={selectedInstructorId}
                  onChange={e => setSelectedInstructorId(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                  style={{ background: '#0a1220', border: '1.5px solid #0057B8' }}
                >
                  <option value="">Sin asignar (vuelve al tablón)</option>
                  {instructors.map(instructor => (
                    <option key={instructor.id} value={instructor.id}>{instructor.name}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditInstructor(false)}
                    className="flex-1 py-2 rounded-lg text-xs font-bold transition"
                    style={{ background: '#0a1220', color: '#6b8ab0', border: '1px solid #1a2d45' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={saveInstructor}
                    disabled={savingInstructor}
                    className="flex-1 py-2 rounded-lg text-xs font-bold text-white transition"
                    style={{ background: '#0057B8' }}
                  >
                    {savingInstructor ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            ) : instructorName ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0" style={{ background: '#0057B820', color: '#0057B8' }}>
                  {instructorName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{instructorName}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>Profesor asignado</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#0f1c2e' }}>
                  <svg className="w-4 h-4" style={{ color: '#3a5070' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#3a5070' }}>Sin asignar</p>
                  <p className="text-xs mt-0.5" style={{ color: '#1a2d45' }}>Pendiente en el tablón</p>
                </div>
              </div>
            )}
          </div>

          {/* Datos personales */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0057B8' }}>Datos</p>

            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: '#3a5070' }}>DNI</p>
              <p className="text-white font-mono font-bold">{student.dni}</p>
            </div>

            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: '#3a5070' }}>Nº orden</p>
              <span className="text-sm font-black px-3 py-1 rounded-lg" style={{ background: '#0057B820', color: '#0057B8' }}>
                #{student.order_number}
              </span>
            </div>

            <div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: '#3a5070' }}>Prácticas habilitadas</p>
              <div className="flex gap-2">
                {(['car', 'truck', 'moto'] as const).map(type => {
                  const active = student.practice_types.includes(type)
                  const isOnly = student.practice_types.length === 1 && active
                  const color = type === 'car' ? '#0057B8' : type === 'truck' ? '#38bdf8' : '#a78bfa'
                  return (
                    <button
                      key={type}
                      onClick={() => togglePracticeType(type)}
                      disabled={savingTypes || isOnly}
                      title={isOnly ? 'Debe tener al menos un tipo' : undefined}
                      className="flex-1 py-2 rounded-xl text-xs font-bold transition"
                      style={{
                        background: active ? `${color}20` : '#0a1220',
                        border: `1.5px solid ${active ? color : '#1a2d45'}`,
                        color: active ? color : '#3a5070',
                        opacity: savingTypes ? 0.6 : 1,
                        cursor: isOnly ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {type === 'car' ? '🚗 Coche' : type === 'truck' ? '🚛 Camión' : '🏍️ Moto'}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: '#3a5070' }}>Alta</p>
              <p className="text-white text-sm">{formatDate(student.created_at.split('T')[0])}</p>
            </div>

            <div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: '#3a5070' }}>Estado</p>
              <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{
                background: student.is_active ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                color: student.is_active ? '#34d399' : '#f87171',
              }}>
                {student.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>

          {/* Modo examen */}
          <div className="rounded-2xl p-5" style={{ background: '#0d1829', border: `1px solid ${student.exam_mode ? '#f59e0b40' : '#1a2d45'}` }}>
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
                className="px-4 py-2 rounded-xl text-xs font-bold transition"
                style={{
                  background: student.exam_mode ? '#f59e0b20' : '#0a1220',
                  border: `1.5px solid ${student.exam_mode ? '#f59e0b' : '#1a2d45'}`,
                  color: student.exam_mode ? '#f59e0b' : '#3a5070',
                }}
              >
                {student.exam_mode ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>

          {/* Teléfono */}
          <div className="rounded-2xl p-5" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0057B8' }}>Teléfono</p>
              {!editPhone && (
                <button
                  onClick={() => setEditPhone(true)}
                  className="text-xs font-semibold transition"
                  style={{ color: '#3a5070' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#3a5070'}
                >
                  Editar
                </button>
              )}
            </div>
            {editPhone ? (
              <div className="space-y-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="612 345 678"
                  className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                  style={{ background: '#0a1220', border: '1.5px solid #0057B8' }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditPhone(false)}
                    className="flex-1 py-2 rounded-lg text-xs font-bold transition"
                    style={{ background: '#0a1220', color: '#6b8ab0', border: '1px solid #1a2d45' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={savePhone}
                    disabled={savingPhone}
                    className="flex-1 py-2 rounded-lg text-xs font-bold text-white transition"
                    style={{ background: '#0057B8' }}
                  >
                    {savingPhone ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm font-bold" style={{ color: student.phone ? 'white' : '#3a5070' }}>
                {student.phone ?? 'Sin teléfono'}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="rounded-2xl p-5" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0057B8' }}>Email</p>
              {!editEmail && (
                <button
                  onClick={() => setEditEmail(true)}
                  className="text-xs font-semibold transition"
                  style={{ color: '#3a5070' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#3a5070'}
                >
                  Editar
                </button>
              )}
            </div>
            {editEmail ? (
              <div className="space-y-2">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="alumno@correo.com"
                  className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                  style={{ background: '#0a1220', border: '1.5px solid #0057B8' }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditEmail(false)}
                    className="flex-1 py-2 rounded-lg text-xs font-bold transition"
                    style={{ background: '#0a1220', color: '#6b8ab0', border: '1px solid #1a2d45' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={saveEmail}
                    disabled={savingEmail}
                    className="flex-1 py-2 rounded-lg text-xs font-bold text-white transition"
                    style={{ background: '#0057B8' }}
                  >
                    {savingEmail ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm font-bold break-all" style={{ color: student.email ? 'white' : '#3a5070' }}>
                {student.email ?? 'Sin email'}
              </p>
            )}
          </div>

          {/* Límites de reserva */}
          <div className="rounded-2xl p-5" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0057B8' }}>Límites de reserva</p>
              {!editLimits && (
                <button onClick={() => setEditLimits(true)} className="text-xs font-semibold transition" style={{ color: '#3a5070' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#3a5070'}>
                  Editar
                </button>
              )}
            </div>
            {editLimits ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#3a5070' }}>Máx. por semana</p>
                  <input type="number" min={1} max={20} value={maxWeekly} onChange={e => setMaxWeekly(Number(e.target.value))}
                    className="w-full rounded-xl px-3 py-2 text-white text-sm outline-none"
                    style={{ background: '#0a1220', border: '1.5px solid #0057B8' }} />
                </div>
                <div>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#3a5070' }}>Máx. por día</p>
                  <input type="number" min={1} max={5} value={maxDaily} onChange={e => setMaxDaily(Number(e.target.value))}
                    className="w-full rounded-xl px-3 py-2 text-white text-sm outline-none"
                    style={{ background: '#0a1220', border: '1.5px solid #0057B8' }} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditLimits(false)} className="flex-1 py-2 rounded-lg text-xs font-bold"
                    style={{ background: '#0a1220', color: '#6b8ab0', border: '1px solid #1a2d45' }}>Cancelar</button>
                  <button onClick={saveLimits} disabled={savingLimits} className="flex-1 py-2 rounded-lg text-xs font-bold text-white"
                    style={{ background: '#0057B8' }}>{savingLimits ? 'Guardando...' : 'Guardar'}</button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#6b8ab0' }}>Por semana</span>
                  <span className="font-bold text-white">{student.max_weekly_bookings ?? 5} prácticas</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#6b8ab0' }}>Por día</span>
                  <span className="font-bold text-white">{student.max_daily_bookings ?? 1} práctica</span>
                </div>
              </div>
            )}
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

            {/* Fecha de inicio */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold" style={{ color: '#3a5070' }}>Inicio de prácticas</p>
                {!editStartDate && (
                  <button
                    onClick={() => setEditStartDate(true)}
                    className="text-xs font-semibold transition"
                    style={{ color: '#3a5070' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#3a5070'}
                  >
                    Editar
                  </button>
                )}
              </div>
              {editStartDate ? (
                <div className="space-y-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                    style={{ background: '#0a1220', border: '1.5px solid #0057B8', colorScheme: 'dark' }}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setEditStartDate(false)} className="flex-1 py-2 rounded-lg text-xs font-bold"
                      style={{ background: '#0a1220', color: '#6b8ab0', border: '1px solid #1a2d45' }}>Cancelar</button>
                    <button onClick={saveStartDate} disabled={savingStartDate} className="flex-1 py-2 rounded-lg text-xs font-bold text-white"
                      style={{ background: '#0057B8' }}>{savingStartDate ? 'Guardando...' : 'Guardar'}</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-bold" style={{ color: student.start_date ? 'white' : '#3a5070' }}>
                  {student.start_date ? formatDate(student.start_date) : 'No especificada'}
                </p>
              )}
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

        {/* Columna derecha — estadísticas + historial */}
        <div className="col-span-2 space-y-4">

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total', value: totalBookings, color: 'white' },
              { label: 'Completadas', value: completedBookings, color: '#34d399' },
              { label: 'Confirmadas', value: confirmedBookings, color: '#0057B8' },
              { label: 'Canceladas', value: cancelledBookings, color: '#f87171' },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl p-4" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#3a5070' }}>{stat.label}</p>
                <p className="text-3xl font-black" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Desglose por tipo */}
          <div className="rounded-2xl p-5" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#0057B8' }}>Desglose por tipo</p>
            <div className="space-y-3">
              {[
                { label: 'Coche', count: carBookings, color: '#0057B8', total: totalBookings },
                { label: 'Camión', count: truckBookings, color: '#38bdf8', total: totalBookings },
                { label: 'Moto', count: motoBookings, color: '#a78bfa', total: totalBookings },
              ].filter(({ count }) => count > 0 || totalBookings === 0).map(({ label, count, color, total }) => (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-semibold" style={{ color: '#a0b8d0' }}>{label}</span>
                    <span className="font-black" style={{ color }}>{count} prácticas</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: '#0a1220' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%', background: color }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {lastBooking && (
              <p className="text-xs mt-4" style={{ color: '#3a5070' }}>
                Última práctica completada: <span style={{ color: '#6b8ab0' }}>{formatDate(lastBooking.practice_date)}</span>
              </p>
            )}
          </div>

          {/* Historial */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid #1a2d45' }}>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0057B8' }}>Historial completo</p>
            </div>
            {bookings.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm font-semibold text-white">Sin prácticas aún</p>
                <p className="text-xs mt-1" style={{ color: '#3a5070' }}>Las reservas aparecerán aquí</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: '#0f1c2e' }}>
                {bookings.map(booking => (
                  <div key={booking.id} className="px-5 py-3.5 flex items-center gap-4 transition"
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#0f1c2e'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: booking.practice_type === 'car' ? '#0057B8' : booking.practice_type === 'truck' ? '#38bdf8' : '#a78bfa' }} />
                    <div className="flex-1">
                      <p className="text-white text-sm font-bold">
                        {getDayName(booking.practice_date)}, {formatDate(booking.practice_date)}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>
                        {formatTime(booking.start_time)} – {formatTime(booking.end_time)} · {getPracticeLabel(booking.practice_type)}
                      </p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={getStatusColor(booking.status)}>
                      {getStatusLabel(booking.status)}
                    </span>
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