import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser, isAdminOrSecretary } from '@/lib/auth'
import { buildBonoStatus } from '@/lib/bono'

// Saldo del bono de todos los alumnos activos, para la pantalla de oficina.
// Mismo criterio de acceso que /api/pagos/list: los profesores no ven nada de pagos ni deudas.
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!isAdminOrSecretary(user)) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [{ data: students, error: studentsError }, { data: bookings, error: bookingsError }] =
    await Promise.all([
      supabaseAdmin
        .from('students')
        .select('id, full_name, order_number, practices_paid_through')
        .eq('is_active', true)
        .order('order_number'),
      // Una sola consulta para todos los alumnos en vez de una por alumno: son pocas filas y
      // evita N+1 en una pantalla que la secretaría abre con el alumno delante en el mostrador.
      supabaseAdmin
        .from('bookings')
        .select('student_id')
        .in('status', ['completed', 'confirmed']),
    ])

  if (studentsError) return NextResponse.json({ error: studentsError.message }, { status: 500 })
  if (bookingsError) return NextResponse.json({ error: bookingsError.message }, { status: 500 })

  const usedByStudent = new Map<string, number>()
  for (const b of bookings ?? []) {
    usedByStudent.set(b.student_id, (usedByStudent.get(b.student_id) ?? 0) + 1)
  }

  const rows = (students ?? []).map(s => {
    const status = buildBonoStatus(usedByStudent.get(s.id) ?? 0, s.practices_paid_through ?? 0)
    return {
      id: s.id,
      fullName: s.full_name,
      orderNumber: s.order_number,
      ...status,
    }
  })

  return NextResponse.json({ students: rows })
}
