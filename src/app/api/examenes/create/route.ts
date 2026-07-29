import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (user.role === 'secretary') return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const { student_id, exam_type, exam_date, result, attempt_number, notes } = await req.json()
  if (!student_id || !exam_type || !exam_date) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Un instructor solo puede registrar exámenes de sus propios alumnos
  if (user.role === 'instructor') {
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('instructor_id')
      .eq('id', student_id)
      .single()

    if (!student || student.instructor_id !== user.id) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }
  }

  const { error } = await supabaseAdmin.from('exams').insert({
    student_id,
    instructor_id: user.id,
    exam_type,
    exam_date,
    result: result ?? 'pending',
    attempt_number: attempt_number ?? 1,
    notes: notes?.trim() || null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
