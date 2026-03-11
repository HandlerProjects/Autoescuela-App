'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, getPracticeLabel } from '@/lib/utils'
import type { Student } from '@/types'
import Link from 'next/link'

export default function AlumnosPage() {
  const supabase = createClient()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => { fetchStudents() }, [])

  async function fetchStudents() {
    setLoading(true)
    const { data } = await supabase
      .from('students')
      .select('*')
      .eq('is_active', true)
      .order('order_number', { ascending: true })
    if (data) setStudents(data)
    setLoading(false)
  }

  async function copyLink(token: string) {
    const url = `${window.location.origin}/s/${token}`
    await navigator.clipboard.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  async function deactivateStudent(id: string) {
    if (!confirm('¿Desactivar este alumno?')) return
    await supabase.from('students').update({ is_active: false }).eq('id', id)
    fetchStudents()
  }

  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.dni.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8">

      {/* Cabecera */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: '#0057B8' }}>Gestión</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Alumnos</h1>
          <p className="text-sm mt-1" style={{ color: '#6b8ab0' }}>{students.length} alumnos activos</p>
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

      {/* Buscador */}
      <div className="relative mb-6">
        <svg className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#3a5070' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar por nombre o DNI..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl pl-11 pr-4 py-3 text-white text-sm outline-none transition-all duration-200"
          style={{ background: '#0d1829', border: '1.5px solid #1a2d45' }}
          onFocus={e => e.target.style.borderColor = '#0057B8'}
          onBlur={e => e.target.style.borderColor = '#1a2d45'}
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-sm" style={{ color: '#6b8ab0' }}>Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          <svg className="w-12 h-12 mx-auto mb-4" style={{ color: '#1a2d45' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="font-semibold text-white">No hay alumnos</p>
          <p className="text-sm mt-1" style={{ color: '#6b8ab0' }}>Crea el primer alumno para empezar</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #1a2d45' }}>
                {['#', 'Alumno', 'DNI', 'Prácticas', 'Alta', ''].map(h => (
                  <th key={h} className="text-left px-5 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: '#3a5070' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((student, idx) => (
                <tr
                  key={student.id}
                  style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #0f1c2e' : 'none' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#0f1c2e'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <td className="px-5 py-4">
                    <span className="text-xs font-black font-mono px-2 py-1 rounded-lg" style={{ background: '#0057B820', color: '#0057B8' }}>
                      {student.order_number}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-white font-bold text-sm">{student.full_name}</p>
                    {student.phone && (
                      <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>{student.phone}</p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-mono px-2 py-1 rounded-lg" style={{ background: '#0f1c2e', color: '#6b8ab0' }}>
                      {student.dni}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-1.5">
                      {student.practice_types.map(type => (
                        <span
                          key={type}
                          className="text-xs px-2.5 py-1 rounded-full font-bold"
                          style={{
                            background: type === 'car' ? '#0057B820' : '#38bdf820',
                            color: type === 'car' ? '#0057B8' : '#38bdf8',
                          }}
                        >
                          {getPracticeLabel(type)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm" style={{ color: '#3a5070' }}>
                    {formatDate(student.created_at.split('T')[0])}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <Link
                        href={`/admin/alumnos/${student.id}`}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all duration-150"
                        style={{ background: '#0f1c2e', color: '#a0b8d0' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#1a2d45'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#0f1c2e'}
                      >
                        Ver perfil
                      </Link>
                      <button
                        onClick={() => copyLink(student.token)}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all duration-150"
                        style={{ background: '#0057B820', color: '#0057B8' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#0057B840'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#0057B820'}
                      >
                        {copied === student.token ? '✓ Copiado' : '🔗 Enlace'}
                      </button>
                      <button
                        onClick={() => deactivateStudent(student.id)}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all duration-150"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.2)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'}
                      >
                        Desactivar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}