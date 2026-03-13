import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const { login_code, login_pin } = await req.json()

  if (!login_code || !login_pin) {
    return NextResponse.json({ error: 'Código y PIN son obligatorios' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: student } = await supabaseAdmin
    .from('students')
    .select('token, is_active, login_code, login_pin')
    .eq('login_code', login_code.trim())
    .eq('login_pin', login_pin.trim())
    .single()

  if (!student) {
    return NextResponse.json({ error: 'Código o PIN incorrectos' }, { status: 401 })
  }

  if (!student.is_active) {
    return NextResponse.json({ error: 'Tu cuenta está desactivada. Contacta con la autoescuela.' }, { status: 403 })
  }

  return NextResponse.json({ token: student.token })
}
