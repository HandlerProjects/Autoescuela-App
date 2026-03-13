import crypto from 'crypto'

// ── Genera el access token usando la Service Account ─────────────────────────
async function getAccessToken(): Promise<string> {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!serviceAccountEmail || !privateKey) {
    throw new Error('Faltan las variables de entorno de Google Calendar (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY)')
  }

  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url')

  const sign = crypto.createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const signature = sign.sign(privateKey, 'base64url')
  const jwt = `${header}.${payload}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  const data = await res.json()
  if (!data.access_token) throw new Error('No se pudo obtener el access token de Google')
  return data.access_token
}

// ── Crea un evento en Google Calendar cuando se confirma una reserva ──────────
export async function createCalendarEvent(booking: {
  bookingId: string
  studentName: string
  practiceDate: string
  startTime: string  // HH:MM
  endTime: string    // HH:MM
  practiceType: 'car' | 'truck'
}): Promise<string | null> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID
  if (!calendarId) throw new Error('Falta GOOGLE_CALENDAR_ID en las variables de entorno')

  const accessToken = await getAccessToken()
  const typeLabel = booking.practiceType === 'car' ? 'Coche' : 'Camión'

  const event = {
    summary: `Práctica ${typeLabel} — ${booking.studentName}`,
    description: `Alumno: ${booking.studentName}\nTipo: ${typeLabel}\nID reserva: ${booking.bookingId}`,
    start: {
      dateTime: `${booking.practiceDate}T${booking.startTime}:00`,
      timeZone: 'Europe/Madrid',
    },
    end: {
      dateTime: `${booking.practiceDate}T${booking.endTime}:00`,
      timeZone: 'Europe/Madrid',
    },
    extendedProperties: {
      private: { bookingId: booking.bookingId },
    },
  }

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  )

  const data = await res.json()
  return data.id ?? null
}

// ── Elimina el evento de Google Calendar cuando se cancela la reserva ─────────
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID
  if (!calendarId) throw new Error('Falta GOOGLE_CALENDAR_ID en las variables de entorno')

  const accessToken = await getAccessToken()

  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )
}
