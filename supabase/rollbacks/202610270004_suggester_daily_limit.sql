-- Rollback de 202610270004_suggester_daily_limit.sql

drop function if exists public.get_my_suggester_usage();
drop function if exists public.refund_suggester_run(uuid, text, uuid);
drop function if exists public.consume_suggester_run(uuid, text, uuid);
drop function if exists public.suggester_daily_limit(uuid);
drop function if exists public.suggester_today();
drop table if exists public.suggester_usage;
