'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AlumnoLoginPage() {
  const router = useRouter()
  const [dni, setDni] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    const cleanDni = dni.trim().toUpperCase()
    const cleanPin = pin.trim()

    if (!cleanDni || !cleanPin) {
      setError('Introduce tu DNI y PIN')
      return
    }
    if (cleanPin.length !== 4) {
      setError('El PIN son los últimos 4 dígitos de tu DNI')
      return
    }

    setLoading(true)
    setError('')

    const res = await fetch('/api/alumno/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni: cleanDni, pin: cleanPin }),
    })

    const data = await res.json()

    if (!res.ok || data.error) {
      setError(data.error ?? 'DNI o PIN incorrectos')
      setLoading(false)
      return
    }

    router.push(`/s/${data.token}`)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-12" style={{ background: '#0a0f1a' }}>

      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: '#0057B8' }}>
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13M3 13v5a1 1 0 001 1h1a2 2 0 004 0h8a2 2 0 004 0h1a1 1 0 001-1v-5M3 13h18" />
          </svg>
        </div>
        <div>
          <p className="text-white font-black text-base leading-none tracking-tight">AUTO-ESCUELA BAHILLO</p>
          <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>Palencia</p>
        </div>
      </div>

      <div className="w-full max-w-sm">

        <Link
          href="/"
          prefetch={false}
          className="flex items-center gap-2 mb-6 text-sm font-semibold transition"
          style={{ color: '#6b8ab0' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </Link>

        <h1 className="text-2xl font-black text-white mb-1">Acceso alumnos</h1>
        <p className="text-sm mb-8" style={{ color: '#6b8ab0' }}>Introduce tu DNI para acceder a tus prácticas</p>

        <div className="space-y-4">

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#a0b8d0' }}>DNI</label>
            <input
              type="text"
              value={dni}
              onChange={e => setDni(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="12345678Z"
              maxLength={9}
              className="w-full rounded-xl px-4 py-3.5 text-white text-sm font-mono outline-none transition-all tracking-widest"
              style={{ background: '#0d1829', border: '1.5px solid #1a2d45' }}
              onFocus={e => e.target.style.borderColor = '#0057B8'}
              onBlur={e => e.target.style.borderColor = '#1a2d45'}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#a0b8d0' }}>
              PIN <span style={{ color: '#3a5070', fontWeight: 400 }}>— últimos 4 dígitos de tu DNI</span>
            </label>
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="••••"
              inputMode="numeric"
              maxLength={4}
              className="w-full rounded-xl px-4 py-3.5 text-white text-sm outline-none transition-all tracking-widest"
              style={{ background: '#0d1829', border: '1.5px solid #1a2d45' }}
              onFocus={e => e.target.style.borderColor = '#0057B8'}
              onBlur={e => e.target.style.borderColor = '#1a2d45'}
            />
            <p className="text-xs mt-1.5" style={{ color: '#3a5070' }}>
              Ej: DNI <span style={{ color: '#6b8ab0' }}>12345</span><span className="font-bold" style={{ color: '#0057B8' }}>6789</span>Z → PIN <span className="font-bold" style={{ color: '#0057B8' }}>6789</span>
            </p>
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !dni || pin.length < 4}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-200"
            style={{
              background: loading || !dni || pin.length < 4 ? '#1a2d45' : '#0057B8',
              color: loading || !dni || pin.length < 4 ? '#4a6080' : 'white',
            }}
            onMouseEnter={e => { if (!loading && dni && pin.length === 4) (e.currentTarget as HTMLElement).style.background = '#004494' }}
            onMouseLeave={e => { if (!loading && dni && pin.length === 4) (e.currentTarget as HTMLElement).style.background = '#0057B8' }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

        </div>

        <p className="text-xs text-center mt-6" style={{ color: '#3a5070' }}>
          ¿Problemas para acceder? Contacta con la autoescuela
        </p>

      </div>
    </main>
  )
}
