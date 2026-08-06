import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Cierra automáticamente las prácticas cuya hora ya ha pasado.
//
// Hasta ahora el paso confirmed → completed dependía de que alguien pulsara el botón en el panel,
// y en la práctica casi nadie lo hacía: había 10 prácticas ya pasadas atascadas en `confirmed`
// (una de julio) frente a solo 3 completadas en toda la base de datos. Eso falseaba el progreso
// del alumno, los hitos y las estadísticas, y dejaría el bono de prácticas sin agotarse nunca.
//
// No se tocan las canceladas ni las marcadas como no presentado: una ausencia no es una clase dada.

// La base de datos guarda fechas y horas locales de la autoescuela, no UTC, así que el corte se
// calcula en la zona de Madrid — si no, el cron cerraría o dejaría abiertas prácticas de más
// según la hora a la que se ejecute.
function nowInMadrid(): { date: string; time: string } {
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Madrid',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  const [date, time] = fmt.format(new Date()).split(' ')
  return { date, time }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { date: today, time: now } = nowInMadrid()

  // Días anteriores: la jornada entera ha terminado, se cierran todas.
  const { data: pastDays, error: pastError } = await supabase
    .from('bookings')
    .update({ status: 'completed' })
    .eq('status', 'confirmed')
    .eq('no_show', false)
    .lt('practice_date', today)
    .select('id')

  if (pastError) {
    console.error('Cron auto-complete (días anteriores):', pastError)
    return NextResponse.json({ error: pastError.message }, { status: 500 })
  }

  // Hoy: solo las que ya han terminado según la hora de fin.
  const { data: earlierToday, error: todayError } = await supabase
    .from('bookings')
    .update({ status: 'completed' })
    .eq('status', 'confirmed')
    .eq('no_show', false)
    .eq('practice_date', today)
    .lt('end_time', now)
    .select('id')

  if (todayError) {
    console.error('Cron auto-complete (hoy):', todayError)
    return NextResponse.json({ error: todayError.message }, { status: 500 })
  }

  const completed = (pastDays?.length ?? 0) + (earlierToday?.length ?? 0)
  return NextResponse.json({
    completed,
    previousDays: pastDays?.length ?? 0,
    today: earlierToday?.length ?? 0,
    cutoff: `${today} ${now}`,
  })
}
