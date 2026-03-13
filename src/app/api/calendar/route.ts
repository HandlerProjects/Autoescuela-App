import { NextRequest, NextResponse } from 'next/server'
import { createCalendarEvent, deleteCalendarEvent } from '@/lib/google-calendar'

// POST /api/calendar — crea un evento cuando se confirma una reserva
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const eventId = await createCalendarEvent(body)
    return NextResponse.json({ eventId })
  } catch (err) {
    console.error('Google Calendar POST error:', err)
    return NextResponse.json({ eventId: null }, { status: 200 }) // no bloquear la reserva si falla el calendar
  }
}

// DELETE /api/calendar — elimina el evento cuando se cancela la reserva
export async function DELETE(req: NextRequest) {
  try {
    const { eventId } = await req.json()
    if (eventId) await deleteCalendarEvent(eventId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Google Calendar DELETE error:', err)
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
