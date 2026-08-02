'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getPracticeLabel } from '@/lib/utils'
import type { Student, PracticeType } from '@/types'

export default function InstructorAlumnosPage() {
  const supabase = createClient()
  const [students, setStudents] = useState<Student[]>([])
  const [instructorId, setInstructorId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => { init() }, [])

  // Identidad + lista de alumnos en una sola llamada server-side
  // (/api/instructor/alumnos) en vez de /api/auth/me seguido de la consulta a students.
  async function init() {
    const res = await fetch('/api/instructor/alumnos')
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    setInstructorId(data.id ?? null)
    setStudents(data.students ?? [])
    setLoading(false)
  }

  async function toggleExamMode(student: Student) {
    setToggling(student.id)
    const newVal = !student.exam_mode
    await supabase.from('students').update({ exam_mode: newVal }).eq('id', student.id).eq('instructor_id', instructorId)
    setStudents(prev => prev.map(s => s.id === student.id ? { ...s, exam_mode: newVal } : s))
    setToggling(null)
  }

  const typeColors: Record<PracticeType, { bg: string; text: string }> = {
    car: { bg: '#0057B820', text: '#0057B8' },
    truck: { bg: '#38bdf820', text: '#38bdf8' },
    moto: { bg: '#a78bfa20', text: '#a78bfa' },
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="text-sm font-medium mb-1" style={{ color: '#0057B8' }}>Gestión</p>
        <h1 className="text-3xl font-black text-white tracking-tight">Mis alumnos</h1>
        <p className="text-sm mt-1" style={{ color: '#6b8ab0' }}>{students.length} alumnos asignados</p>
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: '#6b8ab0' }}>Cargando...</div>
      ) : students.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          <p className="font-semibold text-white">Sin alumnos asignados</p>
          <p className="text-sm mt-1" style={{ color: '#6b8ab0' }}>Ve al tablón para elegir alumnos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {students.map(student => (
            <Link
              key={student.id}
              href={`/instructor/alumnos/${student.id}`}
              className="rounded-2xl px-5 py-4 block"
              style={{
                background: '#0d1829',
                border: `1px solid ${student.exam_mode ? '#f59e0b40' : '#1a2d45'}`,
              }}
            >
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-white font-bold">{student.full_name}</p>
                    {student.exam_mode && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: '#f59e0b20', color: '#f59e0b' }}>
                        🎯 Examen
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {(student.practice_types as PracticeType[]).map(t => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{
                        background: typeColors[t]?.bg,
                        color: typeColors[t]?.text,
                      }}>
                        {getPracticeLabel(t)}
                      </span>
                    ))}
                    {student.phone && (
                      <span className="text-xs" style={{ color: '#3a5070' }}>{student.phone}</span>
                    )}
                  </div>
                </div>

                <div
                  className="flex items-center gap-3"
                  onClick={e => { e.preventDefault(); e.stopPropagation() }}
                >
                  {/* Modo examen toggle */}
                  <button
                    onClick={() => toggleExamMode(student)}
                    disabled={toggling === student.id}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold transition"
                    style={{
                      background: student.exam_mode ? '#f59e0b20' : '#0a1220',
                      border: `1.5px solid ${student.exam_mode ? '#f59e0b' : '#1a2d45'}`,
                      color: student.exam_mode ? '#f59e0b' : '#3a5070',
                      opacity: toggling === student.id ? 0.5 : 1,
                    }}
                  >
                    {student.exam_mode ? 'Modo examen ON' : 'Modo examen'}
                  </button>

                  <div className="text-xs font-mono px-3 py-1.5 rounded-lg" style={{ background: '#0f1c2e', color: '#3a5070' }}>
                    #{student.order_number}
                  </div>
                </div>
              </div>

              {student.exam_mode && (
                <p className="text-xs mt-2.5" style={{ color: '#f59e0b80' }}>
                  Puede reservar mañana + tarde el mismo día hasta que desactives este modo
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
