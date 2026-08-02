import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export type UserRole = 'admin' | 'instructor' | 'secretary'

export interface AuthUser {
  id: string
  role: UserRole
  name: string | null
  // Solo presente cuando role === 'instructor'. Se resuelve aquí (server-side, mismo
  // request) para que las pantallas del instructor no necesiten una segunda llamada de
  // red aparte solo para saber sus tipos de práctica — ver /api/auth/me.
  practiceTypes?: ('car' | 'truck' | 'moto')[]
}

export async function getSessionUser(): Promise<AuthUser | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Se usa el service role para esta lectura: el usuario ya está verificado
    // vía JWT arriba, y depender de RLS sobre `staff` para esta comprobación
    // dejaba a cualquier fallo de política devolviendo "no autorizado" en silencio.
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: staff, error } = await supabaseAdmin
      .from('staff')
      .select('role, name')
      .eq('id', user.id)
      .single()

    if (error) console.error('getSessionUser: fallo al leer staff', error)

    if (!staff || !(['admin', 'instructor', 'secretary'].includes(staff.role))) {
      return null
    }

    let practiceTypes: AuthUser['practiceTypes']
    if (staff.role === 'instructor') {
      const { data: instructor } = await supabaseAdmin
        .from('instructors')
        .select('practice_types')
        .eq('id', user.id)
        .single()
      practiceTypes = instructor?.practice_types ?? undefined
    }

    return { id: user.id, role: staff.role as UserRole, name: staff.name ?? null, practiceTypes }
  } catch {
    return null
  }
}

export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === 'admin'
}

export function isAdminOrInstructor(user: AuthUser | null): boolean {
  return user?.role === 'admin' || user?.role === 'instructor'
}

export function isAdminOrSecretary(user: AuthUser | null): boolean {
  return user?.role === 'admin' || user?.role === 'secretary'
}
