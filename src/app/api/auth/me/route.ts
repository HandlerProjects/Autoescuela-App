import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  return NextResponse.json({ id: user.id, role: user.role, name: user.name, practiceTypes: user.practiceTypes })
}
