'use client'

import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils'
import type { Exam, Student, ExamType, ExamResult } from '@/types'

export default function ExamenesPage() {
  const [exams, setExams] = useState<Exam[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'all' | 'theory' | 'practical'>('all')

  // Form
  const [studentId, setStudentId] = useState('')
  const [examType, setExamType] = useState<ExamType>('theory')
  const [examDate, setExamDate] = useState('')
  const [result, setResult] = useState<ExamResult>('pending')
  const [attemptNumber, setAttemptNumber] = useState('1')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [examsRes, studentsRes] = await Promise.all([
      fetch('/api/examenes/list'),
      fetch('/api/alumnos/list?active=true'),
    ])
    if (examsRes.status === 403) {
      setForbidden(true)
      setLoading(false)
      return
    }
    if (examsRes.ok) {
      const data = await examsRes.json()
      setExams(data.exams ?? [])
    }
    if (studentsRes.ok) {
      const data = await studentsRes.json()
      setStudents(data.students ?? [])
    }
    setLoading(false)
  }

  async function handleSubmit() {
    if (!studentId || !examDate) return
    setSaving(true)

    const res = await fetch('/api/examenes/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: studentId,
        exam_type: examType,
        exam_date: examDate,
        result,
        attempt_number: parseInt(attemptNumber),
        notes: notes.trim() || null,
      }),
    })

    if (res.ok) {
      setShowForm(false)
      setStudentId('')
      setExamDate('')
      setNotes('')
      setAttemptNumber('1')
      fetchData()
    } else {
      const data = await res.json()
      alert(data.error ?? 'Error al guardar el examen')
    }
    setSaving(false)
  }

  async function updateResult(id: string, newResult: ExamResult) {
    const res = await fetch('/api/examenes/update-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, result: newResult }),
    })
    if (res.ok) {
      setExams(prev => prev.map(e => e.id === id ? { ...e, result: newResult } : e))
    }
  }

  async function deleteExam(id: string) {
    if (!confirm('¿Eliminar este examen?')) return
    const res = await fetch('/api/examenes/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setExams(prev => prev.filter(e => e.id !== id))
    }
  }

  const filtered = filter === 'all' ? exams : exams.filter(e => e.exam_type === filter)
  const passedCount = exams.filter(e => e.result === 'passed').length
  const failedCount = exams.filter(e => e.result === 'failed').length
  const pendingCount = exams.filter(e => e.result === 'pending').length
  const passRate = exams.filter(e => e.result !== 'pending').length > 0
    ? Math.round((passedCount / exams.filter(e => e.result !== 'pending').length) * 100)
    : 0

  function getResultStyle(result: ExamResult) {
    if (result === 'passed') return { background: 'rgba(52,211,153,0.1)', color: '#34d399' }
    if (result === 'failed') return { background: 'rgba(239,68,68,0.1)', color: '#f87171' }
    return { background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }
  }

  function getResultLabel(result: ExamResult) {
    if (result === 'passed') return 'Aprobado'
    if (result === 'failed') return 'Suspendido'
    return 'Pendiente'
  }

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: '#0057B8' }}>Seguimiento</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Exámenes</h1>
          <p className="text-sm mt-1" style={{ color: '#6b8ab0' }}>Registro de exámenes teóricos y prácticos</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 font-bold text-sm px-5 py-3 rounded-xl transition text-white"
          style={{ background: '#0057B8' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#004494'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#0057B8'}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Añadir examen
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        {[
          { label: 'Total', value: exams.length, color: 'white' },
          { label: 'Aprobados', value: passedCount, color: '#34d399' },
          { label: 'Suspendidos', value: failedCount, color: '#f87171' },
          { label: 'Tasa aprobado', value: `${passRate}%`, color: '#0057B8' },
        ].map(stat => (
          <div key={stat.label} className="rounded-2xl p-3 md:p-5" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1 md:mb-2 leading-tight" style={{ color: '#3a5070' }}>{stat.label}</p>
            <p className="text-3xl md:text-4xl font-black" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="rounded-2xl p-6 mb-6 space-y-4" style={{ background: '#0d1829', border: '1px solid #0057B8' }}>
          <p className="text-white font-bold">Nuevo examen</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6b8ab0' }}>Alumno</label>
              <select
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                style={{ background: '#0a1220', border: '1.5px solid #1a2d45', color: studentId ? 'white' : '#3a5070' }}
              >
                <option value="">Seleccionar alumno</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6b8ab0' }}>Tipo</label>
              <div className="flex gap-2">
                {(['theory', 'practical'] as ExamType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setExamType(t)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold transition"
                    style={{
                      background: examType === t ? '#0057B820' : '#0a1220',
                      border: `1.5px solid ${examType === t ? '#0057B8' : '#1a2d45'}`,
                      color: examType === t ? '#0057B8' : '#3a5070',
                    }}
                  >
                    {t === 'theory' ? 'Teórico' : 'Práctico'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6b8ab0' }}>Fecha</label>
              <input
                type="date"
                value={examDate}
                onChange={e => setExamDate(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                style={{ background: '#0a1220', border: '1.5px solid #1a2d45', colorScheme: 'dark' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6b8ab0' }}>Resultado</label>
              <div className="flex gap-2">
                {(['pending', 'passed', 'failed'] as ExamResult[]).map(r => (
                  <button
                    key={r}
                    onClick={() => setResult(r)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold transition"
                    style={{
                      background: result === r ? getResultStyle(r).background : '#0a1220',
                      border: `1.5px solid ${result === r ? getResultStyle(r).color : '#1a2d45'}`,
                      color: result === r ? getResultStyle(r).color : '#3a5070',
                    }}
                  >
                    {getResultLabel(r)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6b8ab0' }}>Intento nº</label>
              <input
                type="number"
                value={attemptNumber}
                onChange={e => setAttemptNumber(e.target.value)}
                min={1}
                className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                style={{ background: '#0a1220', border: '1.5px solid #1a2d45' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6b8ab0' }}>Notas</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Observaciones..."
                className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                style={{ background: '#0a1220', border: '1.5px solid #1a2d45' }}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition"
              style={{ background: '#0a1220', color: '#6b8ab0', border: '1px solid #1a2d45' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !studentId || !examDate}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition"
              style={{ background: saving || !studentId || !examDate ? '#1a2d45' : '#0057B8' }}
            >
              {saving ? 'Guardando...' : 'Guardar examen'}
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 mb-6">
        {(['all', 'theory', 'practical'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition"
            style={{
              background: filter === f ? '#0057B8' : '#0d1829',
              color: filter === f ? 'white' : '#6b8ab0',
              border: `1px solid ${filter === f ? '#0057B8' : '#1a2d45'}`,
            }}
          >
            {f === 'all' ? 'Todos' : f === 'theory' ? 'Teóricos' : 'Prácticos'}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-sm" style={{ color: '#6b8ab0' }}>Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          <p className="font-semibold text-white">Sin exámenes registrados</p>
          <p className="text-sm mt-1" style={{ color: '#6b8ab0' }}>Añade el primer examen para empezar</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #1a2d45' }}>
                {['Alumno', 'Tipo', 'Fecha', 'Intento', 'Resultado', ''].map(h => (
                  <th key={h} className="text-left px-5 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: '#3a5070' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((exam, idx) => (
                <tr
                  key={exam.id}
                  style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #0f1c2e' : 'none' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#0f1c2e'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <td className="px-5 py-4">
                    <p className="text-white font-bold text-sm">{exam.student?.full_name ?? '—'}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>#{exam.student?.order_number}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{
                      background: exam.exam_type === 'theory' ? '#0057B820' : '#38bdf820',
                      color: exam.exam_type === 'theory' ? '#0057B8' : '#38bdf8',
                    }}>
                      {exam.exam_type === 'theory' ? 'Teórico' : 'Práctico'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-white">{formatDate(exam.exam_date)}</td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-mono px-2 py-1 rounded-lg" style={{ background: '#0f1c2e', color: '#6b8ab0' }}>
                      #{exam.attempt_number}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={exam.result}
                      onChange={e => updateResult(exam.id, e.target.value as ExamResult)}
                      className="text-xs font-bold px-2.5 py-1 rounded-full outline-none cursor-pointer"
                      style={{ ...getResultStyle(exam.result), border: 'none' }}
                    >
                      <option value="pending">Pendiente</option>
                      <option value="passed">Aprobado</option>
                      <option value="failed">Suspendido</option>
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => deleteExam(exam.id)}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold transition"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.2)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'}
                    >
                      Eliminar
                    </button>
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