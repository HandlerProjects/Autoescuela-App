import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { bookingId } = await req.json()
  if (!bookingId) return NextResponse.json({ error: 'bookingId obligatorio' }, { status: 400 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Un instructor solo puede marcar como no-show reservas de sus propios alumnos
  if (user.role === 'instructor') {
    const { data: booking } = await supabaseAdmin.from('bookings').select('instructor_id').eq('id', bookingId).single()
    if (!booking || booking.instructor_id !== user.id) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }
  }

  const { error } = await supabaseAdmin
    .from('bookings')
    .update({ no_show: true, status: 'cancelled' })
    .eq('id', bookingId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
