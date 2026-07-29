'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useState, useEffect } from 'react'

const INSTRUCTOR_ROUTES = ['/admin', '/admin/calendario', '/admin/alumnos', '/admin/tablon', '/admin/examenes', '/admin/alertas', '/admin/festivos', '/admin/cuadrante']
const SECRETARY_ROUTES = ['/admin', '/admin/alumnos', '/admin/tablon', '/admin/pagos', '/admin/alertas']

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  instructor: 'Instructor',
  secretary: 'Secretaria',
}

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
  {
    href: '/admin/tablon',
    label: 'Tablón',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    href: '/admin/examenes',
    label: 'Exámenes',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: '/admin/pagos',
    label: 'Pagos',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: '/admin/alertas',
    label: 'Alertas',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    href: '/admin/festivos',
    label: 'Festivos y horarios',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
  },
  {
    href: '/admin/cuadrante',
    label: 'Cuadrante',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M14 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" />
      </svg>
    ),
  },
  {
    href: '/admin/equipo',
    label: 'Equipo',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
]

const SidebarContent = ({
  pathname,
  onNavigate,
  onLogout,
  tablonCount,
  items,
  userName,
  userRole,
}: {
  pathname: string
  onNavigate: () => void
  onLogout: () => void
  tablonCount: number
  items: typeof navItems
  userName: string | null
  userRole: string | null
}) => (
  <>
    {/* Logo */}
    <div className="px-4 py-5" style={{ borderBottom: '1px solid #1a2d45' }}>
      <div className="w-full rounded-xl overflow-hidden" style={{ background: '#0057B8' }}>
        <div className="px-4 py-4">
          <svg viewBox="0 0 180 55" className="w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="52" y="8" width="122" height="34" rx="2" stroke="white" strokeWidth="2" fill="none" opacity="0.9"/>
            <path d="M8 42 L8 20 Q8 14 14 14 L52 14 L52 42 Z" stroke="white" strokeWidth="2" fill="none" opacity="0.9"/>
            <path d="M14 20 L14 32 L36 32 L36 20 Q36 16 32 16 L18 16 Q14 16 14 20 Z" fill="white" opacity="0.15"/>
            <path d="M14 20 L14 32 L36 32 L36 20 Q36 16 32 16 L18 16 Q14 16 14 20 Z" stroke="white" strokeWidth="1.5" fill="none"/>
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
            <line x1="8" y1="42" x2="174" y2="42" stroke="white" strokeWidth="1.5" opacity="0.4"/>
          </svg>
          <div className="mt-1 pl-0.5">
            <p className="text-white text-xs font-medium tracking-widest opacity-80" style={{ letterSpacing: '0.2em' }}>AUTO-ESCUELA</p>
            <p className="text-white font-black text-xl tracking-tight leading-none" style={{ letterSpacing: '0.05em' }}>BAHILLO</p>
          </div>
        </div>
      </div>
    </div>

    {/* Nav */}
    <nav className="flex-1 min-h-0 overflow-y-auto scroll-smooth px-3 py-4 space-y-1">
      {items.map(item => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
            style={{
              background: isActive ? '#0057B8' : 'transparent',
              color: isActive ? 'white' : '#6b8ab0',
            }}
            onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#0f1c2e' }}
            onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {item.href === '/admin/tablon' && tablonCount > 0 && (
              <span
                className="text-xs font-black rounded-full flex items-center justify-center"
                style={{ background: '#ef4444', color: 'white', minWidth: '20px', height: '20px', padding: '0 5px' }}
              >
                {tablonCount}
              </span>
            )}
          </Link>
        )
      })}
    </nav>

    {/* Info + Logout */}
    <div className="px-3 py-4" style={{ borderTop: '1px solid #1a2d45' }}>
      <div className="px-3 py-2 mb-2 rounded-xl" style={{ background: '#0f1c2e' }}>
        {userName && (
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-xs font-semibold text-white truncate">{userName}</p>
            {userRole && (
              <span className="text-xs px-1.5 py-0.5 rounded font-bold flex-shrink-0 ml-2"
                style={{ background: '#0057B820', color: '#0057B8', fontSize: '10px' }}>
                {ROLE_LABELS[userRole] ?? userRole}
              </span>
            )}
          </div>
        )}
        <p className="text-xs" style={{ color: '#3a5070' }}>Auto-Escuela Bahillo</p>
      </div>
      <button
        onClick={onLogout}
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
  </>
)

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const [tablonCount, setTablonCount] = useState(0)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .is('instructor_id', null)
      .eq('is_active', true)
      .then(({ count }) => setTablonCount(count ?? 0))

    fetch('/api/auth/me')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        setUserRole(data?.role ?? null)
        setUserName(data?.name ?? null)
      })
  }, [])

  const filteredNavItems = userRole === 'admin'
    ? navItems
    : userRole === 'instructor'
      ? navItems.filter(i => INSTRUCTOR_ROUTES.includes(i.href))
      : userRole === 'secretary'
        ? navItems.filter(i => SECRETARY_ROUTES.includes(i.href))
        : []

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const currentLabel = navItems.find(i => i.href === pathname)?.label ?? 'Admin'

  return (
    <div className="min-h-screen flex" style={{ background: '#0a0f1a' }}>

      {/* ── SIDEBAR — solo escritorio ── */}
      <aside className="hidden md:flex w-60 flex-col fixed h-full" style={{ background: '#0d1829', borderRight: '1px solid #1a2d45' }}>
        <SidebarContent pathname={pathname} onNavigate={() => {}} onLogout={handleLogout} tablonCount={tablonCount} items={filteredNavItems} userName={userName} userRole={userRole} />
      </aside>

      {/* ── TOPBAR — solo móvil ── */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4"
        style={{
          background: '#0d1829',
          borderBottom: '1px solid #1a2d45',
          height: '56px',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="px-2 py-1 rounded-lg" style={{ background: '#0057B8' }}>
            <p className="text-white font-black text-xs tracking-widest">BAHILLO</p>
          </div>
          <p className="text-white font-semibold text-sm">{currentLabel}</p>
        </div>
        <button
          onClick={() => setMenuOpen(true)}
          className="p-2 rounded-xl transition"
          style={{ color: '#6b8ab0' }}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* ── DRAWER — solo móvil ── */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setMenuOpen(false)}
          />
          {/* Panel */}
          <div
            className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 flex flex-col"
            style={{ background: '#0d1829', borderRight: '1px solid #1a2d45' }}
          >
            {/* Botón cerrar */}
            <button
              onClick={() => setMenuOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl"
              style={{ color: '#6b8ab0' }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <SidebarContent
              pathname={pathname}
              onNavigate={() => setMenuOpen(false)}
              onLogout={handleLogout}
              tablonCount={tablonCount}
              items={filteredNavItems}
              userName={userName}
              userRole={userRole}
            />
          </div>
        </>
      )}

      {/* ── CONTENIDO ── */}
      <main className="flex-1 md:ml-60 min-h-screen pt-14 md:pt-0">
        {children}
      </main>

    </div>
  )
}
