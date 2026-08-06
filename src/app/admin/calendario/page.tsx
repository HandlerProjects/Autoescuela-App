'use client'

import { useEffect, useState } from 'react'
import { toDateString, getDayName, formatDate, getPracticeLabel, generateTimeSlots } from '@/lib/utils'
import { getInstructorSessions, isSlotOccupied } from '@/lib/horarios'
import type { Booking, BlockedSlot, PracticeType, PracticeSubtype, Instructor } from '@/types'

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// Los mismos que ofrece la pantalla del alumno, para que las recogidas no se escriban de dos
// formas distintas según quién apunte la práctica.
const PICKUP_LOCATIONS = [
  'Estación de autobuses · Jardinillos',
  'Av. Ramón Carande · frente al Bar Roma',
]

interface StudentOption {
  id: string
  full_name: string
  order_number: number
  instructor_id: string | null
  practice_types: PracticeType[]
}

interface FreeSlot {
  date: string
  time: string
  type: PracticeType
  subtype: PracticeSubtype | null
}

// Una fila de la agenda del día: o la ocupa una práctica, o está libre.
type AgendaRow =
  | { kind: 'booked'; time: string; booking: Booking }
  | { kind: 'free'; time: string; type: PracticeType; subtype: PracticeSubtype | null }

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

