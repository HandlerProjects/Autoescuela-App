'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
      return
    }
    router.push('/admin')
  }

  return (
    <main className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #0a0f1a 0%, #0d1829 50%, #0a1628 100%)' }}>

      {/* Panel izquierdo — decorativo */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{ background: 'linear-gradient(145deg, #0057B8, #003d82)' }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full border-2 border-white" />
          <div className="absolute top-32 left-32 w-64 h-64 rounded-full border-2 border-white" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full border border-white" />
          <div className="absolute bottom-0 left-0 w-full h-32" style={{ background: 'linear-gradient(to top, rgba(0,87,184,0.3), transparent)' }} />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16">
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-2xl">
                <svg className="w-9 h-9" style={{ color: '#0057B8' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13M3 13v5a1 1 0 001 1h1a2 2 0 004 0h8a2 2 0 004 0h1a1 1 0 001-1v-5M3 13h18" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-black text-white tracking-tight">AUTO-ESCUELA</h1>
                <p className="text-blue-200 font-bold text-lg tracking-widest">BAHILLO</p>
              </div>
            </div>
            <p className="text-blue-100 text-lg leading-relaxed max-w-sm">
              Sistema de gestión de prácticas de conducción. Organiza, reserva y controla todo desde un solo lugar.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            {[
              { label: 'Reservas online', desc: 'Alumnos reservan 24/7' },
              { label: 'Google Calendar', desc: 'Sincronización automática' },
              { label: 'Sin papel', desc: 'Todo digitalizado' },
              { label: 'Coche y Camión', desc: 'Gestión unificada' },
            ].map(item => (
              <div key={item.label} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                <p className="text-white font-semibold text-sm">{item.label}</p>
                <p className="text-blue-200 text-xs mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel derecho — login */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Logo móvil */}
          <div className="flex lg:hidden items-center gap-3 mb-10 justify-center">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#0057B8' }}>
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13M3 13v5a1 1 0 001 1h1a2 2 0 004 0h8a2 2 0 004 0h1a1 1 0 001-1v-5M3 13h18" />
              </svg>
            </div>
            <div>
              <p className="text-white font-black tracking-tight">AUTO-ESCUELA BAHILLO</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Bienvenido</h2>
          <p className="text-sm mb-8" style={{ color: '#6b8ab0' }}>Accede al panel de gestión</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#a0b8d0' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="carlos@autoescuela.com"
                className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200"
                style={{
                  background: '#0f1c2e',
                  border: '1.5px solid #1a2d45',
                  color: 'white',
                }}
                onFocus={e => e.target.style.borderColor = '#0057B8'}
                onBlur={e => e.target.style.borderColor = '#1a2d45'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#a0b8d0' }}>Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••"
                className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200"
                style={{
                  background: '#0f1c2e',
                  border: '1.5px solid #1a2d45',
                }}
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
              className="w-full font-bold rounded-xl py-3 text-sm transition-all duration-200 text-white mt-2"
              style={{
                background: loading || !email || !password ? '#1a2d45' : '#0057B8',
                color: loading || !email || !password ? '#4a6080' : 'white',
              }}
              onMouseEnter={e => { if (!loading && email && password) (e.target as HTMLButtonElement).style.background = '#004494' }}
              onMouseLeave={e => { if (!loading && email && password) (e.target as HTMLButtonElement).style.background = '#0057B8' }}
            >
              {loading ? 'Entrando...' : 'Entrar al panel'}
            </button>
          </div>

          <p className="text-center text-xs mt-8" style={{ color: '#3a5070' }}>
            Auto-Escuela Bahillo · Palencia
          </p>
        </div>
      </div>
    </main>
  )
}