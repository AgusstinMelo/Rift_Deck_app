-- Rollback de 202611170002_matches_build_id.sql
-- Borra el vínculo entre partidas y builds guardadas (las partidas y las builds quedan).

drop index if exists public.matches_build_id_idx;
alter table public.matches drop column if exists build_id;
