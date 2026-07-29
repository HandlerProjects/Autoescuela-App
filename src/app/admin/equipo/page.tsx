'use client'

import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils'
import type { Staff, Instructor } from '@/types'

type StaffRole = 'admin' | 'instructor' | 'secretary'
type StaffMember = Staff & { instructor: Instructor | null }

const ROLE_CONFIG: Record<StaffRole, { label: string; bg: string; color: string }> = {
  admin:      { label: 'Admin',      bg: 'rgba(0,87,184,0.15)',    color: '#4d9ff5' },
  instructor: { label: 'Instructor', bg: 'rgba(52,211,153,0.1)',   color: '#34d399' },
  secretary:  { label: 'Secretaria', bg: 'rgba(167,139,250,0.12)', color: '#a78bfa' },
}

const ROLE_OPTIONS: StaffRole[] = ['admin', 'instructor', 'secretary']

const PRACTICE_TYPE_OPTIONS = [
  { value: 'car', label: '🚗 Coche', color: '#0057B8' },
  { value: 'truck', label: '🚛 Camión', color: '#38bdf8' },
  { value: 'moto', label: '🏍️ Moto', color: '#a78bfa' },
] as const

export default function EquipoPage() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Crear miembro
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createRole, setCreateRole] = useState<StaffRole>('instructor')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState(false)

  // Expandir fila
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Cambio de rol
  const [roleMenuId, setRoleMenuId] = useState<string | null>(null)
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null)

  // Activar/desactivar
  const [toggling, setToggling] = useState<string | null>(null)

  // Eliminar
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Error inline por fila
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null)

  // Detalle de instructor — tipos de práctica
  const [editingTypesId, setEditingTypesId] = useState<string | null>(null)
  const [typesForm, setTypesForm] = useState<string[]>(['car'])
  const [savingTypes, setSavingTypes] = useState(false)

  // Detalle de instructor — hitos
  const [editingMilestonesId, setEditingMilestonesId] = useState<string | null>(null)
  const [milestonesInput, setMilestonesInput] = useState('')
  const [milestonesError, setMilestonesError] = useState('')
  const [savingMilestones, setSavingMilestones] = useState(false)

  // Detalle de instructor — notas
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null)
  const [notesInput, setNotesInput] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // Detalle de instructor — horario
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null)
  const [scheduleForm, setScheduleForm] = useState({
    jornada: 'full' as 'full' | 'half',
    schedule_morning: true, morning_start: '08:00', morning_end: '13:30',
    schedule_afternoon: true, afternoon_start: '16:00', afternoon_end: '19:15',
    break_minutes: 10,
  })
  const [savingSchedule, setSavingSchedule] = useState(false)

  async function fetchMe() {
    const res = await fetch('/api/auth/me')
    if (res.ok) {
      const data = await res.json()
      setCurrentUserId(data.id ?? null)
    }
  }

  async function fetchStaff() {
    setLoading(true)
    const res = await fetch('/api/staff/list')
    const data = res.ok ? (await res.json()).staff : null
    if (data) setStaff(data)
    setLoading(false)
  }

  // Carga inicial de datos al montar — mismo patrón de fetch-on-mount que el resto del panel de admin.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchStaff(); fetchMe() }, [])

  function resetInstructorEditState() {
    setEditingTypesId(null)
    setEditingMilestonesId(null)
    setEditingNotesId(null)
    setEditingScheduleId(null)
    setMilestonesError('')
  }

  function toggleExpand(member: StaffMember) {
    setRoleMenuId(null)
    if (expandedId === member.id) {
      setExpandedId(null)
      resetInstructorEditState()
      return
    }
    setExpandedId(member.id)
    resetInstructorEditState()
  }

  async function handleCreate() {
    if (!createName.trim() || !createEmail.trim()) {
      setCreateError('El nombre y el email son obligatorios')
      return
    }
    setCreating(true)
    setCreateError('')

    const res = await fetch('/api/staff/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: createName.trim(), email: createEmail.trim(), role: createRole }),
    })
    const data = await res.json()

    if (!res.ok || data.error) {
      setCreateError(data.error ?? 'No se pudo crear la cuenta')
      setCreating(false)
      return
    }

    setCreateSuccess(true)
    setCreateName('')
    setCreateEmail('')
    setCreating(false)
    await fetchStaff()
    setTimeout(() => { setCreateSuccess(false); setShowCreate(false); setCreateRole('instructor') }, 2500)
  }

  async function changeRole(member: StaffMember, role: StaffRole) {
    setRoleMenuId(null)
    if (role === member.role) return
    setChangingRoleId(member.id)
    setRowError(null)

    const res = await fetch('/api/staff/role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: member.id, role }),
    })
    const data = await res.json()

    if (!res.ok || data.error) {
      setRowError({ id: member.id, message: data.error ?? 'No se pudo cambiar el rol' })
      setChangingRoleId(null)
      return
    }

    await fetchStaff()
    setChangingRoleId(null)
  }

  async function toggleActive(member: StaffMember) {
    setToggling(member.id)
    setRowError(null)

    const res = await fetch('/api/staff/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: member.id, is_active: !member.is_active }),
    })
    const data = await res.json()

    if (!res.ok || data.error) {
      setRowError({ id: member.id, message: data.error ?? 'No se pudo actualizar el estado' })
      setToggling(null)
      return
    }

    setStaff(prev => prev.map(s => s.id === member.id ? { ...s, is_active: !s.is_active } : s))
    setToggling(null)
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    setRowError(null)

    const res = await fetch('/api/staff/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const data = await res.json()

    if (!res.ok || data.error) {
      setRowError({ id, message: data.error ?? 'No se pudo eliminar' })
      setConfirmDeleteId(null)
      setDeleting(false)
      return
    }

    setStaff(prev => prev.filter(s => s.id !== id))
    setConfirmDeleteId(null)
    setDeleting(false)
    if (expandedId === id) setExpandedId(null)
  }

  async function savePracticeTypes(id: string) {
    if (typesForm.length === 0) return
    setSavingTypes(true)
    setRowError(null)

    const res = await fetch('/api/staff/instructor-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, practice_types: typesForm }),
    })
    const data = await res.json()

    if (!res.ok || data.error) {
      setRowError({ id, message: data.error ?? 'No se pudieron guardar los tipos' })
      setSavingTypes(false)
      return
    }

    setStaff(prev => prev.map(s => s.id === id && s.instructor
      ? { ...s, instructor: { ...s.instructor, practice_types: typesForm as Instructor['practice_types'] } }
      : s))
    setEditingTypesId(null)
    setSavingTypes(false)
  }

  async function saveMilestones(id: string) {
    setMilestonesError('')
    const parsed = milestonesInput
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n > 0)

    if (parsed.length === 0) {
      setMilestonesError('Introduce al menos un número válido')
      return
    }

    const sorted = [...new Set(parsed)].sort((a, b) => a - b)
    setSavingMilestones(true)
    setRowError(null)

    const res = await fetch('/api/staff/instructor-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, milestone_counts: sorted }),
    })
    const data = await res.json()

    if (!res.ok || data.error) {
      setRowError({ id, message: data.error ?? 'No se pudieron guardar los hitos' })
      setSavingMilestones(false)
      return
    }

    setStaff(prev => prev.map(s => s.id === id && s.instructor
      ? { ...s, instructor: { ...s.instructor, milestone_counts: sorted } }
      : s))
    setEditingMilestonesId(null)
    setSavingMilestones(false)
  }

  async function saveInstructorNotes(id: string) {
    setSavingNotes(true)
    setRowError(null)
    const notes = notesInput.trim() || null

    const res = await fetch('/api/staff/instructor-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, notes }),
    })
    const data = await res.json()

    if (!res.ok || data.error) {
      setRowError({ id, message: data.error ?? 'No se pudieron guardar las notas' })
      setSavingNotes(false)
      return
    }

    setStaff(prev => prev.map(s => s.id === id && s.instructor
      ? { ...s, instructor: { ...s.instructor, notes } }
      : s))
    setEditingNotesId(null)
    setSavingNotes(false)
  }

  async function saveSchedule(id: string) {
    setSavingSchedule(true)
    setRowError(null)

    const res = await fetch('/api/staff/instructor-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...scheduleForm }),
    })
    const data = await res.json()

    if (!res.ok || data.error) {
      setRowError({ id, message: data.error ?? 'No se pudo guardar el horario' })
      setSavingSchedule(false)
      return
    }

    setStaff(prev => prev.map(s => s.id === id && s.instructor
      ? { ...s, instructor: { ...s.instructor, ...scheduleForm } }
      : s))
    setEditingScheduleId(null)
    setSavingSchedule(false)
  }

  return (
    <div className="p-8 max-w-3xl">

      {/* Cabecera */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-sm font-medium mb-0.5" style={{ color: '#0057B8' }}>Administración</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Equipo</h1>
          <p className="text-sm mt-1" style={{ color: '#6b8ab0' }}>Todos los miembros del equipo, sus roles y sus datos</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setCreateError(''); setCreateSuccess(false) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition mt-1"
          style={{ background: '#0057B8' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#004494'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#0057B8'}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo miembro
        </button>
      </div>

      {/* Formulario de creación */}
      {showCreate && (
        <div className="rounded-2xl p-5 mb-6 space-y-4" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          <div className="flex items-center justify-between">
            <p className="text-white font-bold">Nuevo miembro del equipo</p>
            <button onClick={() => setShowCreate(false)} style={{ color: '#6b8ab0' }}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {createSuccess ? (
            <div className="rounded-xl px-4 py-4 text-center" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <p className="font-bold text-sm" style={{ color: '#34d399' }}>¡Cuenta creada!</p>
              <p className="text-xs mt-1" style={{ color: '#34d399', opacity: 0.7 }}>
                Las credenciales se han enviado por email.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#a0b8d0' }}>Rol</label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLE_OPTIONS.map(r => {
                    const rc = ROLE_CONFIG[r]
                    const selected = createRole === r
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setCreateRole(r)}
                        className="py-2.5 rounded-xl text-xs font-bold transition"
                        style={{
                          background: selected ? rc.bg : '#0a1220',
                          border: `2px solid ${selected ? rc.color : '#1a2d45'}`,
                          color: selected ? rc.color : '#3a5070',
                        }}
                      >
                        {rc.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {[
                { label: 'Nombre completo', value: createName, setter: setCreateName, type: 'text', placeholder: 'Carlos García' },
                { label: 'Email', value: createEmail, setter: setCreateEmail, type: 'email', placeholder: 'carlos@autoescuela.com' },
              ].map(({ label, value, setter, type, placeholder }) => (
                <div key={label}>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#a0b8d0' }}>{label}</label>
                  <input
                    type={type}
                    value={value}
                    onChange={e => setter(e.target.value)}
                    placeholder={placeholder}
                    className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                    style={{ background: '#0a1220', border: '1.5px solid #1a2d45' }}
                    onFocus={e => e.target.style.borderColor = '#0057B8'}
                    onBlur={e => e.target.style.borderColor = '#1a2d45'}
                  />
                </div>
              ))}

              {createError && (
                <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                  {createError}
                </div>
              )}

              <button
                onClick={handleCreate}
                disabled={creating || !createName || !createEmail}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition"
                style={{
                  background: creating || !createName || !createEmail ? '#1a2d45' : '#0057B8',
                  color: creating || !createName || !createEmail ? '#3a5070' : 'white',
                }}
              >
                {creating ? 'Creando...' : 'Crear cuenta y enviar credenciales'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Tabla de equipo */}
      {loading ? (
        <div className="text-sm" style={{ color: '#6b8ab0' }}>Cargando...</div>
      ) : staff.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          <p className="font-semibold text-white">Sin miembros</p>
        </div>
      ) : (
        <div className="space-y-2">
          {staff.map(member => {
            const rc = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.secretary
            const isSelf = member.id === currentUserId
            const isExpanded = expandedId === member.id
            const inst = member.instructor

            return (
              <div
                key={member.id}
                className="rounded-2xl overflow-hidden"
                style={{ background: '#0d1829', border: `1px solid ${member.is_active ? '#1a2d45' : '#2a1a1a'}` }}
              >
                {/* Fila principal */}
                <div
                  className="px-5 py-4 flex items-center gap-3 cursor-pointer flex-wrap sm:flex-nowrap"
                  onClick={() => toggleExpand(member)}
                >
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-black text-sm"
                    style={{ background: rc.bg, color: rc.color }}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Nombre + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold truncate">{member.name}</p>
                    <p className="text-xs truncate" style={{ color: '#3a5070' }}>{member.email}</p>
                  </div>

                  {/* Rol — badge clicable con menú desplegable */}
                  <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => !isSelf && setRoleMenuId(roleMenuId === member.id ? null : member.id)}
                      disabled={isSelf || changingRoleId === member.id}
                      title={isSelf ? 'No puedes cambiar tu propio rol' : 'Cambiar rol'}
                      className="text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 transition"
                      style={{
                        background: rc.bg,
                        color: rc.color,
                        opacity: isSelf ? 0.6 : 1,
                        cursor: isSelf ? 'default' : 'pointer',
                      }}
                    >
                      {changingRoleId === member.id ? 'Guardando...' : rc.label}
                      {!isSelf && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>

                    {roleMenuId === member.id && (
                      <div
                        className="absolute right-0 mt-1 rounded-xl overflow-hidden z-10 min-w-[130px]"
                        style={{ background: '#0a1220', border: '1px solid #1a2d45' }}
                      >
                        {ROLE_OPTIONS.map(r => (
                          <button
                            key={r}
                            onClick={() => changeRole(member, r)}
                            className="w-full text-left px-3 py-2 text-xs font-semibold transition"
                            style={{
                              color: r === member.role ? ROLE_CONFIG[r].color : '#a0b8d0',
                              background: r === member.role ? ROLE_CONFIG[r].bg : 'transparent',
                            }}
                          >
                            {ROLE_CONFIG[r].label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Alta */}
                  <div className="text-right text-xs hidden sm:block flex-shrink-0" style={{ color: '#3a5070' }}>
                    <p>Alta</p>
                    <p className="font-semibold" style={{ color: '#6b8ab0' }}>{formatDate(member.created_at.split('T')[0])}</p>
                  </div>

                  {/* Estado */}
                  <span
                    className="text-xs px-2.5 py-1 rounded-full font-bold flex-shrink-0"
                    style={{
                      background: member.is_active ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                      color: member.is_active ? '#34d399' : '#f87171',
                    }}
                  >
                    {member.is_active ? 'Activo' : 'Inactivo'}
                  </span>

                  {/* Toggle activo/inactivo */}
                  {!isSelf && (
                    <button
                      onClick={e => { e.stopPropagation(); toggleActive(member) }}
                      disabled={toggling === member.id}
                      title="No puedes desactivar tu propia cuenta"
                      className="text-xs px-3 py-1.5 rounded-xl font-semibold transition flex-shrink-0"
                      style={{
                        background: '#0a1220',
                        border: '1px solid #1a2d45',
                        color: toggling === member.id ? '#3a5070' : '#6b8ab0',
                        opacity: toggling === member.id ? 0.5 : 1,
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#6b8ab0'}
                    >
                      {member.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                  )}

                  {/* Eliminar */}
                  <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                    {confirmDeleteId === member.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(member.id)}
                          disabled={deleting}
                          className="text-xs px-2.5 py-1 rounded-lg font-semibold transition"
                          style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
                        >
                          {deleting ? '...' : '¿Eliminar?'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs px-2 py-1 rounded-lg font-semibold transition"
                          style={{ color: '#6b8ab0', background: '#0a1220', border: '1px solid #1a2d45' }}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(member.id)}
                        className="p-1.5 rounded-lg transition"
                        style={{ color: '#3a5070' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#3a5070'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Chevron de expandir */}
                  <svg
                    className="w-4 h-4 flex-shrink-0 transition-transform"
                    style={{ color: '#3a5070', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Error inline de esta fila */}
                {rowError?.id === member.id && (
                  <div className="px-5 pb-3">
                    <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                      {rowError.message}
                    </div>
                  </div>
                )}

                {/* Panel de detalle */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-1 space-y-3" style={{ borderTop: '1px solid #1a2d45' }}>
                    {member.role !== 'instructor' ? (
                      <p className="text-xs pt-4" style={{ color: '#3a5070' }}>
                        {member.role === 'admin'
                          ? 'Los admins tienen acceso completo al panel y no tienen datos adicionales que configurar aquí.'
                          : 'Las secretarias gestionan alumnos, pagos y el tablón. No tienen datos adicionales que configurar aquí.'}
                      </p>
                    ) : (
                      <>
                        {/* Botones de sub-edición */}
                        <div className="flex flex-wrap gap-2 pt-4">
                          <button
                            onClick={() => {
                              const opening = editingTypesId !== member.id
                              resetInstructorEditState()
                              if (opening) {
                                setEditingTypesId(member.id)
                                setTypesForm(inst?.practice_types ?? ['car'])
                              }
                            }}
                            className="text-xs px-2.5 py-1 rounded-lg font-semibold transition"
                            style={{ color: '#6b8ab0', background: '#0a1220', border: '1px solid #1a2d45' }}
                          >
                            {editingTypesId === member.id ? 'Cancelar' : '🚗 Tipos'}
                          </button>
                          <button
                            onClick={() => {
                              const opening = editingMilestonesId !== member.id
                              resetInstructorEditState()
                              if (opening) {
                                setEditingMilestonesId(member.id)
                                setMilestonesInput((inst?.milestone_counts ?? [5, 10, 15, 20]).join(', '))
                              }
                            }}
                            className="text-xs px-2.5 py-1 rounded-lg font-semibold transition"
                            style={{ color: '#6b8ab0', background: '#0a1220', border: '1px solid #1a2d45' }}
                          >
                            {editingMilestonesId === member.id ? 'Cancelar' : '🎯 Hitos'}
                          </button>
                          <button
                            onClick={() => {
                              const opening = editingNotesId !== member.id
                              resetInstructorEditState()
                              if (opening) {
                                setEditingNotesId(member.id)
                                setNotesInput(inst?.notes ?? '')
                              }
                            }}
                            className="text-xs px-2.5 py-1 rounded-lg font-semibold transition"
                            style={{
                              color: editingNotesId === member.id ? '#a78bfa' : '#6b8ab0',
                              background: editingNotesId === member.id ? 'rgba(167,139,250,0.1)' : '#0a1220',
                              border: `1px solid ${editingNotesId === member.id ? 'rgba(167,139,250,0.3)' : '#1a2d45'}`,
                            }}
                          >
                            {editingNotesId === member.id ? 'Cancelar' : '📝 Notas'}
                          </button>
                          <button
                            onClick={() => {
                              const opening = editingScheduleId !== member.id
                              resetInstructorEditState()
                              if (opening) {
                                setEditingScheduleId(member.id)
                                setScheduleForm({
                                  jornada: inst?.jornada ?? 'full',
                                  schedule_morning: inst?.schedule_morning ?? true,
                                  morning_start: (inst?.morning_start ?? '08:00').substring(0, 5),
                                  morning_end: (inst?.morning_end ?? '13:30').substring(0, 5),
                                  schedule_afternoon: inst?.schedule_afternoon ?? true,
                                  afternoon_start: (inst?.afternoon_start ?? '16:00').substring(0, 5),
                                  afternoon_end: (inst?.afternoon_end ?? '19:15').substring(0, 5),
                                  break_minutes: inst?.break_minutes ?? 10,
                                })
                              }
                            }}
                            className="text-xs px-2.5 py-1 rounded-lg font-semibold transition"
                            style={{ color: '#6b8ab0', background: '#0a1220', border: '1px solid #1a2d45' }}
                          >
                            {editingScheduleId === member.id ? 'Cancelar' : '⏰ Horario'}
                          </button>
                        </div>

                        {/* Resumen — cuando no hay ningún sub-formulario abierto */}
                        {editingTypesId !== member.id && editingMilestonesId !== member.id &&
                          editingNotesId !== member.id && editingScheduleId !== member.id && (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-3 text-xs" style={{ color: '#3a5070' }}>
                              <span>{(inst?.jornada ?? 'full') === 'half' ? '🕓 Media jornada' : '🕗 Jornada completa'}</span>
                              {(inst?.schedule_morning ?? true) && (
                                <span>☀️ {(inst?.morning_start ?? '08:00').substring(0, 5)} – {(inst?.morning_end ?? '13:30').substring(0, 5)}</span>
                              )}
                              {(inst?.schedule_afternoon ?? true) && (
                                <span>🌆 {(inst?.afternoon_start ?? '16:00').substring(0, 5)} – {(inst?.afternoon_end ?? '19:15').substring(0, 5)}</span>
                              )}
                              <span>⏱ Descanso: {inst?.break_minutes ?? 10} min</span>
                              <span>🎯 Hitos: {(inst?.milestone_counts ?? [5, 10, 15, 20]).join(', ')}</span>
                              <span>🚗 Tipos: {(inst?.practice_types ?? ['car']).join(', ')}</span>
                            </div>
                            {inst?.notes && (
                              <p className="text-xs leading-relaxed" style={{ color: '#6b8ab0', borderLeft: '2px solid #1a2d45', paddingLeft: '10px' }}>
                                {inst.notes}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Formulario — tipos de práctica */}
                        {editingTypesId === member.id && (
                          <div className="rounded-xl p-4 space-y-3" style={{ background: '#0a1220', border: '1px solid #1a2d45' }}>
                            <p className="text-xs font-semibold" style={{ color: '#6b8ab0' }}>Tipos de práctica que imparte este profesor</p>
                            <div className="grid grid-cols-3 gap-2">
                              {PRACTICE_TYPE_OPTIONS.map(({ value, label, color }) => {
                                const selected = typesForm.includes(value)
                                return (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => setTypesForm(prev => selected ? prev.filter(t => t !== value) : [...prev, value])}
                                    className="py-2.5 rounded-xl text-xs font-bold transition"
                                    style={{
                                      background: selected ? `${color}20` : '#0d1829',
                                      border: `2px solid ${selected ? color : '#1a2d45'}`,
                                      color: selected ? color : '#3a5070',
                                    }}
                                  >
                                    {label}
                                  </button>
                                )
                              })}
                            </div>
                            <button
                              onClick={() => savePracticeTypes(member.id)}
                              disabled={savingTypes || typesForm.length === 0}
                              className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition"
                              style={{ background: savingTypes || typesForm.length === 0 ? '#1a2d45' : '#0057B8' }}
                            >
                              {savingTypes ? 'Guardando...' : 'Guardar tipos'}
                            </button>
                          </div>
                        )}

                        {/* Formulario — hitos */}
                        {editingMilestonesId === member.id && (
                          <div className="rounded-xl p-4 space-y-3" style={{ background: '#0a1220', border: '1px solid #1a2d45' }}>
                            <p className="text-xs font-semibold" style={{ color: '#6b8ab0' }}>
                              Número de prácticas completadas en los que el alumno recibe un email de felicitación.
                            </p>
                            <div>
                              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#a0b8d0' }}>
                                Hitos (separados por comas)
                              </label>
                              <input
                                type="text"
                                value={milestonesInput}
                                onChange={e => setMilestonesInput(e.target.value)}
                                placeholder="5, 10, 15, 20"
                                className="w-full rounded-lg px-3 py-2 text-white text-sm outline-none"
                                style={{ background: '#0d1829', border: '1px solid #1a2d45' }}
                              />
                            </div>
                            {milestonesError && (
                              <p className="text-xs" style={{ color: '#f87171' }}>{milestonesError}</p>
                            )}
                            <button
                              onClick={() => saveMilestones(member.id)}
                              disabled={savingMilestones}
                              className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition"
                              style={{ background: savingMilestones ? '#1a2d45' : '#0057B8' }}
                            >
                              {savingMilestones ? 'Guardando...' : 'Guardar hitos'}
                            </button>
                          </div>
                        )}

                        {/* Formulario — notas */}
                        {editingNotesId === member.id && (
                          <div className="rounded-xl p-4 space-y-3" style={{ background: '#0a1220', border: '1px solid #1a2d45' }}>
                            <p className="text-xs font-semibold" style={{ color: '#6b8ab0' }}>Notas internas del instructor</p>
                            <textarea
                              value={notesInput}
                              onChange={e => setNotesInput(e.target.value)}
                              placeholder="Solo da camión los viernes, prefiere que le avisen con antelación..."
                              rows={4}
                              className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none resize-none"
                              style={{ background: '#0d1829', border: '1px solid #1a2d45' }}
                            />
                            <button
                              onClick={() => saveInstructorNotes(member.id)}
                              disabled={savingNotes}
                              className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition"
                              style={{ background: savingNotes ? '#1a2d45' : '#0057B8' }}
                            >
                              {savingNotes ? 'Guardando...' : 'Guardar notas'}
                            </button>
                          </div>
                        )}

                        {/* Formulario — horario */}
                        {editingScheduleId === member.id && (
                          <div className="rounded-xl p-4 space-y-4" style={{ background: '#0a1220', border: '1px solid #1a2d45' }}>

                            {/* Tipo de jornada */}
                            <div>
                              <p className="text-xs font-semibold mb-2" style={{ color: '#6b8ab0' }}>Tipo de jornada</p>
                              <div className="grid grid-cols-2 gap-2">
                                {([
                                  { value: 'full', label: '🕗 Jornada completa', desc: '~40h semanales' },
                                  { value: 'half', label: '🕓 Media jornada', desc: '~20h semanales' },
                                ] as const).map(({ value, label, desc }) => (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => setScheduleForm(f => ({
                                      ...f,
                                      jornada: value,
                                      schedule_afternoon: value === 'half' ? false : f.schedule_afternoon,
                                    }))}
                                    className="py-2.5 px-3 rounded-xl text-left transition"
                                    style={{
                                      background: scheduleForm.jornada === value ? '#0057B820' : '#0d1829',
                                      border: `2px solid ${scheduleForm.jornada === value ? '#0057B8' : '#1a2d45'}`,
                                    }}
                                  >
                                    <p className="text-xs font-bold" style={{ color: scheduleForm.jornada === value ? '#0057B8' : '#6b8ab0' }}>{label}</p>
                                    <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>{desc}</p>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Mañana */}
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <input
                                  type="checkbox"
                                  id={`morning-${member.id}`}
                                  checked={scheduleForm.schedule_morning}
                                  onChange={e => setScheduleForm(f => ({ ...f, schedule_morning: e.target.checked }))}
                                />
                                <label htmlFor={`morning-${member.id}`} className="text-sm font-bold text-white cursor-pointer">Turno de mañana</label>
                              </div>
                              {scheduleForm.schedule_morning && (
                                <div className="grid grid-cols-2 gap-2 ml-6">
                                  <div>
                                    <p className="text-xs mb-1" style={{ color: '#6b8ab0' }}>Desde</p>
                                    <input
                                      type="time"
                                      value={scheduleForm.morning_start}
                                      onChange={e => setScheduleForm(f => ({ ...f, morning_start: e.target.value }))}
                                      className="w-full rounded-lg px-2 py-1.5 text-white text-sm outline-none"
                                      style={{ background: '#0d1829', border: '1px solid #1a2d45' }}
                                    />
                                  </div>
                                  <div>
                                    <p className="text-xs mb-1" style={{ color: '#6b8ab0' }}>Hasta</p>
                                    <input
                                      type="time"
                                      value={scheduleForm.morning_end}
                                      onChange={e => setScheduleForm(f => ({ ...f, morning_end: e.target.value }))}
                                      className="w-full rounded-lg px-2 py-1.5 text-white text-sm outline-none"
                                      style={{ background: '#0d1829', border: '1px solid #1a2d45' }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Tarde */}
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <input
                                  type="checkbox"
                                  id={`afternoon-${member.id}`}
                                  checked={scheduleForm.schedule_afternoon}
                                  onChange={e => setScheduleForm(f => ({ ...f, schedule_afternoon: e.target.checked }))}
                                />
                                <label htmlFor={`afternoon-${member.id}`} className="text-sm font-bold text-white cursor-pointer">Turno de tarde</label>
                              </div>
                              {scheduleForm.schedule_afternoon && (
                                <div className="grid grid-cols-2 gap-2 ml-6">
                                  <div>
                                    <p className="text-xs mb-1" style={{ color: '#6b8ab0' }}>Desde</p>
                                    <input
                                      type="time"
                                      value={scheduleForm.afternoon_start}
                                      onChange={e => setScheduleForm(f => ({ ...f, afternoon_start: e.target.value }))}
                                      className="w-full rounded-lg px-2 py-1.5 text-white text-sm outline-none"
                                      style={{ background: '#0d1829', border: '1px solid #1a2d45' }}
                                    />
                                  </div>
                                  <div>
                                    <p className="text-xs mb-1" style={{ color: '#6b8ab0' }}>Hasta</p>
                                    <input
                                      type="time"
                                      value={scheduleForm.afternoon_end}
                                      onChange={e => setScheduleForm(f => ({ ...f, afternoon_end: e.target.value }))}
                                      className="w-full rounded-lg px-2 py-1.5 text-white text-sm outline-none"
                                      style={{ background: '#0d1829', border: '1px solid #1a2d45' }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Descanso entre prácticas */}
                            <div>
                              <p className="text-xs font-semibold mb-2" style={{ color: '#6b8ab0' }}>
                                Descanso entre prácticas
                                <span className="ml-2 font-normal" style={{ color: '#3a5070' }}>(camión circulación siempre 30 min)</span>
                              </p>
                              <div className="flex items-center gap-3">
                                {[5, 10, 15, 20].map(mins => (
                                  <button
                                    key={mins}
                                    type="button"
                                    onClick={() => setScheduleForm(f => ({ ...f, break_minutes: mins }))}
                                    className="flex-1 py-2 rounded-xl text-xs font-bold transition"
                                    style={{
                                      background: scheduleForm.break_minutes === mins ? '#0057B820' : '#0d1829',
                                      border: `2px solid ${scheduleForm.break_minutes === mins ? '#0057B8' : '#1a2d45'}`,
                                      color: scheduleForm.break_minutes === mins ? '#0057B8' : '#3a5070',
                                    }}
                                  >
                                    {mins} min
                                  </button>
                                ))}
                              </div>
                            </div>

                            <button
                              onClick={() => saveSchedule(member.id)}
                              disabled={savingSchedule}
                              className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition"
                              style={{ background: savingSchedule ? '#1a2d45' : '#0057B8' }}
                            >
                              {savingSchedule ? 'Guardando...' : 'Guardar horario'}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Nota informativa */}
      <div className="mt-6 rounded-xl px-4 py-3 flex gap-3" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#3a5070' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs leading-relaxed" style={{ color: '#3a5070' }}>
          Los <span style={{ color: '#6b8ab0' }}>instructores</span> pueden ver el calendario y gestionar sus alumnos.
          Las <span style={{ color: '#6b8ab0' }}>secretarias</span> gestionan alumnos, pagos y el tablón de asignación.
          Los <span style={{ color: '#6b8ab0' }}>admins</span> tienen acceso completo. No puedes cambiar tu propio rol ni desactivar tu propia cuenta,
          y la autoescuela siempre debe tener al menos un admin activo.
        </p>
      </div>

    </div>
  )
}
