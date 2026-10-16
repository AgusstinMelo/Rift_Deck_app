-- Objetivos personales: definición de metas y check-ins manuales.
--
-- Solo se persiste el ciclo de vida (activo / cancelado / archivado). El resultado
-- (programado, en curso, alcanzado, no alcanzado, no concluyente) se deriva siempre
-- en el cliente a partir de las partidas y los check-ins; nunca se guarda.

-- 1. Partidas: un K/D/A vacío pasa a guardarse como null (dato ausente) en lugar de 0.
--    Es un no-op si las columnas ya admiten null.
alter table public.matches alter column kills drop not null;
alter table public.matches alter column deaths drop not null;
alter table public.matches alter column assists drop not null;

-- 2. Objetivos
create table public.personal_goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 80),
  description   text check (description is null or char_length(description) <= 500),
  metric        text not null check (metric in (
                  'partidas_registradas', 'winrate', 'promedio_muertes', 'porcentaje_campeones', 'manual')),
  target        numeric(10,2) not null check (target > 0 and target <= 100000),
  min_sample    integer check (min_sample is null or min_sample between 1 and 500),
  unit          text check (unit is null or char_length(btrim(unit)) between 1 and 40),
  filters       jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object'),
  period_start  timestamptz not null,
  period_end    timestamptz not null,
  timezone      text not null check (char_length(timezone) between 1 and 64),
  lifecycle     text not null default 'activo' check (lifecycle in ('activo', 'cancelado', 'archivado')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint personal_goals_period_chk check (period_end > period_start),
  constraint personal_goals_period_len_chk check (period_end - period_start <= interval '367 days'),
  constraint personal_goals_pct_target_chk check (
    metric not in ('winrate', 'porcentaje_campeones') or target <= 100),
  constraint personal_goals_sample_chk check (
    (metric in ('winrate', 'promedio_muertes', 'porcentaje_campeones')) = (min_sample is not null)),
  constraint personal_goals_unit_chk check ((metric = 'manual') = (unit is not null)),
  constraint personal_goals_manual_filters_chk check (metric <> 'manual' or filters = '{}'::jsonb),
  constraint personal_goals_id_user_uq unique (id, user_id)
);

create index personal_goals_user_lifecycle_idx on public.personal_goals (user_id, lifecycle);
create index personal_goals_user_period_end_idx on public.personal_goals (user_id, period_end desc);

-- 3. Check-ins de objetivos manuales
create table public.personal_goal_checkins (
  id            uuid primary key default gen_random_uuid(),
  goal_id       uuid not null,
  user_id       uuid not null default auth.uid(),
  amount        numeric(10,2) not null check (amount > 0 and amount <= 100000),
  checkin_date  date not null,
  note          text check (note is null or char_length(note) <= 500),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- La FK compuesta impide asociar un check-in a un objetivo de otro usuario.
  constraint personal_goal_checkins_goal_fk foreign key (goal_id, user_id)
    references public.personal_goals (id, user_id) on delete cascade
);

create index personal_goal_checkins_goal_date_idx on public.personal_goal_checkins (goal_id, checkin_date);
create index personal_goal_checkins_user_idx on public.personal_goal_checkins (user_id);

-- 4. Triggers
create function public.personal_goals_touch_updated_at() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Valida la zona horaria (at time zone falla si el nombre IANA no existe).
create function public.personal_goals_validate_timezone() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
begin
  perform now() at time zone new.timezone;
  return new;
exception when others then
  raise exception 'Zona horaria inválida: %', new.timezone using errcode = '22023';
end;
$$;

-- Reglas de edición, como defensa adicional a la validación del cliente.
create function public.personal_goals_enforce_edit_rules() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
declare
  config_changed boolean;
  period_closed boolean := old.period_end <= now();
