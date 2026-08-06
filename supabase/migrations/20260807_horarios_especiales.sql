-- Horarios especiales por día.
--
-- El horario del profesor (tabla `instructors`) es fijo: mañana, tarde y un único descanso igual
-- para todo el día. Eso cubre la rutina, pero no la realidad del día a día de la autoescuela:
--
--   · "Mañana tengo un asunto familiar, entro a las 8 y salgo a las 20 para compensar."
--   · "Son las fiestas de Palencia, hay saturación: el descanso de 15 min lo hacemos de 5."
--   · "Hoy encadeno 7:30–9:00 sin parar y a las 9 me tomo media hora de café."
--
-- Se resuelve con una CAPA DE EXCEPCIONES, no cambiando el horario base:
--   ¿hay fila para ese profesor y ese día? → manda ella.
--   ¿no la hay?                           → el horario de siempre, exactamente como hasta ahora.
--
-- Mientras nadie cree una excepción el comportamiento es idéntico al actual, que es justo lo que
-- se pedía: no romper algo que funciona para poder cambiarlo un día suelto.
--
-- `sessions` es una LISTA de franjas, no mañana/tarde, porque el generador de huecos
-- (lib/utils.ts → generateTimeSlots) ya admite cualquier número de tramos. El tercer ejemplo sale
-- solo de ahí: el descanso largo no se configura, es el hueco entre una franja y la siguiente.

create table if not exists public.schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructors(id) on delete cascade,
  date date not null,
  -- [{"start":"07:30","end":"09:00"}, {"start":"09:30","end":"11:00"}]
  sessions jsonb not null,
  -- null → se mantiene el descanso habitual del profesor
  break_minutes integer,
  reason text,
  created_at timestamptz not null default now(),
  unique (instructor_id, date)
);

comment on table public.schedule_overrides is
  'Horario excepcional de un profesor para un día concreto. Si no hay fila, rige el horario base de la tabla instructors.';
comment on column public.schedule_overrides.sessions is
  'Lista de franjas de trabajo [{"start":"HH:MM","end":"HH:MM"}]. El tiempo entre franjas es descanso.';
comment on column public.schedule_overrides.break_minutes is
  'Descanso entre prácticas dentro de cada franja. NULL = el habitual del profesor.';

create index if not exists schedule_overrides_instructor_date_idx
  on public.schedule_overrides (instructor_id, date);

-- Solo se accede desde rutas de servidor con service role, que ya comprueban rol y propiedad
-- (un profesor solo toca su propio horario; admin y secretaría, el de cualquiera). Sin políticas,
-- ningún cliente con anon key puede leerla ni escribirla.
alter table public.schedule_overrides enable row level security;
