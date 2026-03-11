'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const navItems = [
  {
    href: '/admin',
    label: 'Hoy',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/admin/calendario',
    label: 'Calendario',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/admin/alumnos',
    label: 'Alumnos',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#0a0f1a' }}>

      {/* Sidebar */}
      <aside className="w-60 flex flex-col fixed h-full" style={{ background: '#0d1829', borderRight: '1px solid #1a2d45' }}>

        {/* Logo */}
<div className="px-4 py-5" style={{ borderBottom: '1px solid #1a2d45' }}>
  <div className="w-full rounded-xl overflow-hidden" style={{ background: '#0057B8' }}>
    <div className="px-4 py-4">
      {/* Camión minimalista */}
      <svg viewBox="0 0 180 55" className="w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Remolque */}
        <rect x="52" y="8" width="122" height="34" rx="2" stroke="white" strokeWidth="2" fill="none" opacity="0.9"/>
        {/* Cabina */}
        <path d="M8 42 L8 20 Q8 14 14 14 L52 14 L52 42 Z" stroke="white" strokeWidth="2" fill="none" opacity="0.9"/>
        {/* Parabrisas */}
        <path d="M14 20 L14 32 L36 32 L36 20 Q36 16 32 16 L18 16 Q14 16 14 20 Z" fill="white" opacity="0.15"/>
        <path d="M14 20 L14 32 L36 32 L36 20 Q36 16 32 16 L18 16 Q14 16 14 20 Z" stroke="white" strokeWidth="1.5" fill="none"/>
        {/* Ruedas */}
        <circle cx="20" cy="44" r="7" stroke="white" strokeWidth="2" fill="#0057B8"/>
        <circle cx="20" cy="44" r="2.5" fill="white" opacity="0.6"/>
        <circle cx="42" cy="44" r="7" stroke="white" strokeWidth="2" fill="#0057B8"/>
        <circle cx="42" cy="44" r="2.5" fill="white" opacity="0.6"/>
        <circle cx="120" cy="44" r="7" stroke="white" strokeWidth="2" fill="#0057B8"/>
        <circle cx="120" cy="44" r="2.5" fill="white" opacity="0.6"/>
        <circle cx="142" cy="44" r="7" stroke="white" strokeWidth="2" fill="#0057B8"/>
        <circle cx="142" cy="44" r="2.5" fill="white" opacity="0.6"/>
        <circle cx="164" cy="44" r="7" stroke="white" strokeWidth="2" fill="#0057B8"/>
        <circle cx="164" cy="44" r="2.5" fill="white" opacity="0.6"/>
        {/* Línea chasis */}
        <line x1="8" y1="42" x2="174" y2="42" stroke="white" strokeWidth="1.5" opacity="0.4"/>
      </svg>

      {/* Texto */}
      <div className="mt-1 pl-0.5">
        <p className="text-white text-xs font-medium tracking-widest opacity-80" style={{ letterSpacing: '0.2em' }}>AUTO-ESCUELA</p>
        <p className="text-white font-black text-xl tracking-tight leading-none" style={{ letterSpacing: '0.05em' }}>BAHILLO</p>
      </div>
    </div>
  </div>
</div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                style={{
                  background: isActive ? '#0057B8' : 'transparent',
                  color: isActive ? 'white' : '#6b8ab0',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#0f1c2e' }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Info + Logout */}
        <div className="px-3 py-4" style={{ borderTop: '1px solid #1a2d45' }}>
          <div className="px-3 py-2 mb-2 rounded-xl" style={{ background: '#0f1c2e' }}>
            <p className="text-xs font-medium text-white">Auto-Escuela Bahillo</p>
            <p className="text-xs mt-0.5" style={{ color: '#3a5070' }}>Palencia</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
            style={{ color: '#6b8ab0' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = '#0f1c2e'
              ;(e.currentTarget as HTMLElement).style.color = 'white'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLElement).style.color = '#6b8ab0'
            }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar sesión
          </button>
        </div>

      </aside>

      {/* Contenido */}
      <main className="flex-1 ml-60 min-h-screen">
        {children}
      </main>

    </div>
  )
}