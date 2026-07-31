'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LandingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [view, setView] = useState<'landing' | 'staff'>('landing')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setLoading(true)
    setError('')
    // Recorta espacios/saltos de línea de más — fácil arrastrar alguno al copiar
    // el email o la contraseña temporal desde el correo de bienvenida.
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    })
    if (error || !authData.user) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
      return
    }
    if (authData.user.user_metadata?.must_change_password) {
      return router.push('/cambiar-contrasena')
    }

    const meRes = await fetch('/api/auth/me')
    const me = meRes.ok ? await meRes.json() : null
    if (!me) {
      setError('Tu usuario no tiene acceso configurado. Contacta con la autoescuela.')
      setLoading(false)
      return
    }
    if (me.role === 'secretary') return router.push('/secretaria')
    if (me.role === 'instructor') return router.push('/instructor')
    router.push('/admin')
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

        {view === 'landing' && (
          <>
            <h1 className="text-2xl font-black text-white text-center mb-2">Bienvenido</h1>
            <p className="text-sm text-center mb-8" style={{ color: '#6b8ab0' }}>¿Cómo quieres acceder?</p>

            <div className="space-y-3">

              {/* Alumno */}
              <Link
                href="/alumno"
                className="flex items-center gap-4 w-full rounded-2xl p-5 transition-all duration-200 group"
                style={{ background: '#0057B8' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#004494'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#0057B8'}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13M3 13v5a1 1 0 001 1h1a2 2 0 004 0h8a2 2 0 004 0h1a1 1 0 001-1v-5M3 13h18" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-black text-base leading-none">Soy alumno</p>
                  <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>Reserva y gestiona tus prácticas</p>
                </div>
                <svg className="w-5 h-5 text-white opacity-60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>

              {/* Personal */}
              <button
                onClick={() => setView('staff')}
                className="flex items-center gap-4 w-full rounded-2xl p-5 transition-all duration-200 text-left"
                style={{ background: '#0d1829', border: '1.5px solid #1a2d45' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = '#0057B8'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#1a2d45'}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#0f1c2e' }}>
                  <svg className="w-6 h-6" style={{ color: '#6b8ab0' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-white font-black text-base leading-none">Personal de la autoescuela</p>
                  <p className="text-sm mt-1" style={{ color: '#3a5070' }}>Instructores · Secretaría · Administración</p>
                </div>
                <svg className="w-5 h-5 flex-shrink-0" style={{ color: '#3a5070' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

            </div>
          </>
        )}

        {view === 'staff' && (
          <>
            <button
              onClick={() => { setView('landing'); setError('') }}
              className="flex items-center gap-2 mb-6 text-sm font-semibold transition"
              style={{ color: '#6b8ab0' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Volver
            </button>

            <h2 className="text-2xl font-black text-white mb-1">Acceso personal</h2>
            <p className="text-sm mb-8" style={{ color: '#6b8ab0' }}>Instructores, secretaría y administración</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#a0b8d0' }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="carlos@autoescuela.com"
                  className="w-full rounded-xl px-4 py-3.5 text-white text-sm outline-none transition-all"
                  style={{ background: '#0d1829', border: '1.5px solid #1a2d45' }}
                  onFocus={e => e.target.style.borderColor = '#0057B8'}
                  onBlur={e => e.target.style.borderColor = '#1a2d45'}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#a0b8d0' }}>Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="••••••••"
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
                disabled={loading || !email || !password}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-200"
                style={{
                  background: loading || !email || !password ? '#1a2d45' : '#0057B8',
                  color: loading || !email || !password ? '#4a6080' : 'white',
                }}
                onMouseEnter={e => { if (!loading && email && password) (e.currentTarget as HTMLElement).style.background = '#004494' }}
                onMouseLeave={e => { if (!loading && email && password) (e.currentTarget as HTMLElement).style.background = '#0057B8' }}
              >
                {loading ? 'Entrando...' : 'Entrar al panel'}
              </button>
            </div>
          </>
        )}

      </div>
    </main>
  )
}
