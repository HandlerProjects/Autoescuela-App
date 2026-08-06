import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  // getSessionUser() ya garantiza role admin/instructor/secretary — cualquier
  // staff autenticado puede usar el tablón, no hace falta restringir más.

  const { studentId, instructorId: bodyInstructorId } = await req.json()

  if (!studentId) {
    return NextResponse.json({ error: 'studentId es obligatorio' }, { status: 400 })
  }

  // Instructores siempre se autoasignan; admin y secretaría eligen instructor explícitamente
  let instructorId: string
  if (user.role === 'instructor') {
    instructorId = user.id
  } else {
    if (!bodyInstructorId) {
      return NextResponse.json({ error: 'instructorId es obligatorio' }, { status: 400 })
    }
    instructorId = bodyInstructorId
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: claimed, error } = await supabaseAdmin
    .from('students')
    .update({ instructor_id: instructorId })
    .eq('id', studentId)
    .is('instructor_id', null)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: 'Este alumno ya fue reclamado por otro profesor' }, { status: 409 })
  }

  // Devolver nombre del instructor para la notificación al alumno
  const { data: instructor } = await supabaseAdmin
    .from('instructors')
    .select('name')
    .eq('id', instructorId)
    .single()

  return NextResponse.json({ ok: true, instructorName: instructor?.name ?? null })
}
