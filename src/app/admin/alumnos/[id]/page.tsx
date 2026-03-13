'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatTime, getDayName, getPracticeLabel, getStatusLabel, getStatusColor } from '@/lib/utils'
import type { Student, Booking } from '@/types'
import Link from 'next/link'

export default function AlumnoPerfilPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const supabase = createClient()

  const [student, setStudent] = useState<Student | null>(null)
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

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    setLoading(true)
    const [{ data: studentData }, { data: bookingsData }] = await Promise.all([
      supabase.from('students').select('*').eq('id', id).single(),
      supabase.from('bookings').select('*').eq('student_id', id).order('practice_date', { ascending: false }),
    ])
    if (!studentData) { router.push('/admin/alumnos'); return }
    setStudent(studentData)
    setPhone(studentData.phone ?? '')
    setEmail(studentData.email ?? '')
    if (bookingsData) setBookings(bookingsData)
    setLoading(false)
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

  async function togglePracticeType(type: 'car' | 'truck') {
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
  const lastBooking = bookings.find(b => b.status === 'completed')

  return (
    <div className="p-8 max-w-4xl">

      {/* Cabecera */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin/alumnos"
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

      <div className="grid grid-cols-3 gap-6">

        {/* Columna izquierda — datos */}
        <div className="col-span-1 space-y-4">

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
                {(['car', 'truck'] as const).map(type => {
                  const active = student.practice_types.includes(type)
                  const isOnly = student.practice_types.length === 1 && active
                  return (
                    <button
                      key={type}
                      onClick={() => togglePracticeType(type)}
                      disabled={savingTypes || isOnly}
                      title={isOnly ? 'Debe tener al menos un tipo' : undefined}
                      className="flex-1 py-2 rounded-xl text-xs font-bold transition"
                      style={{
                        background: active ? (type === 'car' ? '#0057B820' : '#38bdf820') : '#0a1220',
                        border: `1.5px solid ${active ? (type === 'car' ? '#0057B8' : '#38bdf8') : '#1a2d45'}`,
                        color: active ? (type === 'car' ? '#0057B8' : '#38bdf8') : '#3a5070',
                        opacity: savingTypes ? 0.6 : 1,
                        cursor: isOnly ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {type === 'car' ? '🚗 Coche' : '🚛 Camión'}
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

          {/* Credenciales de acceso */}
          <div className="rounded-2xl p-5" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#0057B8' }}>Acceso alumno</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: '#3a5070' }}>Código</span>
                <span className="text-sm font-black font-mono text-white">{student.login_code ?? `Alumno-${student.order_number.toString().padStart(3, '0')}`}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: '#3a5070' }}>PIN</span>
                <span className="text-sm font-black font-mono text-white">{student.login_pin ?? student.order_number.toString().padStart(3, '0')}</span>
              </div>
            </div>
            <p className="text-xs mt-3" style={{ color: '#3a5070' }}>El alumno entra en <span style={{ color: '#6b8ab0' }}>/alumno</span> con estas credenciales.</p>
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
          <div className="grid grid-cols-4 gap-3">
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
              ].map(({ label, count, color, total }) => (
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
                    <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: booking.practice_type === 'car' ? '#0057B8' : '#38bdf8' }} />
                    <div className="flex-1">
                      <p className="text-white text-sm font-bold">
                        {getDayName(booking.practice_date)}, {formatDate(booking.practice_date)}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>
                        {formatTime(booking.start_time)} – {formatTime(booking.end_time)} · {getPracticeLabel(booking.practice_type)}
                      </p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${getStatusColor(booking.status)}`}>
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