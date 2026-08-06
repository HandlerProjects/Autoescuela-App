'use client'

import { useEffect, useState } from 'react'

// Pantalla de oficina para el bono de prácticas.
//
// Sustituye a la antigua gestión de cobros con importes: el dueño no quiere ver dinero en la app
// ("hace mucho ruido y no hay que mezclar términos de precio"). Aquí solo se cuentan prácticas.
// El histórico de la tabla `payments` se conserva en la base de datos, simplemente ya no se pinta.
const BONO_SIZE = 5

interface BonoRow {
  id: string
  fullName: string
  orderNumber: number
  used: number
  paidThrough: number
  remaining: number
  suspended: boolean
}

export default function PagosPage() {
  const [rows, setRows] = useState<BonoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  // Dos acciones distintas, disponibles para cualquier alumno — no hace falta que haya agotado
  // el bono para cobrarle el siguiente:
  // 'pago'  → SUMA otras BONO_SIZE prácticas a lo que ya tuviera.
  // 'reset' → FIJA el contador en BONO_SIZE, para quien entra con prácticas ya hechas por su cuenta.
  const [confirming, setConfirming] = useState<{ row: BonoRow; mode: 'pago' | 'reset' } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const res = await fetch('/api/bono/list')
    if (res.status === 403) {
      setForbidden(true)
      setLoading(false)
      return
    }
    if (res.ok) {
      const data = await res.json()
      setRows(data.students ?? [])
    }
    setLoading(false)
  }

  async function confirmarPago() {
    if (!confirming) return
    setSaving(true)
    setError('')

    const res = await fetch('/api/bono/confirmar-pago', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: confirming.row.id, mode: confirming.mode }),
    })

    if (res.ok) {
      setConfirming(null)
      await fetchData()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'No se pudo confirmar el pago')
    }
    setSaving(false)
  }

  const suspended = rows.filter(r => r.suspended)
  const active = rows.filter(r => !r.suspended)

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
      <div className="mb-6">
        <p className="text-sm font-medium mb-1" style={{ color: '#0057B8' }}>Oficina</p>
        <h1 className="text-3xl font-black text-white tracking-tight">Pagos</h1>
        <p className="text-sm mt-1" style={{ color: '#6b8ab0' }}>
          Cada alumno tiene {BONO_SIZE} prácticas. Al agotarlas no puede reservar hasta que pase por la oficina.
        </p>
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: '#6b8ab0' }}>Cargando...</div>
      ) : (
        <>
          {/* ── PENDIENTES DE PAGO ── */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#fbbf24' }}>
                Pendientes de pago
              </p>
              {suspended.length > 0 && (
                <span
                  className="text-xs font-black rounded-full flex items-center justify-center"
                  style={{ background: '#fbbf24', color: '#0a0f1a', minWidth: '20px', height: '20px', padding: '0 6px' }}
                >
                  {suspended.length}
                </span>
              )}
            </div>

            {suspended.length === 0 ? (
              <div className="rounded-2xl p-10 text-center" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
                <p className="text-sm font-semibold" style={{ color: '#3a5070' }}>
                  Ningún alumno tiene el saldo agotado
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {suspended.map(row => (
                  <div
                    key={row.id}
                    className="rounded-2xl px-4 py-4 flex flex-wrap items-center gap-3"
                    style={{ background: '#0d1829', border: '1.5px solid rgba(251,191,36,0.35)' }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0"
                      style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}
                    >
                      {row.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <p className="text-white font-bold text-sm">{row.fullName}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#fbbf24' }}>
                        Saldo agotado · #{row.orderNumber}
                      </p>
                    </div>
                    <button
                      onClick={() => { setConfirming({ row, mode: 'pago' }); setError('') }}
                      className="px-4 py-2.5 rounded-xl text-sm font-bold text-white transition"
                      style={{ background: '#0057B8' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#004494'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#0057B8'}
                    >
                      Pagado
                    </button>
                    <button
                      onClick={() => { setConfirming({ row, mode: 'reset' }); setError('') }}
                      className="px-3 py-2.5 rounded-xl text-xs font-semibold transition"
                      style={{ color: '#3a5070', border: '1px solid #1a2d45' }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.color = 'white'
                        ;(e.currentTarget as HTMLElement).style.borderColor = '#0057B8'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.color = '#3a5070'
                        ;(e.currentTarget as HTMLElement).style.borderColor = '#1a2d45'
                      }}
                    >
                      Resetear
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── RESTO DE ALUMNOS ── */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#3a5070' }}>
              Al corriente
            </p>
            {active.length === 0 ? (
              <div className="rounded-2xl p-10 text-center" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
                <p className="text-sm font-semibold" style={{ color: '#3a5070' }}>Sin alumnos activos</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
                {active.map((row, idx) => (
                  <div
                    key={row.id}
                    className="px-4 py-3 flex items-center gap-3"
                    style={{ borderTop: idx === 0 ? 'none' : '1px solid #0f1c2e' }}
                  >
                    <p className="text-xs font-black font-mono w-8 flex-shrink-0" style={{ color: '#3a5070' }}>
                      #{row.orderNumber}
                    </p>
                    <p className="text-white text-sm font-semibold flex-1 min-w-[110px]">{row.fullName}</p>
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-bold flex-shrink-0"
                      style={{
                        background: row.remaining === 1 ? 'rgba(251,191,36,0.12)' : 'rgba(52,211,153,0.1)',
                        color: row.remaining === 1 ? '#fbbf24' : '#34d399',
                      }}
                    >
                      {row.remaining} {row.remaining === 1 ? 'práctica' : 'prácticas'}
                    </span>
                    {/* Se puede cobrar el siguiente bono aunque aún le quede saldo: no hay que
                        esperar a que se quede a cero para que pase por la oficina. */}
                    <button
                      onClick={() => { setConfirming({ row, mode: 'pago' }); setError('') }}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg transition flex-shrink-0 text-white"
                      style={{ background: '#0057B8' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#004494'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#0057B8'}
                    >
                      Pagado
                    </button>
                    <button
                      onClick={() => { setConfirming({ row, mode: 'reset' }); setError('') }}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg transition flex-shrink-0"
                      style={{ color: '#3a5070', border: '1px solid #1a2d45' }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.color = 'white'
                        ;(e.currentTarget as HTMLElement).style.borderColor = '#0057B8'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.color = '#3a5070'
                        ;(e.currentTarget as HTMLElement).style.borderColor = '#1a2d45'
                      }}
                    >
                      Resetear
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── POPUP DE CONFIRMACIÓN ── */}
      {confirming && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.65)' }}
            onClick={() => { if (!saving) setConfirming(null) }}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="w-full max-w-sm rounded-2xl p-6 pointer-events-auto"
              style={{ background: '#0d1829', border: '1px solid #1a2d45' }}
            >
              <p className="text-white font-black text-lg mb-2">
                {confirming.mode === 'pago' ? 'Confirmar pago' : 'Resetear prácticas'}
              </p>
              <p className="text-sm leading-relaxed mb-4" style={{ color: '#a0b8d0' }}>
                {confirming.mode === 'pago' ? (
                  <>
                    ¿Confirmas que <span className="font-bold text-white">{confirming.row.fullName}</span> ha
                    pagado un bono de {BONO_SIZE} prácticas?
                  </>
                ) : (
                  <>
                    ¿Poner a <span className="font-bold text-white">{confirming.row.fullName}</span> con {BONO_SIZE} prácticas
                    nuevas por delante?
                  </>
                )}
              </p>

              {/* Se dice el número exacto con el que va a quedar: es la diferencia entre las dos
                  acciones y el sitio donde una equivocación se paga cara. */}
              <div className="rounded-xl px-3 py-2.5 mb-5" style={{ background: '#0a1220', border: '1px solid #1a2d45' }}>
                <p className="text-xs" style={{ color: '#6b8ab0' }}>
                  Ahora tiene <span className="font-bold text-white">{confirming.row.remaining}</span>
                  {confirming.row.remaining === 1 ? ' práctica' : ' prácticas'} · pasará a tener{' '}
                  <span className="font-bold" style={{ color: '#34d399' }}>
                    {confirming.mode === 'pago' ? confirming.row.remaining + BONO_SIZE : BONO_SIZE}
                  </span>
                </p>
              </div>

              <p className="text-xs mb-5" style={{ color: '#3a5070' }}>
                {confirming.mode === 'pago'
                  ? `Se le suman ${BONO_SIZE} a las que ya tuviera. No hace falta que las haya agotado.`
                  : `Se usa cuando un alumno empieza con prácticas ya hechas por su cuenta. Su contador queda en ${BONO_SIZE}, sin borrar ninguna reserva.`}
              </p>

              {error && (
                <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setConfirming(null)}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition"
                  style={{ background: '#0a1220', color: '#6b8ab0', border: '1px solid #1a2d45' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarPago}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition"
                  style={{ background: '#0057B8', opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? 'Guardando...' : confirming.mode === 'pago' ? 'Sí, ha pagado' : `Poner a ${BONO_SIZE}`}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  )
}
