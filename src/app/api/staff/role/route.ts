import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser, isAdmin } from '@/lib/auth'

type StaffRole = 'admin' | 'instructor' | 'secretary'

const VALID_ROLES: StaffRole[] = ['admin', 'instructor', 'secretary']

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const { id, role } = await req.json()

  if (!id || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
  }

  if (id === user.id) {
    return NextResponse.json({ error: 'No puedes cambiar tu propio rol' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: target, error: targetError } = await supabaseAdmin
    .from('staff')
    .select('id, role, email, name')
    .eq('id', id)
    .single()

  if (targetError || !target) {
    return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  }

  if (target.role === 'admin' && role !== 'admin') {
    const { count } = await supabaseAdmin
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('is_active', true)
      .neq('id', id)

    if (!count) {
      return NextResponse.json(
        { error: 'No puede quedar la autoescuela sin ningún admin activo' },
        { status: 400 }
      )
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from('staff')
    .update({ role })
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  if (role === 'instructor') {
    const { data: existingInstructor } = await supabaseAdmin
      .from('instructors')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (!existingInstructor) {
      const { error: insertError } = await supabaseAdmin.from('instructors').insert({
        id,
        email: target.email,
        name: target.name,
        jornada: 'full',
        schedule_morning: true,
        morning_start: '08:00',
        morning_end: '13:30',
        schedule_afternoon: true,
        afternoon_start: '16:00',
        afternoon_end: '19:15',
        break_minutes: 10,
        practice_types: ['car'],
        milestone_counts: [5, 10, 15, 20],
      })

      if (insertError) {
        console.error('Error creando fila de instructor por defecto:', insertError)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
