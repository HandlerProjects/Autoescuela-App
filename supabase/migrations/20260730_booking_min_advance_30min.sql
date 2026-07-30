-- =================================================================
-- Antelación mínima para reservar: de 24h a 30 minutos
-- Aplicar en: Supabase Dashboard > SQL Editor
-- IMPORTANTE: aplicar DESPUÉS de desplegar el código
--
-- Feedback del dueño de Auto-Escuela Bahillo: la regla de 1 día de
-- antelación para reservar era demasiado estricta. Se sustituye por
-- 30 minutos. La antelación para CANCELAR sin que cuente como
-- no-presentado NO cambia — sigue siendo 24h, se controla aparte en
-- código de aplicación (src/app/s/[token]/page.tsx,
-- MIN_ADVANCE_HOURS_CANCEL), este trigger solo protege el INSERT.
-- =================================================================

CREATE OR REPLACE FUNCTION validate_booking_time()
RETURNS TRIGGER AS $$
DECLARE
  booking_dt timestamptz;
BEGIN
  booking_dt := (NEW.practice_date::text || ' ' || NEW.start_time::text)::timestamp
                AT TIME ZONE 'Europe/Madrid';

  IF booking_dt < NOW() THEN
    RAISE EXCEPTION 'No se puede reservar en el pasado';
  END IF;

  IF booking_dt < NOW() + INTERVAL '30 minutes' THEN
    RAISE EXCEPTION 'La reserva debe hacerse con al menos 30 minutos de antelación';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- El trigger ya existe (check_booking_time en bookings), CREATE OR REPLACE
-- de la función es suficiente — no hace falta recrear el trigger.
