import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { APP_URL } from '@/lib/email'

// Cada ruta de /api/** es una función serverless independiente en Vercel — mantener
// caliente solo esta (con el ping a Supabase de abajo) no evita que las demás se
// enfríen si nadie las usa entre medias. Las secciones que menos tráfico reciben
// (instructor, secretaría) son justo las que más veces se topan con una función fría.
// No hace falta sesión real: basta con que el contenedor arranque, aunque la ruta
// responda 401 — lo que cuesta tiempo es el arranque, no completar la lógica.
const ROUTES_TO_WARM = [
  '/api/auth/me',
  '/api/instructor/bookings',
  '/api/instructor/alumnos',
  '/api/calendario/data',
  '/api/tablon/list',
  '/api/alumnos/list',
  '/api/cuadrante/data',
  '/api/pagos/list',
  '/api/alertas/list',
  '/api/examenes/list',
]

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Ping mínimo para mantener Supabase activo
  await supabase.from('students').select('id').limit(1)

  const warmed = await Promise.allSettled(
    ROUTES_TO_WARM.map(path => fetch(`${APP_URL}${path}`, { cache: 'no-store' }))
  )

  return NextResponse.json({
    ok: true,
    ts: new Date().toISOString(),
    warmed: warmed.map((r, i) => ({
      path: ROUTES_TO_WARM[i],
      status: r.status === 'fulfilled' ? r.value.status : 'error',
    })),
  })
}
