-- Recálculo del punto de partida del bono.
--
-- La migración anterior (20260806_bono_5_practicas.sql) fijó el tope contando solo las prácticas
-- COMPLETADAS. Al implementarlo se vio que eso no podía funcionar: el paso confirmed → completed
-- dependía de que alguien pulsara un botón que casi nunca se pulsaba (10 prácticas ya pasadas
-- seguían en `confirmed`, frente a 3 completadas en toda la base de datos), así que el bono no se
-- habría agotado nunca.
--
-- Ahora el saldo lo gasta la RESERVA, no la clase dada: cuentan las completadas y las confirmadas
-- pendientes. Esto además evita que un alumno acumule más reservas que saldo y que se quede
-- suspendido a mitad de una semana ya reservada.
--
-- Hay que rehacer el punto de partida con el mismo criterio de siempre: las reservas que ya
-- existen hoy no cuentan como deuda, todos los alumnos arrancan con 5 prácticas por delante.

update public.students s
set practices_paid_through = coalesce((
  select count(*)
  from public.bookings b
  where b.student_id = s.id
    and b.status in ('completed', 'confirmed')
), 0) + 5;
