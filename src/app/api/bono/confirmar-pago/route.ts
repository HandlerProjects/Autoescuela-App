import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser, isAdminOrSecretary } from '@/lib/auth'
import { BONO_SIZE, getBonoStatus } from '@/lib/bono'

// La secretaría confirma en el mostrador que el alumno ha pagado su siguiente bono,
// y se le habilitan otras BONO_SIZE prácticas.
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!isAdminOrSecretary(user)) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const { studentId } = await req.json()
  if (!studentId) return NextResponse.json({ error: 'studentId obligatorio' }, { status: 400 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: student, error: studentError } = await supabaseAdmin
    .from('students')
    .select('id, full_name, practices_paid_through')
    .eq('id', studentId)
    .single()

  if (studentError || !student) {
    return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 })
  }

  // El tope se calcula sobre las prácticas realmente gastadas, no sumando a ciegas: si el alumno
  // llega al mostrador con saldo de sobra (o si se pulsa dos veces por error), no se le regalan
  // bonos acumulados. Siempre acaba con exactamente BONO_SIZE prácticas por delante.
  const before = await getBonoStatus(supabaseAdmin, studentId, student.practices_paid_through ?? 0)
  const newPaidThrough = before.used + BONO_SIZE

  const { error: updateError } = await supabaseAdmin
    .from('students')
    .update({ practices_paid_through: newPaidThrough })
    .eq('id', studentId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    studentName: student.full_name,
    remaining: BONO_SIZE,
    paidThrough: newPaidThrough,
  })
}
