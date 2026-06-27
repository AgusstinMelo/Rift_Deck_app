-- Separates the game patch from the date of a tierlist capture.
-- A snapshot is identified by: lower(patch) + snapshot_date.

alter table public.tierlist_configs
  add column if not exists active_snapshot_date date;

alter table public.tierlist_executions
  add column if not exists snapshot_date date,
  add column if not exists snapshot_key text;

alter table public.tierlist_entries
  add column if not exists snapshot_date date,
  add column if not exists snapshot_key text;

update public.tierlist_configs
set active_snapshot_date = coalesce(active_snapshot_date, current_date);

alter table public.tierlist_configs
  alter column active_snapshot_date set default current_date;

-- Preserve and normalize labels previously stored as "7.1h 25-06-2026".
with parsed as (
  select
    id,
    case
      when patch ~ '\d{2}-\d{2}-\d{4}\s*$'
        then coalesce(nullif(trim(regexp_replace(patch, '\s+\d{2}-\d{2}-\d{4}\s*$', '')), ''), 'unknown')
      else coalesce(nullif(trim(patch), ''), 'unknown')
    end as normalized_patch,
    case
      when patch ~ '\d{2}-\d{2}-\d{4}\s*$'
        then to_date(substring(patch from '(\d{2}-\d{2}-\d{4})\s*$'), 'DD-MM-YYYY')
      else coalesce(executed_at::date, current_date)
    end as normalized_date
  from public.tierlist_executions
)
update public.tierlist_executions as execution
set
  patch = parsed.normalized_patch,
  snapshot_date = coalesce(execution.snapshot_date, parsed.normalized_date)
from parsed
where execution.id = parsed.id;

with parsed as (
  select
    id,
    case
      when patch ~ '\d{2}-\d{2}-\d{4}\s*$'
        then coalesce(nullif(trim(regexp_replace(patch, '\s+\d{2}-\d{2}-\d{4}\s*$', '')), ''), 'unknown')
      else coalesce(nullif(trim(patch), ''), 'unknown')
    end as normalized_patch,
    case
      when patch ~ '\d{2}-\d{2}-\d{4}\s*$'
        then to_date(substring(patch from '(\d{2}-\d{2}-\d{4})\s*$'), 'DD-MM-YYYY')
      else coalesce(updated_at::date, current_date)
    end as normalized_date
  from public.tierlist_entries
)
update public.tierlist_entries as entry
set
  patch = parsed.normalized_patch,
  snapshot_date = coalesce(entry.snapshot_date, parsed.normalized_date)
from parsed
where entry.id = parsed.id;

update public.tierlist_executions
set snapshot_date = coalesce(snapshot_date, executed_at::date, current_date);

update public.tierlist_entries
set snapshot_date = coalesce(snapshot_date, updated_at::date, current_date);

update public.tierlist_executions
set snapshot_key = lower(trim(patch)) || '::' || snapshot_date::text;

update public.tierlist_entries
set snapshot_key = lower(trim(patch)) || '::' || snapshot_date::text;

alter table public.tierlist_executions
  alter column snapshot_date set default current_date,
  alter column snapshot_date set not null,
  alter column snapshot_key set not null;

alter table public.tierlist_entries
  alter column snapshot_date set default current_date,
  alter column snapshot_date set not null,
  alter column snapshot_key set not null;

create index if not exists tierlist_executions_snapshot_key_idx
  on public.tierlist_executions (snapshot_key);

create index if not exists tierlist_entries_snapshot_key_idx
  on public.tierlist_entries (snapshot_key);

create index if not exists tierlist_entries_snapshot_lane_rank_idx
  on public.tierlist_entries (snapshot_key, lane, ranking_final desc);

comment on column public.tierlist_executions.snapshot_date is
  'Date represented by this tierlist snapshot; independent from executed_at.';

comment on column public.tierlist_entries.snapshot_date is
  'Date represented by this tierlist snapshot; independent from updated_at.';
