-- Rollback de 202611160002_coach_history_and_team_kills.sql
-- Borra el historial del Coach y las kills de equipo cargadas en las partidas.

drop table if exists public.coach_insight_log;

alter table public.matches drop constraint if exists matches_team_kills_chk;
alter table public.matches drop column if exists team_kills;
alter table public.matches drop column if exists enemy_team_kills;