export default function CalendarioPage() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [blockedDays, setBlockedDays] = useState<string[]>([])
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [filter, setFilter] = useState<'all' | 'car' | 'truck' | 'moto'>('all')

  // Selector de instructor (solo admin): cada instructor tiene un calendario totalmente
  // independiente, así que el admin siempre elige uno concreto — no existe vista "todos mezclados".
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'instructor' | 'secretary' | null>(null)
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [selectedInstructorId, setSelectedInstructorId] = useState('')
  const [instructorMenuOpen, setInstructorMenuOpen] = useState(false)

  // Alta manual de prácticas: para alumnos que no reservan desde el móvil y avisan por teléfono
  // o en el mostrador.
  const [students, setStudents] = useState<StudentOption[]>([])
  const [assigning, setAssigning] = useState<FreeSlot | null>(null)
  const [assignStudentId, setAssignStudentId] = useState('')
  const [assignPickup, setAssignPickup] = useState('')
  const [assignSaving, setAssignSaving] = useState(false)
  const [assignError, setAssignError] = useState('')

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchMe(); fetchInstructors(); fetchStudents() }, [])

  // Auto-selección del primer instructor (por created_at ascendente, como ya los devuelve
  // /api/profesores/list) en cuanto sabemos que el rol es admin y ya cargó la lista.
  useEffect(() => {
    if (currentUserRole === 'admin' && instructors.length > 0 && !selectedInstructorId) {
      setSelectedInstructorId(instructors[0].id)
    }
  }, [currentUserRole, instructors, selectedInstructorId])

  useEffect(() => {
    // Esperamos a saber el rol para no pedir el modo "todos mezclados" ni un instante;
    // si es admin, esperamos también a tener un instructor seleccionado.
    if (currentUserRole === null) return
    if (currentUserRole === 'admin' && !selectedInstructorId) return
    fetchData()
  }, [currentMonth, currentYear, currentUserRole, selectedInstructorId])

  async function fetchMe() {
    const res = await fetch('/api/auth/me')
    if (res.ok) {
      const data = await res.json()
      setCurrentUserRole(data.role ?? null)
      // Un profesor no pasa por el selector (solo ve su propio calendario), pero igualmente hay
      // que saber quién es para generar los huecos con SU horario y no con el genérico.
      if (data.role === 'instructor' && data.id) setSelectedInstructorId(data.id)
    }
  }

  async function fetchStudents() {
    const res = await fetch('/api/alumnos/list')
    if (res.ok) {
      const data = await res.json()
      setStudents(data.students ?? [])
    }
  }

  async function fetchInstructors() {
    const res = await fetch('/api/profesores/list')
    if (res.ok) {
      const data = await res.json()
      setInstructors(data.instructors ?? [])
    }
  }

  async function fetchData() {
    setLoading(true)
    const from = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
    const lastDay = getDaysInMonth(currentYear, currentMonth)
    const to = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    const instructorParam = currentUserRole === 'admin' && selectedInstructorId ? `&instructorId=${selectedInstructorId}` : ''

    const res = await fetch(`/api/calendario/data?from=${from}&to=${to}${instructorParam}`)
    if (res.status === 403) {
      setForbidden(true)
      setLoading(false)
      return
    }
    if (res.ok) {
      const data = await res.json()
      setBookings(data.bookings ?? [])
      setBlockedDays((data.blockedDays ?? []).map((b: { date: string }) => b.date))
      setBlockedSlots(data.blockedSlots ?? [])
    }
    setLoading(false)
  }

  function bookingsForDate(dateStr: string, status?: 'confirmed' | 'cancelled') {
    return bookings.filter(b => {
      const matchDate = b.practice_date === dateStr
      const matchFilter = filter === 'all' || b.practice_type === filter
      const matchStatus = !status || b.status === status
      return matchDate && matchFilter && matchStatus
    })
  }

  function hasSlotsBlocked(dateStr: string) {
    return blockedSlots.some(s => s.date === dateStr)
  }

  // Profesor cuyo calendario se está mirando: el elegido si es admin, o uno mismo si es profesor.
  const viewedInstructor = instructors.find(i => i.id === selectedInstructorId) ?? null

  function getFreeSlots(dateStr: string) {
    // Las horas salen del horario REAL del profesor, no del genérico 08:00–13:30 / 16:00–19:15:
    // un profesor de media jornada mostraba huecos de tarde que no existían.
    const sessions = getInstructorSessions(viewedInstructor)
    const breakMins = viewedInstructor?.break_minutes ?? 10

    // Solo las reservas vivas ocupan: una cancelada libera su hueco.
    const dayBookings = bookings
      .filter(b => b.practice_date === dateStr && b.status !== 'cancelled')
      .map(b => ({
        start_time: b.start_time,
        practice_type: b.practice_type as PracticeType,
        practice_subtype: b.practice_subtype,
      }))
    const dayBlocked = blockedSlots
      .filter(s => s.date === dateStr)
      .map(s => ({ start_time: s.start_time, end_time: s.end_time }))

    // Se descarta por SOLAPE de tramos, no por coincidencia exacta de hora de inicio: antes un
    // hueco de las 08:55 salía como libre aunque hubiera una clase de 08:50 a 09:35 pisándolo.
    const freeOf = (type: PracticeType, subtype: PracticeSubtype | null) =>
      generateTimeSlots(type, subtype, sessions, breakMins)
        .filter(t => !isSlotOccupied(t, type, subtype, breakMins, dayBookings, dayBlocked))
        .map(t => ({ time: t, type, subtype }))

    if (filter === 'car') return freeOf('car', null)
    if (filter === 'truck') {
      return [...freeOf('truck', 'pista'), ...freeOf('truck', 'circulacion')]
        .sort((a, b) => a.time.localeCompare(b.time))
    }
    if (filter === 'moto') return freeOf('moto', null)

    return [
      ...freeOf('car', null),
      ...freeOf('truck', 'pista'),
      ...freeOf('truck', 'circulacion'),
      ...freeOf('moto', null),
    ].sort((a, b) => a.time.localeCompare(b.time))
  }

  /**
   * Agenda completa del día, hora a hora: las prácticas apuntadas y los huecos que quedan,
   * mezclados en orden. Antes solo se listaban los huecos libres, así que en el listado de
   * abajo no se veía a qué hora tenía alumno el profesor.
   */
  function getDayAgenda(dateStr: string): AgendaRow[] {
    const booked: AgendaRow[] = bookings
      .filter(b => {
        if (b.practice_date !== dateStr) return false
        if (b.status === 'cancelled') return false
        return filter === 'all' || b.practice_type === filter
      })
      .map(b => ({ kind: 'booked' as const, time: b.start_time.substring(0, 5), booking: b }))

    const free: AgendaRow[] = getFreeSlots(dateStr)
      .map(s => ({ kind: 'free' as const, time: s.time, type: s.type, subtype: s.subtype }))

    return [...booked, ...free].sort((a, b) => a.time.localeCompare(b.time))
  }

  function openAssign(slot: FreeSlot) {
    setAssigning(slot)
    setAssignStudentId('')
    setAssignPickup('')
    setAssignError('')
  }

  async function confirmAssign() {
    if (!assigning || !assignStudentId) return
    setAssignSaving(true)
    setAssignError('')

    const res = await fetch('/api/booking/asignar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: assignStudentId,
        instructorId: selectedInstructorId || undefined,
        date: assigning.date,
        startTime: assigning.time,
        practiceType: assigning.type,
        practiceSubtype: assigning.subtype,
        pickupLocation: assignPickup || null,
      }),
    })

    if (res.ok) {
      setAssigning(null)
      await fetchData()
    } else {
      const data = await res.json().catch(() => ({}))
      setAssignError(data.error ?? 'No se pudo apuntar la práctica')
    }
    setAssignSaving(false)
  }

  // Solo alumnos de este profesor que hagan ese tipo de práctica: evita ofrecer en el desplegable
  // a alguien a quien luego el servidor va a rechazar.
  function candidatesFor(slot: FreeSlot): StudentOption[] {
    return students.filter(s =>
      (!selectedInstructorId || s.instructor_id === selectedInstructorId) &&
      (s.practice_types ?? []).includes(slot.type)
    )
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

  if (forbidden) {
    return (
      <div className="px-4 py-6 md:p-8">
        <div className="rounded-2xl p-16 text-center" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          <p className="font-semibold text-white">No tienes acceso a esta sección</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 md:p-8">

      {/* Cabecera */}
      <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: '#0057B8' }}>Agenda</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Calendario</h1>
        </div>
        <div className="flex items-center gap-2 self-start">
          {currentUserRole === 'admin' && (
            <div className="relative">
              <button
                onClick={() => setInstructorMenuOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition"
                style={{ background: '#0d1829', border: '1px solid #1a2d45', color: 'white' }}
              >
                {instructors.find(i => i.id === selectedInstructorId)?.name ?? 'Selecciona profesor'}
                <svg className="w-3 h-3 flex-shrink-0 transition-transform" style={{ color: '#6b8ab0', transform: instructorMenuOpen ? 'rotate(180deg)' : 'none' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {instructorMenuOpen && (
                <div
                  className="absolute left-0 mt-1 rounded-xl overflow-hidden z-10 min-w-[180px]"
                  style={{ background: '#0a1220', border: '1px solid #1a2d45' }}
                >
                  {instructors.map(inst => (
                    <button
                      key={inst.id}
                      onClick={() => { setSelectedInstructorId(inst.id); setInstructorMenuOpen(false) }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold transition"
                      style={{
                        color: inst.id === selectedInstructorId ? '#4d9ff5' : '#a0b8d0',
                        background: inst.id === selectedInstructorId ? 'rgba(0,87,184,0.15)' : 'transparent',
                      }}
                    >
                      {inst.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-1 rounded-xl p-1" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
            {(['all', 'car', 'truck', 'moto'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                style={{
                  background: filter === f ? (f === 'moto' ? '#a78bfa' : '#0057B8') : 'transparent',
                  color: filter === f ? 'white' : '#6b8ab0',
                }}
              >
                {f === 'all' ? 'Todos' : getPracticeLabel(f)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

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
              const hasSlots = hasSlotsBlocked(dateStr)
              const dayBookings = bookingsForDate(dateStr, 'confirmed')
              const carCount = dayBookings.filter(b => b.practice_type === 'car').length
              const truckCount = dayBookings.filter(b => b.practice_type === 'truck').length
              const motoCount = dayBookings.filter(b => b.practice_type === 'moto').length

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className="rounded-xl p-1.5 transition-all duration-150 text-left"
                  style={{
                    background: isSelected ? '#0057B8' : isBlocked ? 'rgba(239,68,68,0.08)' : isToday ? '#0057B810' : 'transparent',
                    border: `1.5px solid ${isSelected ? '#0057B8' : isToday ? '#0057B840' : 'transparent'}`,
                    cursor: 'pointer',
                    minHeight: '56px',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = isBlocked ? 'rgba(239,68,68,0.15)' : '#0057B810' }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = isBlocked ? 'rgba(239,68,68,0.08)' : isToday ? '#0057B810' : 'transparent' }}
                >
                  <p className="text-xs font-black mb-1" style={{
                    color: isSelected ? 'white' : isBlocked ? '#f87171' : isToday ? '#0057B8' : isWeekend ? '#6b8ab0' : '#a0b8d0'
                  }}>
                    {day}
                  </p>
                  {isBlocked && (
                    <div className="w-full h-1 rounded-full" style={{ background: 'rgba(239,68,68,0.4)' }} />
                  )}
                  {!isBlocked && (
                    <div className="space-y-0.5">
                      {hasSlots && (
                        <div className="flex items-center gap-0.5">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: isSelected ? 'rgba(255,165,0,0.7)' : '#f59e0b' }} />
                        </div>
                      )}
                      {carCount > 0 && (
                        <div className="flex items-center gap-0.5">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: isSelected ? 'rgba(255,255,255,0.7)' : '#0057B8' }} />
                          <p className="text-xs font-bold leading-none" style={{ color: isSelected ? 'rgba(255,255,255,0.8)' : '#4f9eff', fontSize: '10px' }}>{carCount}</p>
                        </div>
                      )}
                      {truckCount > 0 && (
                        <div className="flex items-center gap-0.5">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: isSelected ? 'rgba(255,255,255,0.7)' : '#38bdf8' }} />
                          <p className="text-xs font-bold leading-none" style={{ color: isSelected ? 'rgba(255,255,255,0.8)' : '#38bdf8', fontSize: '10px' }}>{truckCount}</p>
                        </div>
                      )}
                      {motoCount > 0 && (
                        <div className="flex items-center gap-0.5">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: isSelected ? 'rgba(255,255,255,0.7)' : '#a78bfa' }} />
                          <p className="text-xs font-bold leading-none" style={{ color: isSelected ? 'rgba(255,255,255,0.8)' : '#a78bfa', fontSize: '10px' }}>{motoCount}</p>
                        </div>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Leyenda */}
          <div className="px-5 py-3 flex flex-wrap items-center gap-4" style={{ borderTop: '1px solid #1a2d45' }}>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: '#0057B8' }} />
              <p className="text-xs" style={{ color: '#3a5070' }}>Coche</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: '#38bdf8' }} />
              <p className="text-xs" style={{ color: '#3a5070' }}>Camión</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: '#a78bfa' }} />
              <p className="text-xs" style={{ color: '#3a5070' }}>Moto</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} />
              <p className="text-xs" style={{ color: '#3a5070' }}>Franja bloqueada</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(239,68,68,0.4)' }} />
              <p className="text-xs" style={{ color: '#3a5070' }}>Día bloqueado</p>
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

              {/* Contenido */}
              <div className="overflow-y-auto" style={{ maxHeight: '520px' }}>

                {/* BANNER DÍA BLOQUEADO */}
                {blockedDays.includes(selectedDate) && (
                  <div className="px-5 py-3 flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
                    <span style={{ color: '#f87171', fontSize: '18px' }}>🚫</span>
                    <p className="text-sm font-bold" style={{ color: '#f87171' }}>Día completo bloqueado</p>
                  </div>
                )}

                {/* BANNER FRANJAS BLOQUEADAS */}
                {!blockedDays.includes(selectedDate) && blockedSlots.filter(s => s.date === selectedDate).length > 0 && (
                  <div style={{ borderBottom: '1px solid #1a2d45' }}>
                    <div className="px-5 py-2" style={{ background: '#0a1220', borderBottom: '1px solid #1a2d45' }}>
                      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f59e0b' }}>Franjas bloqueadas</p>
                    </div>
                    {blockedSlots.filter(s => s.date === selectedDate).map(slot => (
                      <div key={slot.id} className="px-5 py-2.5 flex items-center gap-3" style={{ borderBottom: '1px solid #0f1c2e' }}>
                        <p className="text-xs font-black font-mono w-20 flex-shrink-0" style={{ color: '#f59e0b' }}>{slot.start_time.substring(0,5)}–{slot.end_time.substring(0,5)}</p>
                        <p className="text-xs" style={{ color: '#6b8ab0' }}>{slot.reason ?? 'Sin motivo'}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* RESERVAS CONFIRMADAS */}
                {(() => {
                  const dayBookings = bookingsForDate(selectedDate, 'confirmed').sort((a, b) => a.start_time.localeCompare(b.start_time))
                  if (dayBookings.length === 0) return (
                    <div className="px-5 py-8 text-center" style={{ borderBottom: '1px solid #1a2d45' }}>
                      <p className="text-sm font-semibold" style={{ color: '#3a5070' }}>Sin reservas confirmadas</p>
                    </div>
                  )
                  return (
                    <div>
                      <div className="px-5 py-2" style={{ background: '#0a1220', borderBottom: '1px solid #1a2d45' }}>
                        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#22c55e' }}>Reservas confirmadas</p>
                      </div>
                      {dayBookings.map(booking => {
                        const type = booking.practice_type as PracticeType
                        const subtype = booking.practice_subtype
                        const iscar = type === 'car'
                        const isExpanded = expandedBookingId === booking.id
                        return (
                          <div key={booking.id}>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => setExpandedBookingId(isExpanded ? null : booking.id)}
                              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedBookingId(isExpanded ? null : booking.id) } }}
                              className="px-5 py-3 flex items-center gap-3 transition cursor-pointer"
                              style={{ borderBottom: isExpanded ? 'none' : '1px solid #0f1c2e', background: isExpanded ? '#0f1c2e' : 'transparent' }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#0f1c2e'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = isExpanded ? '#0f1c2e' : 'transparent'}
                            >
                              <p className="text-xs font-black font-mono w-12 flex-shrink-0" style={{ color: '#6b8ab0' }}>{booking.start_time.substring(0, 5)}</p>
                              <div className="w-px h-6 flex-shrink-0" style={{ background: '#1a2d45' }} />
                              <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: iscar ? '#0057B8' : type === 'moto' ? '#a78bfa' : '#38bdf8' }} />
                              <div className="flex-1">
                                <p className="text-white text-sm font-bold">{booking.student?.full_name ?? '—'}</p>
                                <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>
                                  {getPracticeLabel(type, subtype)} · #{booking.student?.order_number}
                                </p>
                              </div>
                              <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{
                                background: iscar ? '#0057B820' : type === 'moto' ? '#a78bfa20' : '#38bdf820',
                                color: iscar ? '#4f9eff' : type === 'moto' ? '#a78bfa' : '#38bdf8',
                              }}>
                                {getPracticeLabel(type, subtype)}
                              </span>
                              <svg className="w-3.5 h-3.5 flex-shrink-0 transition-transform" style={{ color: '#3a5070', transform: isExpanded ? 'rotate(180deg)' : 'none' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                            {isExpanded && (
                              <div className="px-5 py-3" style={{ background: '#0a1220', borderBottom: '1px solid #0f1c2e' }}>
                                <div className="flex items-start gap-2 mb-2">
                                  <span className="text-xs font-bold uppercase tracking-widest flex-shrink-0" style={{ color: '#3a5070' }}>Horario</span>
                                  <span className="text-xs font-mono" style={{ color: '#6b8ab0' }}>{booking.start_time.substring(0, 5)} – {booking.end_time.substring(0, 5)}</span>
                                </div>
                                <div className="flex items-start gap-2 mb-2">
                                  <span className="text-xs font-bold uppercase tracking-widest flex-shrink-0" style={{ color: '#3a5070' }}>Recogida</span>
                                  <span className="text-xs" style={{ color: booking.pickup_location ? '#6b8ab0' : '#3a5070' }}>
                                    {booking.pickup_location || 'Sin lugar de recogida indicado'}
                                  </span>
                                </div>
                                {booking.notes && (
                                  <div className="flex items-start gap-2 mb-2">
                                    <span className="text-xs font-bold uppercase tracking-widest flex-shrink-0" style={{ color: '#3a5070' }}>Notas</span>
                                    <span className="text-xs" style={{ color: '#6b8ab0' }}>{booking.notes}</span>
                                  </div>
                                )}
                                <button
                                  onClick={() => setExpandedBookingId(null)}
                                  className="text-xs font-semibold mt-1"
                                  style={{ color: '#5a7699' }}
                                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
                                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#5a7699'}
                                >
                                  Cerrar
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}

                {/* AGENDA DEL DÍA — todas las horas, ocupadas y libres (si el día no está bloqueado) */}
                {!blockedDays.includes(selectedDate) && (() => {
                  const agenda = getDayAgenda(selectedDate)
                  const tramos: [string, AgendaRow[]][] = [
                    ['Mañana', agenda.filter(r => r.time < '14:00')],
                    ['Tarde', agenda.filter(r => r.time >= '14:00')],
                  ]

                  return (
                    <>
                      {tramos.map(([label, filas]) => filas.length === 0 ? null : (
                        <div key={label}>
                          <div className="px-5 py-2" style={{ background: '#0a1220', borderBottom: '1px solid #1a2d45' }}>
                            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#3a5070' }}>
                              Agenda · {label}
                            </p>
                          </div>

                          {filas.map(row => {
                            if (row.kind === 'booked') {
                              const b = row.booking
                              const type = b.practice_type as PracticeType
                              return (
                                <div
                                  key={`b-${b.id}`}
                                  className="px-5 py-2.5 flex items-center gap-3"
                                  style={{ borderBottom: '1px solid #0f1c2e', background: '#0d1829' }}
                                >
                                  <p className="text-xs font-black font-mono w-12 flex-shrink-0" style={{ color: '#a0b8d0' }}>{row.time}</p>
                                  <div
                                    className="w-1 h-5 rounded-full flex-shrink-0"
                                    style={{ background: type === 'car' ? '#0057B8' : type === 'moto' ? '#a78bfa' : '#38bdf8' }}
                                  />
                                  <p className="text-xs font-bold text-white flex-1 truncate">
                                    {b.student?.full_name ?? '—'}
                                  </p>
                                  <span className="text-xs flex-shrink-0" style={{ color: '#3a5070' }}>
                                    {getPracticeLabel(type, b.practice_subtype)}
                                  </span>
                                </div>
                              )
                            }

                            // Hueco libre: se puede apuntar un alumno a mano desde aquí.
                            const slot: FreeSlot = { date: selectedDate, time: row.time, type: row.type, subtype: row.subtype }
                            return (
                              <button
                                key={`f-${row.time}-${row.type}-${row.subtype}`}
                                onClick={() => openAssign(slot)}
                                className="w-full px-5 py-2.5 flex items-center gap-3 transition text-left"
                                style={{ borderBottom: '1px solid #0f1c2e' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#0f1c2e'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                              >
                                <p className="text-xs font-mono w-12 flex-shrink-0" style={{ color: '#5a7699' }}>{row.time}</p>
                                <div className="w-px h-5 flex-shrink-0" style={{ background: '#1a2d45' }} />
                                <p className="text-xs flex-1" style={{ color: '#5a7699' }}>
                                  Libre · {getPracticeLabel(row.type, row.subtype)}
                                </p>
                                <span className="text-xs font-bold flex-shrink-0" style={{ color: '#0057B8' }}>+ Apuntar</span>
                              </button>
                            )
                          })}
                        </div>
                      ))}
                    </>
                  )
                })()}

                {/* CLASES CANCELADAS */}
                {(() => {
                  const cancelled = bookingsForDate(selectedDate, 'cancelled').sort((a, b) => a.start_time.localeCompare(b.start_time))
                  if (cancelled.length === 0) return null
                  return (
                    <div>
                      <div className="px-5 py-2" style={{ background: '#0a1220', borderBottom: '1px solid #1a2d45' }}>
                        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f87171' }}>Canceladas</p>
                      </div>
                      {cancelled.map(booking => {
                        const type = booking.practice_type as PracticeType
                        const subtype = booking.practice_subtype
                        return (
                          <div key={booking.id} className="px-5 py-3 flex items-center gap-3 opacity-60" style={{ borderBottom: '1px solid #0f1c2e' }}>
                            <p className="text-xs font-black font-mono w-12 flex-shrink-0 line-through" style={{ color: '#6b8ab0' }}>{booking.start_time.substring(0, 5)}</p>
                            <div className="w-px h-6 flex-shrink-0" style={{ background: '#1a2d45' }} />
                            <div className="flex-1">
                              <p className="text-white text-sm font-bold line-through">{booking.student?.full_name ?? '—'}</p>
                              <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>{getPracticeLabel(type, subtype)}</p>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                              Cancelada
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}

              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── APUNTAR PRÁCTICA A MANO ── */}
      {assigning && (() => {
        const candidatos = candidatesFor(assigning)
        return (
          <>
            <div
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.65)' }}
              onClick={() => { if (!assignSaving) setAssigning(null) }}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div
                className="w-full max-w-sm rounded-2xl p-6 pointer-events-auto"
                style={{ background: '#0d1829', border: '1px solid #1a2d45' }}
              >
                <p className="text-white font-black text-lg mb-1">Apuntar práctica</p>
                <p className="text-sm mb-5" style={{ color: '#6b8ab0' }}>
                  {getDayName(assigning.date)} {formatDate(assigning.date)} · <span className="font-mono font-bold text-white">{assigning.time}</span> · {getPracticeLabel(assigning.type, assigning.subtype)}
                </p>

                {candidatos.length === 0 ? (
                  <p className="text-xs mb-5 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>
                    Este profesor no tiene alumnos de {getPracticeLabel(assigning.type, assigning.subtype)}.
                  </p>
                ) : (
                  <>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#a0b8d0' }}>Alumno</label>
                    <select
                      value={assignStudentId}
                      onChange={e => setAssignStudentId(e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none mb-4"
                      style={{ background: '#0a1220', border: '1.5px solid #1a2d45' }}
                    >
                      <option value="">Selecciona un alumno</option>
                      {candidatos.map(s => (
                        <option key={s.id} value={s.id}>#{s.order_number} · {s.full_name}</option>
                      ))}
                    </select>

                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#a0b8d0' }}>Lugar de recogida</label>
                    <select
                      value={assignPickup}
                      onChange={e => setAssignPickup(e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none mb-5"
                      style={{ background: '#0a1220', border: '1.5px solid #1a2d45' }}
                    >
                      <option value="">Sin especificar</option>
                      {PICKUP_LOCATIONS.map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  </>
                )}

                {assignError && (
                  <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                    {assignError}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setAssigning(null)}
                    disabled={assignSaving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold transition"
                    style={{ background: '#0a1220', color: '#6b8ab0', border: '1px solid #1a2d45' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmAssign}
                    disabled={assignSaving || !assignStudentId}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition"
                    style={{
                      background: !assignStudentId ? '#1a2d45' : '#0057B8',
                      color: !assignStudentId ? '#3a5070' : 'white',
                      opacity: assignSaving ? 0.6 : 1,
                    }}
                  >
                    {assignSaving ? 'Apuntando...' : 'Apuntar'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}