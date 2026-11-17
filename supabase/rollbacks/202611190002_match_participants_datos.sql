-- Rollback de 202611190002_match_participants_datos.sql
alter table public.match_participants
  drop column if exists damage_dealt,
  drop column if exists damage_taken,
  drop column if exists healing_shielding,
  drop column if exists teamfight_participation;