begin
  if new.user_id <> old.user_id or new.created_at <> old.created_at then
    raise exception 'No se puede cambiar el dueño ni la fecha de creación' using errcode = '42501';
  end if;

  if new.metric <> old.metric then
    raise exception 'La métrica de un objetivo no se puede editar' using errcode = '22023';
  end if;

  config_changed := new.target is distinct from old.target
    or new.min_sample is distinct from old.min_sample
    or new.unit is distinct from old.unit
    or new.filters is distinct from old.filters
    or new.period_start is distinct from old.period_start
    or new.period_end is distinct from old.period_end
    or new.timezone is distinct from old.timezone;

  if config_changed then
    if old.lifecycle <> 'activo' or period_closed then
      raise exception 'Solo se puede reconfigurar un objetivo activo con el período abierto' using errcode = '22023';
    end if;
    if new.period_end <= now() then
      raise exception 'La fecha final no puede quedar en el pasado' using errcode = '22023';
    end if;
  end if;

  if new.lifecycle <> old.lifecycle then
    if not (
      (old.lifecycle = 'activo' and new.lifecycle = 'cancelado' and not period_closed)
      or (old.lifecycle in ('activo', 'cancelado') and new.lifecycle = 'archivado')
    ) then
      raise exception 'Transición de ciclo de vida no permitida: % → %', old.lifecycle, new.lifecycle
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

create function public.personal_goal_checkins_validate() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
declare
  g public.personal_goals%rowtype;
begin
  if tg_op = 'UPDATE' and (new.goal_id <> old.goal_id or new.user_id <> old.user_id) then
    raise exception 'Un check-in no se puede mover a otro objetivo' using errcode = '22023';
  end if;

  -- Corre con los permisos del usuario: un objetivo ajeno no es visible por RLS.
  select * into g from public.personal_goals where id = new.goal_id;
  if not found then
    raise exception 'Objetivo inexistente' using errcode = '42501';
  end if;
  if g.metric <> 'manual' then
    raise exception 'Solo los objetivos manuales admiten check-ins' using errcode = '22023';
  end if;

  if new.checkin_date < (g.period_start at time zone g.timezone)::date
     or new.checkin_date > (g.period_end at time zone g.timezone)::date then
    raise exception 'La fecha del check-in está fuera del período del objetivo' using errcode = '22023';
  end if;

  if new.checkin_date > (now() at time zone g.timezone)::date then
    raise exception 'La fecha del check-in no puede ser futura' using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger personal_goals_validate_timezone
  before insert or update of timezone on public.personal_goals
  for each row execute function public.personal_goals_validate_timezone();

create trigger personal_goals_enforce_edit_rules
  before update on public.personal_goals
  for each row execute function public.personal_goals_enforce_edit_rules();

create trigger personal_goals_touch_updated_at
  before update on public.personal_goals
  for each row execute function public.personal_goals_touch_updated_at();

create trigger personal_goal_checkins_validate
  before insert or update on public.personal_goal_checkins
  for each row execute function public.personal_goal_checkins_validate();

create trigger personal_goal_checkins_touch_updated_at
  before update on public.personal_goal_checkins
  for each row execute function public.personal_goals_touch_updated_at();

-- 5. RLS: cada usuario solo accede a sus propios objetivos y check-ins.
alter table public.personal_goals enable row level security;
alter table public.personal_goal_checkins enable row level security;

revoke all on public.personal_goals from anon;
revoke all on public.personal_goal_checkins from anon;
grant select, insert, update, delete on public.personal_goals to authenticated;
grant select, insert, update, delete on public.personal_goal_checkins to authenticated;

create policy personal_goals_select_own on public.personal_goals
  for select to authenticated using (user_id = (select auth.uid()));
create policy personal_goals_insert_own on public.personal_goals
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy personal_goals_update_own on public.personal_goals
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy personal_goals_delete_own on public.personal_goals
  for delete to authenticated using (user_id = (select auth.uid()));

create policy personal_goal_checkins_select_own on public.personal_goal_checkins
  for select to authenticated using (user_id = (select auth.uid()));
create policy personal_goal_checkins_insert_own on public.personal_goal_checkins
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.personal_goals g
      where g.id = goal_id and g.user_id = (select auth.uid())
    )
  );
create policy personal_goal_checkins_update_own on public.personal_goal_checkins
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.personal_goals g
      where g.id = goal_id and g.user_id = (select auth.uid())
    )
  );
create policy personal_goal_checkins_delete_own on public.personal_goal_checkins
  for delete to authenticated using (user_id = (select auth.uid()));
