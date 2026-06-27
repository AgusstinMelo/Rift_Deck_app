-- Repairs installations where snapshot columns were added before legacy patch
-- labels (for example "7.1h 25-06-2026") were normalized.

with parsed as (
  select
    id,
    coalesce(
      nullif(trim(regexp_replace(patch, '\s+\d{2}-\d{2}-\d{4}\s*$', '')), ''),
      'unknown'
    ) as normalized_patch,
    case
      when patch ~ '\d{2}-\d{2}-\d{4}\s*$'
        then to_date(substring(patch from '(\d{2}-\d{2}-\d{4})\s*$'), 'DD-MM-YYYY')
      else coalesce(snapshot_date, executed_at::date, current_date)
    end as normalized_date
  from public.tierlist_executions
)
update public.tierlist_executions as execution
set
  patch = parsed.normalized_patch,
  snapshot_date = parsed.normalized_date,
  snapshot_key = lower(parsed.normalized_patch) || '::' || parsed.normalized_date::text
from parsed
where execution.id = parsed.id;

with parsed as (
  select
    id,
    coalesce(
      nullif(trim(regexp_replace(patch, '\s+\d{2}-\d{2}-\d{4}\s*$', '')), ''),
      'unknown'
    ) as normalized_patch,
    case
      when patch ~ '\d{2}-\d{2}-\d{4}\s*$'
        then to_date(substring(patch from '(\d{2}-\d{2}-\d{4})\s*$'), 'DD-MM-YYYY')
      else coalesce(snapshot_date, updated_at::date, current_date)
    end as normalized_date
  from public.tierlist_entries
)
update public.tierlist_entries as entry
set
  patch = parsed.normalized_patch,
  snapshot_date = parsed.normalized_date,
  snapshot_key = lower(parsed.normalized_patch) || '::' || parsed.normalized_date::text
from parsed
where entry.id = parsed.id;

-- If an entry snapshot still has no matching execution, associate it with the
-- closest execution of the same patch. updated_at/executed_at preserve which
-- daily capture originally produced the row.
with unmatched as (
  select
    entry.id,
    candidate.snapshot_date,
    candidate.snapshot_key
  from public.tierlist_entries as entry
  cross join lateral (
    select execution.snapshot_date, execution.snapshot_key
    from public.tierlist_executions as execution
    where lower(trim(execution.patch)) = lower(trim(entry.patch))
    order by abs(
      extract(epoch from (
        coalesce(entry.updated_at, entry.snapshot_date::timestamp) -
        coalesce(execution.executed_at, execution.snapshot_date::timestamp)
      ))
    ) asc
    limit 1
  ) as candidate
  where not exists (
    select 1
    from public.tierlist_executions as matching_execution
    where matching_execution.snapshot_key = entry.snapshot_key
  )
)
update public.tierlist_entries as entry
set
  snapshot_date = unmatched.snapshot_date,
  snapshot_key = unmatched.snapshot_key
from unmatched
where entry.id = unmatched.id;
