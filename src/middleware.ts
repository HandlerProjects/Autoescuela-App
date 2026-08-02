import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export const runtime = 'nodejs'
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  if (path.startsWith('/auth/')) return supabaseResponse

  const protectedPaths = ['/admin', '/instructor']
  const isProtected = protectedPaths.some(p => path.startsWith(p))

  // error.status 400/401 = Supabase confirma que no hay sesión válida → expulsar.
  // Cualquier otro error (timeout, red, cold-start del servidor de Auth) es transitorio:
  // no expulsamos a un usuario con sesión válida solo porque la comprobación falló a
  // tiempo. Las rutas API ya vuelven a autenticar server-side (getSessionUser) antes
  // de servir ningún dato, así que la protección real no depende de este redirect.
  const sessionConfirmedMissing = !user && (!error || error.status === 400 || error.status === 401)

  if (isProtected && sessionConfirmedMissing) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/'
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}