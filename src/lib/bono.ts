import type { SupabaseClient } from '@supabase/supabase-js'

// Bono de prácticas — regla general de la autoescuela, igual para todos los alumnos.
//
// El alumno tiene un bloque de 5 prácticas pagadas. Cuando las agota deja de poder reservar
// hasta que pase por la oficina y la secretaría confirme el pago del siguiente bono.
//
// El consumo cuenta la RESERVA, no la clase dada: reservar un hueco ya gasta saldo. Es lo que
// evita que un alumno acumule diez reservas sin haber pagado ninguna, y que se quede suspendido
// a mitad de una semana ya reservada — nunca puede tener más reservas vivas que saldo.
//
// `students.practices_paid_through` guarda el TOPE acumulado de prácticas pagadas, no un contador
// que baja. Así el estado se deduce siempre de lo que hay en la tabla de reservas y no se
// descuadra si se corrige el estado de una práctica a mano.
export const BONO_SIZE = 5

// Estados que gastan saldo: la práctica ya dada y la que está reservada por delante.
// Las canceladas no cuentan — al cancelar, el alumno recupera su hueco del bono.
const CONSUMING_STATUSES = ['completed', 'confirmed'] as const

export interface BonoStatus {
  /** Prácticas gastadas: completadas + reservadas pendientes. */
  used: number
  /** Tope acumulado de prácticas pagadas. */
  paidThrough: number
  /** Prácticas que le quedan antes de tener que pasar por la oficina. Nunca negativo. */
  remaining: number
  /** true → no puede reservar más hasta que se le confirme un pago. */
  suspended: boolean
}

export const SUSPENDED_MESSAGE =
  'Saldo agotado, pase por la oficina para poder seguir reservando'

/**
 * Calcula el saldo del bono de un alumno. Requiere un cliente con service role: la RLS de
 * `bookings` con el token del alumno no da acceso al recuento completo.
 */
export async function getBonoStatus(
  supabaseAdmin: SupabaseClient,
  studentId: string,
  paidThrough: number
): Promise<BonoStatus> {
  const { count } = await supabaseAdmin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .in('status', CONSUMING_STATUSES as unknown as string[])

  return buildBonoStatus(count ?? 0, paidThrough)
}

/**
 * Misma regla que `getBonoStatus` pero a partir de un recuento ya calculado, para las pantallas
 * que ya tienen las reservas cargadas y no deben hacer otra consulta.
 */
export function buildBonoStatus(used: number, paidThrough: number): BonoStatus {
  return {
    used,
    paidThrough,
    remaining: Math.max(0, paidThrough - used),
    suspended: used >= paidThrough,
  }
}

/** Cuenta las reservas que gastan saldo dentro de una lista ya cargada en cliente. */
export function countConsuming(bookings: { status: string }[]): number {
  return bookings.filter(b => (CONSUMING_STATUSES as readonly string[]).includes(b.status)).length
}
