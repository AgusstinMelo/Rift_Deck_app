-- Rollback de 202610170001_goals_operator_and_new_metrics.sql
-- Falla si existen objetivos con las métricas nuevas: archivalos o eliminalos antes.

alter table public.personal_goals drop constraint if exists personal_goals_cumulative_operator_chk;
alter table public.personal_goals drop constraint if exists personal_goals_operator_chk;

alter table public.personal_goals drop constraint if exists personal_goals_metric_check;
alter table public.personal_goals add constraint personal_goals_metric_check check (metric in (
  'partidas_registradas', 'winrate', 'promedio_muertes', 'porcentaje_campeones', 'manual'));

alter table public.personal_goals drop constraint if exists personal_goals_sample_chk;
alter table public.personal_goals add constraint personal_goals_sample_chk check (
  (metric in ('winrate', 'promedio_muertes', 'porcentaje_campeones')) = (min_sample is not null));

-- Restaurar el trigger sin la columna operator antes de eliminarla.
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

alter table public.personal_goals drop column if exists operator;
