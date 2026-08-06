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

  const { studentId, mode } = await req.json()
  if (!studentId) return NextResponse.json({ error: 'studentId obligatorio' }, { status: 400 })
  if (mode !== 'pago' && mode !== 'reset') {
    return NextResponse.json({ error: 'mode debe ser "pago" o "reset"' }, { status: 400 })
  }

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

  const before = await getBonoStatus(supabaseAdmin, studentId, student.practices_paid_through ?? 0)

  // Las dos acciones son distintas a propósito y no deben confundirse:
  //
  // 'pago'  → SUMA un bono. El alumno no tiene por qué haber agotado el anterior: si viene a
  //           pagar cuando le quedaban 3, acaba con 8, no con 5. Recalcular aquí le robaría
  //           las prácticas que ya tenía pagadas.
  // 'reset' → FIJA el contador en BONO_SIZE por delante, descartando lo anterior. Es para el
  //           alumno que entra en la autoescuela con prácticas ya hechas por su cuenta, o para
  //           corregir un contador que se haya quedado mal.
  const newPaidThrough = mode === 'pago'
    ? (student.practices_paid_through ?? 0) + BONO_SIZE
    : before.used + BONO_SIZE

  const { error: updateError } = await supabaseAdmin
    .from('students')
    .update({ practices_paid_through: newPaidThrough })
    .eq('id', studentId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    studentName: student.full_name,
    remaining: Math.max(0, newPaidThrough - before.used),
    paidThrough: newPaidThrough,
  })
}
