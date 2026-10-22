-- Rollback de 202610220001_add_tierlist_patch_averages.sql
-- Los snapshots diarios (tierlist_entries / tierlist_executions) se conservan.

select cron.unschedule('update-tierlist-daily')
where exists (select 1 from cron.job where jobname = 'update-tierlist-daily');

drop table if exists public.tierlist_patch_averages;
drop table if exists public.tierlist_patch_groups;

drop index if exists public.tierlist_entries_patch_group_idx;
drop index if exists public.tierlist_executions_patch_group_idx;

alter table public.tierlist_entries drop column if exists patch_group;
alter table public.tierlist_executions drop column if exists patch_group;

drop function if exists public.tierlist_patch_group(text);
