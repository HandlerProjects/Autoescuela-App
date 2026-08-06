-- Horarios especiales por día.
--
-- El horario de `instructors` es fijo: mañana, tarde y un único descanso para toda la jornada.
-- Sirve para la rutina, pero no admite las variaciones de un día concreto (ampliar o recortar la
-- jornada, acortar los descansos en temporada alta, o concentrar el descanso en un momento dado).
--
-- Se modela como capa de excepciones sobre el horario base, no como sustitución:
--   hay fila para ese profesor y esa fecha → rige la fila.
--   no la hay                             → rige el horario de `instructors`, sin cambio alguno.
--
-- `sessions` es una lista de franjas en vez de mañana/tarde porque el generador de huecos
-- (lib/utils.ts → generateTimeSlots) ya admite cualquier número de tramos. De ahí sale también el
-- descanso largo: no se configura, es el intervalo entre el fin de una franja y el inicio de la
-- siguiente. `break_minutes` es el descanso corto entre prácticas DENTRO de cada franja.

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
