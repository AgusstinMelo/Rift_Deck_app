-- Objetivos: dirección configurable de la meta y nuevas métricas
-- (victorias, KDA, asesinatos, asistencias, oro y duración promedio).

-- 1. Dirección de la meta: 'gte' (al menos) o 'lte' (como máximo).
alter table public.personal_goals add column if not exists operator text;

update public.personal_goals
set operator = case when metric = 'promedio_muertes' then 'lte' else 'gte' end
where operator is null;

alter table public.personal_goals
  alter column operator set default 'gte',
  alter column operator set not null;

alter table public.personal_goals
  add constraint personal_goals_operator_chk check (operator in ('gte', 'lte'));

-- 2. Métricas permitidas.
alter table public.personal_goals drop constraint if exists personal_goals_metric_check;
alter table public.personal_goals add constraint personal_goals_metric_check check (metric in (
  'partidas_registradas', 'victorias',
  'promedio_muertes', 'promedio_kda', 'promedio_asesinatos', 'promedio_asistencias', 'promedio_oro', 'promedio_duracion',
  'winrate', 'porcentaje_campeones',
  'manual'
));

-- 3. Las métricas de rendimiento exigen muestra mínima; las acumulativas no.
alter table public.personal_goals drop constraint if exists personal_goals_sample_chk;
alter table public.personal_goals add constraint personal_goals_sample_chk check (
  (metric not in ('partidas_registradas', 'victorias', 'manual')) = (min_sample is not null));

-- 4. Las acumulativas solo pueden crecer: su meta siempre es "al menos".
alter table public.personal_goals add constraint personal_goals_cumulative_operator_chk check (
  metric not in ('partidas_registradas', 'victorias', 'manual') or operator = 'gte');

-- 5. Cambiar la dirección es reconfigurar el objetivo: mismas reglas que el target.
create or replace function public.personal_goals_enforce_edit_rules() returns trigger
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
    or new.operator is distinct from old.operator
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
