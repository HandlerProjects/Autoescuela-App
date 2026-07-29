'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function CambiarContrasenaPage() {
  const router = useRouter()
  const supabase = createClient()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [userName, setUserName] = useState('')

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/')
        return
      }
      setUserName(user.user_metadata?.full_name?.split(' ')[0] ?? '')
      setChecking(false)
    }
    checkAuth()
  }, [])

  async function handleSubmit() {
    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    setError('')

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
      data: { must_change_password: false },
    })

    if (updateError) {
      setError('No se pudo actualizar la contraseña. Inténtalo de nuevo.')
      setLoading(false)
      return
    }

    // Redirigir al panel según el rol
    const meRes = await fetch('/api/auth/me')
    const me = meRes.ok ? await meRes.json() : null

    if (me?.role === 'secretary') router.replace('/secretaria')
    else if (me?.role === 'instructor') router.replace('/instructor')
    else router.replace('/admin')
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: '#0a0f1a' }}>
        <p className="text-sm" style={{ color: '#3a5070' }}>Cargando...</p>
      </main>
    )
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

        {/* Icono de seguridad */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#0057B815', border: '1.5px solid #0057B830' }}>
            <svg className="w-7 h-7" style={{ color: '#0057B8' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-black text-white text-center mb-2">
          {userName ? `Hola, ${userName}` : 'Bienvenido/a'}
        </h1>
        <p className="text-sm text-center mb-8" style={{ color: '#6b8ab0' }}>
          Por seguridad, elige una nueva contraseña para tu cuenta
        </p>

        <div className="space-y-4">

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#a0b8d0' }}>
              Nueva contraseña
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Mínimo 8 caracteres"
              className="w-full rounded-xl px-4 py-3.5 text-white text-sm outline-none transition-all"
              style={{ background: '#0d1829', border: '1.5px solid #1a2d45' }}
              onFocus={e => e.target.style.borderColor = '#0057B8'}
              onBlur={e => e.target.style.borderColor = '#1a2d45'}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#a0b8d0' }}>
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Repite la contraseña"
              className="w-full rounded-xl px-4 py-3.5 text-white text-sm outline-none transition-all"
              style={{ background: '#0d1829', border: '1.5px solid #1a2d45' }}
              onFocus={e => e.target.style.borderColor = '#0057B8'}
              onBlur={e => e.target.style.borderColor = '#1a2d45'}
            />
          </div>

          {/* Indicador de fuerza */}
          {newPassword.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className="flex-1 h-1 rounded-full transition-all duration-300"
                    style={{
                      background: newPassword.length >= i * 3
                        ? newPassword.length >= 12 ? '#34d399'
                          : newPassword.length >= 8 ? '#0057B8'
                            : '#f59e0b'
                        : '#1a2d45'
                    }}
                  />
                ))}
              </div>
              <p className="text-xs" style={{
                color: newPassword.length >= 12 ? '#34d399'
                  : newPassword.length >= 8 ? '#0057B8'
                    : '#f59e0b'
              }}>
                {newPassword.length >= 12 ? 'Contraseña fuerte'
                  : newPassword.length >= 8 ? 'Contraseña válida'
                    : 'Contraseña corta'}
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || newPassword.length < 8 || !confirmPassword}
            className="w-full py-3.5 rounded-xl text-sm font-bold transition-all duration-200"
            style={{
              background: loading || newPassword.length < 8 || !confirmPassword ? '#1a2d45' : '#0057B8',
              color: loading || newPassword.length < 8 || !confirmPassword ? '#4a6080' : 'white',
            }}
            onMouseEnter={e => { if (!loading && newPassword.length >= 8 && confirmPassword) (e.currentTarget as HTMLElement).style.background = '#004494' }}
            onMouseLeave={e => { if (!loading && newPassword.length >= 8 && confirmPassword) (e.currentTarget as HTMLElement).style.background = '#0057B8' }}
          >
            {loading ? 'Guardando...' : 'Establecer contraseña y entrar'}
          </button>

        </div>
      </div>
    </main>
  )
}
