'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateStudentToken } from '@/lib/utils'
import type { PracticeType } from '@/types'
import Link from 'next/link'

export default function NuevoAlumnoPage() {
  const router = useRouter()
  const supabase = createClient()

  const [dni, setDni] = useState('')
  const [fullName, setFullName] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [practiceTypes, setPracticeTypes] = useState<PracticeType[]>(['car'])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function togglePracticeType(type: PracticeType) {
    setPracticeTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  async function handleSubmit() {
    if (!dni || !fullName || !orderNumber) {
      setError('DNI, nombre y número de orden son obligatorios')
      return
    }
    if (practiceTypes.length === 0) {
      setError('Selecciona al menos un tipo de práctica')
      return
    }

    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const token = generateStudentToken()

    const { error: insertError } = await supabase.from('students').insert({
      instructor_id: user.id,
      dni: dni.toUpperCase().trim(),
      full_name: fullName.trim(),
      order_number: parseInt(orderNumber),
      phone: phone.trim() || null,
      practice_types: practiceTypes,
      token,
    })

    if (insertError) {
      setError(insertError.code === '23505'
        ? 'Ya existe un alumno con ese DNI o número de orden'
        : 'Error al crear el alumno. Inténtalo de nuevo.')
      setLoading(false)
      return
    }

    router.push('/admin/alumnos')
  }

  return (
    <div className="p-8 max-w-lg">

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
        <div>
          <p className="text-sm font-medium mb-0.5" style={{ color: '#0057B8' }}>Alumnos</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Nuevo alumno</h1>
        </div>
      </div>

      <div className="rounded-2xl p-6 space-y-5" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>

        {/* Nombre */}
        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: '#a0b8d0' }}>
            Nombre completo <span style={{ color: '#0057B8' }}>*</span>
          </label>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Ana García López"
            className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200"
            style={{ background: '#0a1220', border: '1.5px solid #1a2d45' }}
            onFocus={e => e.target.style.borderColor = '#0057B8'}
            onBlur={e => e.target.style.borderColor = '#1a2d45'}
          />
        </div>

        {/* DNI */}
        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: '#a0b8d0' }}>
            DNI <span style={{ color: '#0057B8' }}>*</span>
          </label>
          <input
            type="text"
            value={dni}
            onChange={e => setDni(e.target.value)}
            placeholder="12345678A"
            maxLength={9}
            className="w-full rounded-xl px-4 py-3 text-white text-sm font-mono outline-none transition-all duration-200"
            style={{ background: '#0a1220', border: '1.5px solid #1a2d45' }}
            onFocus={e => e.target.style.borderColor = '#0057B8'}
            onBlur={e => e.target.style.borderColor = '#1a2d45'}
          />
        </div>

        {/* Nº orden */}
        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: '#a0b8d0' }}>
            Número de orden <span style={{ color: '#0057B8' }}>*</span>
          </label>
          <input
            type="number"
            value={orderNumber}
            onChange={e => setOrderNumber(e.target.value)}
            placeholder="1"
            min={1}
            className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200"
            style={{ background: '#0a1220', border: '1.5px solid #1a2d45' }}
            onFocus={e => e.target.style.borderColor = '#0057B8'}
            onBlur={e => e.target.style.borderColor = '#1a2d45'}
          />
        </div>

        {/* Teléfono */}
        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: '#a0b8d0' }}>
            Teléfono <span className="font-normal text-xs" style={{ color: '#3a5070' }}>(opcional · recordatorios WhatsApp)</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="612 345 678"
            className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200"
            style={{ background: '#0a1220', border: '1.5px solid #1a2d45' }}
            onFocus={e => e.target.style.borderColor = '#0057B8'}
            onBlur={e => e.target.style.borderColor = '#1a2d45'}
          />
        </div>

        {/* Tipo práctica */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: '#a0b8d0' }}>
            Tipo de prácticas <span style={{ color: '#0057B8' }}>*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: 'car' as PracticeType, label: '🚗 Coche', color: '#0057B8' },
              { value: 'truck' as PracticeType, label: '🚛 Camión', color: '#38bdf8' },
            ]).map(({ value, label, color }) => {
              const selected = practiceTypes.includes(value)
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => togglePracticeType(value)}
                  className="py-3.5 rounded-xl text-sm font-bold transition-all duration-150"
                  style={{
                    background: selected ? `${color}20` : '#0a1220',
                    border: `2px solid ${selected ? color : '#1a2d45'}`,
                    color: selected ? color : '#3a5070',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
            {error}
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3 pt-1">
          <Link
            href="/admin/alumnos"
            className="flex-1 text-center rounded-xl py-3 text-sm font-bold transition"
            style={{ background: '#0a1220', border: '1.5px solid #1a2d45', color: '#6b8ab0' }}
          >
            Cancelar
          </Link>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 rounded-xl py-3 text-sm font-bold transition-all duration-200 text-white"
            style={{ background: loading ? '#1a2d45' : '#0057B8', color: loading ? '#3a5070' : 'white' }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = '#004494' }}
            onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = '#0057B8' }}
          >
            {loading ? 'Guardando...' : 'Crear alumno'}
          </button>
        </div>

      </div>
    </div>
  )
}