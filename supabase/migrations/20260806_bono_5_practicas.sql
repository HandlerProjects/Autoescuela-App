-- Bono de 5 prácticas — bloqueo de reservas al agotar el saldo.
--
-- Petición del dueño: la app no debe enseñar importes en ningún sitio, solo contar prácticas.
-- Cuando un alumno completa 5 prácticas sin pagar (sean la 1→5 o la 13→18), deja de poder
-- reservar y ve "Saldo agotado, pase por la oficina para poder seguir reservando".
-- La secretaría confirma el pago desde /admin/pagos y se le habilitan otras 5.
--
-- Diseño: en vez de un contador que se decrementa (frágil: si se corrige el estado de una
-- práctica el saldo se descuadra), se guarda el TOPE acumulado de prácticas pagadas. El estado
-- de suspensión se deduce siempre comparándolo con las prácticas realmente completadas, así que
-- es idempotente y no hay que enganchar nada al marcado de "completada".
--
--   suspendido  ⇔  count(bookings completed) >= practices_paid_through
--   pagar       ⇒  practices_paid_through += 5

alter table public.students
  add column if not exists practices_paid_through integer not null default 5;

comment on column public.students.practices_paid_through is
  'Nº acumulado de prácticas completadas que el alumno tiene pagadas. Está suspendido cuando su recuento de bookings con status=completed alcanza este valor. Cada pago confirmado en /admin/pagos le suma 5.';

-- Punto de partida acordado con el dueño: las prácticas ya hechas antes de activar el sistema
-- NO cuentan como deuda. Todos los alumnos arrancan con 5 prácticas por delante desde hoy.
update public.students s
set practices_paid_through = coalesce((
  select count(*)
  from public.bookings b
  where b.student_id = s.id
    and b.status = 'completed'
), 0) + 5;
