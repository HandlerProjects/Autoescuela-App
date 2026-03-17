'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError('No se pudo establecer la contraseña. Inténtalo de nuevo.')
      setLoading(false)
      return
    }

    router.push('/admin')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#060e1a' }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: '#0057B820', border: '1px solid #0057B840' }}>
            🚗
          </div>
          <div>
            <p className="text-white font-black text-lg leading-none">Auto-Escuela</p>
            <p className="text-xs font-medium leading-none mt-0.5" style={{ color: '#3a5070' }}>Bahillo</p>
          </div>
        </div>

        <div className="rounded-2xl p-7" style={{ background: '#0d1829', border: '1px solid #1a2d45' }}>
          <h1 className="text-white font-black text-xl mb-1">Bienvenido</h1>
          <p className="text-sm mb-6" style={{ color: '#3a5070' }}>
            Elige una contraseña para acceder a tu panel de profesor
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6b8ab0' }}>
                Nueva contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                className="w-full rounded-xl px-3 py-3 text-white text-sm outline-none transition-all"
                style={{ background: '#0a1220', border: '1.5px solid #1a2d45' }}
                onFocus={e => e.target.style.borderColor = '#0057B8'}
                onBlur={e => e.target.style.borderColor = '#1a2d45'}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6b8ab0' }}>
                Repetir contraseña
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repite la contraseña"
                required
                className="w-full rounded-xl px-3 py-3 text-white text-sm outline-none transition-all"
                style={{ background: '#0a1220', border: '1.5px solid #1a2d45' }}
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
              type="submit"
              disabled={loading || !password || !confirm}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all"
              style={{
                background: loading || !password || !confirm ? '#1a2d45' : '#0057B8',
                color: loading || !password || !confirm ? '#3a5070' : 'white',
              }}
            >
              {loading ? 'Guardando...' : 'Establecer contraseña y entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
