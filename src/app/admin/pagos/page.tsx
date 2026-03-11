'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import type { Payment, Student, PaymentStatus } from '@/types'

const RATES = [
  { concept: 'Matrícula', price: null, description: 'Alta en la autoescuela' },
  { concept: '5 clases coche', price: null, description: 'Bono 5 prácticas · Coche' },
  { concept: '5 clases camión', price: null, description: 'Bono 5 prácticas · Camión' },
  { concept: '10 clases coche', price: null, description: 'Bono 10 prácticas · Coche' },
  { concept: '10 clases camión', price: null, description: 'Bono 10 prácticas · Camión' },
  { concept: 'Examen teórico', price: null, description: 'Tasas examen teórico DGT' },
  { concept: 'Examen práctico', price: null, description: 'Tasas examen práctico DGT' },
  { concept: 'Tasas DGT', price: null, description: 'Gestión tasas DGT' },
]

export default function PagosPage() {
  const supabase = createClient()
  const [payments, setPayments] = useState<Payment[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showRates, setShowRates] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all')
  const [rates, setRates] = useState<{ [key: string]: string }>({})
  const [editingRates, setEditingRates] = useState(false)
  const [tempRates, setTempRates] = useState<{ [key: string]: string }>({})

  // Form
  const [studentId, setStudentId] = useState('')
  const [amount, setAmount] = useState('')
  const [concept, setConcept] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [{ data: paymentsData }, { data: studentsData }, { data: ratesData }] = await Promise.all([
      supabase.from('payments').select('*, student:students(full_name, order_number)').order('created_at', { ascending: false }),
      supabase.from('students').select('*').eq('is_active', true).order('order_number'),
      supabase.from('rates').select('*'),
    ])
    if (paymentsData) setPayments(paymentsData)
    if (studentsData) setStudents(studentsData)
    if (ratesData) {
      const ratesMap: { [key: string]: string } = {}
      ratesData.forEach(r => { ratesMap[r.concept] = r.price?.toString() ?? '' })
      setRates(ratesMap)
      setTempRates(ratesMap)
    }
    setLoading(false)
  }

  async function saveRates() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    for (const [concept, price] of Object.entries(tempRates)) {
      const numPrice = price ? parseFloat(price) : null
      await supabase.from('rates').upsert({
        instructor_id: user.id,
        concept,
        price: numPrice,
      }, { onConflict: 'instructor_id,concept' })
    }

    setRates(tempRates)
    setEditingRates(false)
  }

  function selectConcept(c: string) {
    setConcept(c)
    if (rates[c]) setAmount(rates[c])
  }

  async function handleSubmit() {
    if (!studentId || !amount || !concept) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('payments').insert({
      student_id: studentId,
      instructor_id: user.id,
      amount: parseFloat(amount),
      concept,
      status: 'pending',
      due_date: dueDate || null,
      notes: notes.trim() || null,
    })

    setShowForm(false)
    setStudentId('')
    setAmount('')
    setConcept('')
    setDueDate('')
    setNotes('')
    fetchData()
    setSaving(false)
  }

  async function markAsPaid(id: string) {
    await supabase.from('payments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id)
    setPayments(prev => prev.map(p => p.id === id ? { ...p, status: 'paid' as PaymentStatus, paid_at: new Date().toISOString() } : p))
  }

  async function deletePayment(id: string) {
    if (!confirm('¿Eliminar este pago?')) return
    await supabase.from('payments').delete().eq('id', id)
    setPayments(prev => prev.filter(p => p.id !== id))
  }

  const filtered = filter === 'all' ? payments : payments.filter(p => p.status === filter)
  const totalPending = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0)
  const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0)
  const studentsWithDebt = [...new Set(payments.filter(p => p.status === 'pending').map(p => p.student_id))].length

  return (
    <div className="p-8">

      {/* Cabecera */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: '#0057B8' }}>Administración</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Pagos</h1>
          <p className="text-sm mt-1" style={{ color: '#6b8ab0' }}>Control de cobros y deudas</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRates(!showRates)}
            className="flex items-center gap-2 font-bold text-sm px-4 py-3 rounded-xl transition"
            style={{ background: '#0d1829', border: '1px solid #1a2d45', color: '#6b8ab0' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#6b8ab0'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Tarifas
          </button>
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
            Nuevo cobro
          </button>
        </div>
      </div>

      {/* Panel tarifas */}
      {showRates && (
        <div className="rounded-2xl p-6 mb-6" style={{ background: '#0d1829', border: '1px solid #0057B8' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white font-bold">Tarifas de la autoescuela</p>
              <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>Los precios se autorellenan al seleccionar el concepto · Los precios se muestran sin IVA</p>
            </div>
            {!editingRates ? (
              <button
                onClick={() => { setEditingRates(true); setTempRates(rates) }}
                className="text-sm font-bold px-4 py-2 rounded-xl transition"
                style={{ background: '#0057B820', color: '#0057B8' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#0057B840'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#0057B820'}
              >
                Editar tarifas
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingRates(false)}
                  className="text-sm font-bold px-4 py-2 rounded-xl transition"
                  style={{ background: '#0a1220', color: '#6b8ab0', border: '1px solid #1a2d45' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={saveRates}
                  className="text-sm font-bold px-4 py-2 rounded-xl transition text-white"
                  style={{ background: '#0057B8' }}
                >
                  Guardar
                </button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-4 gap-3">
            {RATES.map(rate => (
              <div key={rate.concept} className="rounded-xl p-3" style={{ background: '#0a1220', border: '1px solid #1a2d45' }}>
                <p className="text-white text-xs font-bold mb-0.5">{rate.concept}</p>
                <p className="text-xs mb-2" style={{ color: '#3a5070' }}>{rate.description}</p>
                {editingRates ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={tempRates[rate.concept] ?? ''}
                      onChange={e => setTempRates(prev => ({ ...prev, [rate.concept]: e.target.value }))}
                      placeholder="—"
                      className="w-full rounded-lg px-2 py-1.5 text-white text-sm outline-none"
                      style={{ background: '#0d1829', border: '1px solid #1a2d45' }}
                    />
                    <span className="text-xs font-bold" style={{ color: '#3a5070' }}>€</span>
                  </div>
                ) : (
                  <p className="text-lg font-black" style={{ color: rates[rate.concept] ? '#0057B8' : '#1a2d45' }}>
                    {rates[rate.concept] ? `${rates[rate.concept]}€` : '* € + IVA'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-2xl p-5" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#3a5070' }}>Pendiente de cobro</p>
          <p className="text-4xl font-black" style={{ color: '#f87171' }}>{totalPending.toFixed(0)}€</p>
          <p className="text-xs mt-1" style={{ color: '#3a5070' }}>{studentsWithDebt} alumnos con deuda</p>
        </div>
        <div className="rounded-2xl p-5" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#3a5070' }}>Cobrado</p>
          <p className="text-4xl font-black" style={{ color: '#34d399' }}>{totalPaid.toFixed(0)}€</p>
        </div>
        <div className="rounded-2xl p-5" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#3a5070' }}>Total registrado</p>
          <p className="text-4xl font-black text-white">{(totalPending + totalPaid).toFixed(0)}€</p>
        </div>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="rounded-2xl p-6 mb-6 space-y-4" style={{ background: '#0d1829', border: '1px solid #0057B8' }}>
          <p className="text-white font-bold">Nuevo cobro</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6b8ab0' }}>Alumno</label>
              <select
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: '#0a1220', border: '1.5px solid #1a2d45', color: studentId ? 'white' : '#3a5070' }}
              >
                <option value="">Seleccionar alumno</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6b8ab0' }}>Concepto</label>
              <select
                value={concept}
                onChange={e => selectConcept(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: '#0a1220', border: '1.5px solid #1a2d45', color: concept ? 'white' : '#3a5070' }}
              >
                <option value="">Seleccionar concepto</option>
                {RATES.map(r => (
                  <option key={r.concept} value={r.concept}>
                    {r.concept}{rates[r.concept] ? ` · ${rates[r.concept]}€` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6b8ab0' }}>
                Importe (€) <span className="font-normal" style={{ color: '#3a5070' }}>+ IVA no incluido</span>
              </label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                min={0}
                step={0.01}
                className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                style={{ background: '#0a1220', border: '1.5px solid #1a2d45' }}
                onFocus={e => e.target.style.borderColor = '#0057B8'}
                onBlur={e => e.target.style.borderColor = '#1a2d45'}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6b8ab0' }}>Fecha límite <span className="font-normal" style={{ color: '#3a5070' }}>(opcional)</span></label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                style={{ background: '#0a1220', border: '1.5px solid #1a2d45', colorScheme: 'dark' }}
                onFocus={e => e.target.style.borderColor = '#0057B8'}
                onBlur={e => e.target.style.borderColor = '#1a2d45'}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6b8ab0' }}>Notas <span className="font-normal" style={{ color: '#3a5070' }}>(opcional)</span></label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Observaciones..."
                className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                style={{ background: '#0a1220', border: '1.5px solid #1a2d45' }}
                onFocus={e => e.target.style.borderColor = '#0057B8'}
                onBlur={e => e.target.style.borderColor = '#1a2d45'}
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
              disabled={saving || !studentId || !amount || !concept}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition"
              style={{ background: saving || !studentId || !amount || !concept ? '#1a2d45' : '#0057B8' }}
            >
              {saving ? 'Guardando...' : 'Registrar cobro'}
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 mb-6">
        {(['all', 'pending', 'paid'] as const).map(f => (
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
            {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendientes' : 'Cobrados'}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-sm" style={{ color: '#6b8ab0' }}>Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          <p className="font-semibold text-white">Sin cobros registrados</p>
          <p className="text-sm mt-1" style={{ color: '#6b8ab0' }}>Añade el primer cobro para empezar</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #1a2d45' }}>
                {['Alumno', 'Concepto', 'Importe', 'Vencimiento', 'Estado', ''].map(h => (
                  <th key={h} className="text-left px-5 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: '#3a5070' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((payment, idx) => {
                const isOverdue = payment.status === 'pending' && payment.due_date && payment.due_date < new Date().toISOString().split('T')[0]
                return (
                  <tr
                    key={payment.id}
                    style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #0f1c2e' : 'none' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#0f1c2e'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <td className="px-5 py-4">
                      <p className="text-white font-bold text-sm">{(payment.student as any)?.full_name ?? '—'}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>#{(payment.student as any)?.order_number}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-white text-sm">{payment.concept}</p>
                      {payment.notes && <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>{payment.notes}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-white font-black text-lg">{payment.amount.toFixed(0)}€</p>
                      <p className="text-xs" style={{ color: '#3a5070' }}>+ IVA</p>
                    </td>
                    <td className="px-5 py-4">
                      {payment.due_date ? (
                        <p className="text-sm font-semibold" style={{ color: isOverdue ? '#f87171' : '#6b8ab0' }}>
                          {isOverdue && '⚠ '}{formatDate(payment.due_date)}
                        </p>
                      ) : (
                        <p className="text-sm" style={{ color: '#3a5070' }}>—</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{
                        background: payment.status === 'paid' ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                        color: payment.status === 'paid' ? '#34d399' : '#f87171',
                      }}>
                        {payment.status === 'paid' ? `Cobrado ${payment.paid_at ? formatDate(payment.paid_at.split('T')[0]) : ''}` : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2 justify-end">
                        {payment.status === 'pending' && (
                          <button
                            onClick={() => markAsPaid(payment.id)}
                            className="text-xs px-3 py-1.5 rounded-lg font-semibold transition"
                            style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(52,211,153,0.2)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(52,211,153,0.1)'}
                          >
                            ✓ Cobrado
                          </button>
                        )}
                        <button
                          onClick={() => deletePayment(payment.id)}
                          className="text-xs px-3 py-1.5 rounded-lg font-semibold transition"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.2)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}