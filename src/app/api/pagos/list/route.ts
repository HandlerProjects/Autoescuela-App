import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser, isAdminOrSecretary } from '@/lib/auth'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  // Los instructores no tienen acceso a ningún dato de pagos/deudas
  if (!isAdminOrSecretary(user)) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [{ data: paymentsData, error: paymentsError }, { data: studentsData, error: studentsError }, { data: ratesData, error: ratesError }] =
    await Promise.all([
      supabaseAdmin.from('payments').select('*, student:students(full_name, order_number)').order('created_at', { ascending: false }),
      supabaseAdmin.from('students').select('*').eq('is_active', true).order('order_number'),
      supabaseAdmin.from('rates').select('*'),
    ])

  if (paymentsError) return NextResponse.json({ error: paymentsError.message }, { status: 500 })
  if (studentsError) return NextResponse.json({ error: studentsError.message }, { status: 500 })
  if (ratesError) return NextResponse.json({ error: ratesError.message }, { status: 500 })

  return NextResponse.json({ payments: paymentsData, students: studentsData, rates: ratesData })
}
