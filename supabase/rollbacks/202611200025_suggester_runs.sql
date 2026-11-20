-- Rollback de 202611200025_suggester_runs.sql.
drop view if exists public.suggester_runs_overview;
drop function if exists public.finish_suggester_run(text, uuid, text, text);
drop function if exists public.record_suggester_run(uuid, text, uuid, text, text, text, text, integer, jsonb);
drop table if exists public.suggester_runs;
