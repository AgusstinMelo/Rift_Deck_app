-- Rollback de 202610270002_goals_free_limit.sql

drop trigger if exists personal_goals_enforce_free_limit on public.personal_goals;
drop function if exists public.personal_goals_enforce_free_limit();
drop function if exists public.personal_goals_open_limit(uuid);
