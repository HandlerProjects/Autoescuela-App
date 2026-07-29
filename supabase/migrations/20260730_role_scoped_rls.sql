-- =================================================================
-- MIGRACIÓN DE SEGURIDAD — Auto-Escuela Bahillo
-- Row-Level Security por rol e instructor (defense-in-depth)
--
-- ⚠️  IMPORTANTE — NO APLICADA A PRODUCCIÓN TODAVÍA ⚠️
-- Este fichero documenta las políticas RLS que endurecerían el acceso
-- directo a Postgres (anon key + JWT de sesión de staff) para que
-- coincida exactamente con la matriz de permisos ya aplicada a nivel
-- de aplicación (rutas /api/* server-side, ver getSessionUser() en
-- src/lib/auth.ts). Hasta ahora esa matriz solo vive en el código de
-- las rutas API — la base de datos seguía aceptando "authenticated ->
-- true" para casi todo. Esta migración es el cierre de esa brecha.
--
-- Revisar manualmente y aplicar vía Supabase Dashboard > SQL Editor
-- cuando se decida. NO ejecutar automáticamente. NO ejecutar contra
-- producción sin antes probar en un proyecto de staging/desarrollo,
-- ya que tabla por tabla se sustituyen políticas "USING (true)" por
-- políticas con alcance restringido y se activa RLS en tablas que hoy
-- no la tienen (exams, payments, rates).
--
-- Matriz de acceso que implementa (staff autenticado):
--   students        admin/secretary: todas · instructor: las suyas + tablón (instructor_id IS NULL)
--   bookings        admin/secretary: todas · instructor: solo las suyas
--   blocked_days    admin: todos · instructor: solo los suyos · secretary: ninguno
--   blocked_slots   admin: todos · instructor: solo los suyos · secretary: ninguno
--   exams           admin: todos · instructor: solo los de sus alumnos · secretary: ninguno
--   payments        admin/secretary: todos · instructor: ninguno (bloqueado por completo)
--   rates           admin/secretary: todas · instructor: ninguna (bloqueado por completo)
-- =================================================================

-- -----------------------------------------------------------------
-- 0. Función auxiliar: rol del staff autenticado actual
--    SECURITY DEFINER para poder leer `staff` desde dentro de una
--    política RLS de otra tabla sin depender de que `staff` tenga
--    (o no) su propia RLS, y sin recursión de políticas.
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_staff_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM staff WHERE id = auth.uid();
$$;

-- -----------------------------------------------------------------
-- 1. students
--    Sustituye las políticas "authenticated -> true" de la
--    migración 20260610_security.sql por políticas por rol.
--    El tablón (instructor_id IS NULL) sigue visible para los 3
--    roles — es el mecanismo real de comunicación alumno-profesor
--    y NO debe restringirse.
-- -----------------------------------------------------------------
DROP POLICY IF EXISTS "students_auth_read_all" ON students;
DROP POLICY IF EXISTS "students_auth_update_all" ON students;

CREATE POLICY "students_auth_select_scoped" ON students
  FOR SELECT TO authenticated
  USING (
    current_staff_role() IN ('admin', 'secretary')
    OR (current_staff_role() = 'instructor' AND (instructor_id = auth.uid() OR instructor_id IS NULL))
  );

CREATE POLICY "students_auth_update_scoped" ON students
  FOR UPDATE TO authenticated
  USING (
    current_staff_role() IN ('admin', 'secretary')
    OR (current_staff_role() = 'instructor' AND instructor_id = auth.uid())
  );

-- -----------------------------------------------------------------
-- 2. bookings
--    admin/secretary conservan acceso completo (lo necesitan: p.ej.
--    secretaría ve reservas dentro de Alertas). El instructor solo
--    ve/edita sus propias reservas — nunca las de otro instructor.
-- -----------------------------------------------------------------
DROP POLICY IF EXISTS "bookings_auth_read_all" ON bookings;
DROP POLICY IF EXISTS "bookings_auth_update_all" ON bookings;

CREATE POLICY "bookings_auth_select_scoped" ON bookings
  FOR SELECT TO authenticated
  USING (
    current_staff_role() IN ('admin', 'secretary')
    OR (current_staff_role() = 'instructor' AND instructor_id = auth.uid())
  );

CREATE POLICY "bookings_auth_update_scoped" ON bookings
  FOR UPDATE TO authenticated
  USING (
    current_staff_role() IN ('admin', 'secretary')
    OR (current_staff_role() = 'instructor' AND instructor_id = auth.uid())
  );

-- -----------------------------------------------------------------
-- 3. blocked_days
--    No tenía RLS activada en ninguna migración anterior. Mismo
--    reparto que Calendario/Cuadrante: admin todos, instructor solo
--    los suyos, secretaría sin acceso (nunca tuvo estas pantallas).
-- -----------------------------------------------------------------
ALTER TABLE blocked_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocked_days_auth_scoped" ON blocked_days
  FOR ALL TO authenticated
  USING (
    current_staff_role() = 'admin'
    OR (current_staff_role() = 'instructor' AND instructor_id = auth.uid())
  )
  WITH CHECK (
    current_staff_role() = 'admin'
    OR (current_staff_role() = 'instructor' AND instructor_id = auth.uid())
  );

-- -----------------------------------------------------------------
-- 4. blocked_slots
--    Sustituye la política "authenticated -> true" (FOR ALL) de la
--    migración 20260610_security.sql. Las políticas anon existentes
--    (lectura para la página de reserva del alumno) no se tocan.
-- -----------------------------------------------------------------
DROP POLICY IF EXISTS "blocked_slots_auth_all" ON blocked_slots;

CREATE POLICY "blocked_slots_auth_scoped" ON blocked_slots
  FOR ALL TO authenticated
  USING (
    current_staff_role() = 'admin'
    OR (current_staff_role() = 'instructor' AND instructor_id = auth.uid())
  )
  WITH CHECK (
    current_staff_role() = 'admin'
    OR (current_staff_role() = 'instructor' AND instructor_id = auth.uid())
  );

-- -----------------------------------------------------------------
-- 5. exams
--    No tenía RLS activada — estado abierto/desconocido. El
--    instructor solo ve/edita exámenes de alumnos que tiene
--    asignados (join contra students.instructor_id); secretaría sin
--    acceso, admin acceso completo.
-- -----------------------------------------------------------------
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exams_auth_scoped" ON exams
  FOR ALL TO authenticated
  USING (
    current_staff_role() = 'admin'
    OR (
      current_staff_role() = 'instructor'
      AND EXISTS (
        SELECT 1 FROM students
        WHERE students.id = exams.student_id
          AND students.instructor_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    current_staff_role() = 'admin'
    OR (
      current_staff_role() = 'instructor'
      AND EXISTS (
        SELECT 1 FROM students
        WHERE students.id = exams.student_id
          AND students.instructor_id = auth.uid()
      )
    )
  );

-- -----------------------------------------------------------------
-- 6. payments
--    No tenía RLS activada — estado abierto/desconocido. Decisión
--    de producto confirmada: el instructor NO tiene acceso alguno a
--    datos de pagos/deudas, ni de sus propios alumnos. admin y
--    secretaría conservan acceso completo.
-- -----------------------------------------------------------------
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_auth_scoped" ON payments
  FOR ALL TO authenticated
  USING (current_staff_role() IN ('admin', 'secretary'))
  WITH CHECK (current_staff_role() IN ('admin', 'secretary'));

-- -----------------------------------------------------------------
-- 7. rates
--    No tenía RLS activada — estado abierto/desconocido. Mismo
--    reparto que payments: instructor bloqueado por completo.
-- -----------------------------------------------------------------
ALTER TABLE rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rates_auth_scoped" ON rates
  FOR ALL TO authenticated
  USING (current_staff_role() IN ('admin', 'secretary'))
  WITH CHECK (current_staff_role() IN ('admin', 'secretary'));

-- -----------------------------------------------------------------
-- NOTA: las rutas /api/* de este proyecto usan el cliente
-- service_role (que hace bypass de RLS por diseño), así que estas
-- políticas no cambian el comportamiento de la aplicación cuando
-- pasa por sus propias rutas — solo cierran el acceso directo
-- anon-key + JWT de sesión que existía hasta ahora. Cualquier
-- pantalla que TODAVÍA lea Supabase desde el cliente del navegador
-- con el rol `authenticated` (fuera de los 6 dominios cubiertos en
-- esta ronda: alumnos, calendario, cuadrante, examenes, pagos,
-- alertas) debe revisarse contra esta matriz antes de aplicar esta
-- migración, para no romper flujos legítimos por accidente.
-- =================================================================
