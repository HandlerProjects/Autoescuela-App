'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AlumnoLoginPage() {
  const router = useRouter()
  const [loginCode, setLoginCode] = useState('')
  const [loginPin, setLoginPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!loginCode.trim() || !loginPin.trim()) {
      setError('Introduce tu código y PIN')
      return
    }

    setLoading(true)
    setError('')

    const res = await fetch('/api/alumno/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login_code: loginCode.trim(), login_pin: loginPin.trim() }),
    })

    const data = await res.json()

    if (!res.ok || data.error) {
      setError(data.error ?? 'Error al iniciar sesión')
      setLoading(false)
      return
    }

    router.push(`/s/${data.token}`)
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#0a0f1a' }}>

      {/* Panel izquierdo */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12" style={{ background: '#0057B8' }}>
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="white" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-black text-lg leading-none">AUTO-ESCUELA</p>
              <p className="text-white text-sm opacity-70 leading-none">BAHILLO · Palencia</p>
            </div>
          </div>
          <h2 className="text-white font-black text-4xl leading-tight mb-4">
            Tu panel<br />de prácticas
          </h2>
          <p className="text-white opacity-70 text-lg">
            Reserva, cancela y consulta tu historial de clases desde aquí.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Reservas online', desc: 'Elige día y hora' },
            { label: 'Sin llamadas', desc: 'Todo desde el móvil' },
            { label: 'Historial', desc: 'Consulta tus prácticas' },
            { label: '24/7', desc: 'Disponible siempre' },
          ].map(item => (
            <div key={item.label} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <p className="text-white font-bold text-sm">{item.label}</p>
              <p className="text-white opacity-60 text-xs mt-0.5">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">

          {/* Logo mobile */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#0057B8' }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="white" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-black text-base leading-none">AUTO-ESCUELA BAHILLO</p>
              <p className="text-xs leading-none" style={{ color: '#3a5070' }}>Palencia</p>
            </div>
          </div>

          <h1 className="text-3xl font-black text-white mb-1">Bienvenido</h1>
          <p className="text-sm mb-8" style={{ color: '#6b8ab0' }}>Accede a tu área de alumno</p>

          <div className="space-y-4">

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#a0b8d0' }}>
                Código de alumno
              </label>
              <input
                type="text"
                value={loginCode}
                onChange={e => setLoginCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="Alumno-001"
                className="w-full rounded-xl px-4 py-3.5 text-white text-sm font-mono outline-none transition-all"
                style={{ background: '#0d1829', border: '1.5px solid #1a2d45' }}
                onFocus={e => e.target.style.borderColor = '#0057B8'}
                onBlur={e => e.target.style.borderColor = '#1a2d45'}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#a0b8d0' }}>
                PIN
              </label>
              <input
                type="password"
                value={loginPin}
                onChange={e => setLoginPin(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="••••"
                className="w-full rounded-xl px-4 py-3.5 text-white text-sm outline-none transition-all"
                style={{ background: '#0d1829', border: '1.5px solid #1a2d45' }}
                onFocus={e => e.target.style.borderColor = '#0057B8'}
                onBlur={e => e.target.style.borderColor = '#1a2d45'}
              />
            </div>

            {error && (
              <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-200 mt-2"
              style={{ background: loading ? '#1a2d45' : '#0057B8', color: loading ? '#3a5070' : 'white' }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = '#004494' }}
              onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = '#0057B8' }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

          </div>

          <p className="text-xs text-center mt-6" style={{ color: '#3a5070' }}>
            Tu código y PIN te los proporciona la autoescuela
          </p>

        </div>
      </div>

    </div>
  )
}
