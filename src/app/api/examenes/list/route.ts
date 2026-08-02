import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/auth'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  let query = supabaseAdmin
    .from('exams')
    .select('*, student:students(full_name, order_number)')
    .order('exam_date', { ascending: false })

  // Un instructor solo ve los exámenes de sus propios alumnos
  if (user.role === 'instructor') {
    const { data: ownStudents, error: studentsError } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('instructor_id', user.id)

    if (studentsError) return NextResponse.json({ error: studentsError.message }, { status: 500 })

    const studentIds = (ownStudents ?? []).map(s => s.id)
    if (studentIds.length === 0) return NextResponse.json({ exams: [] })

    query = query.in('student_id', studentIds)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ exams: data })
}
