-- Rollback de 202610220002_add_tierlist_previous_position.sql

alter table public.tierlist_patch_averages
  drop column if exists previous_position_in_lane;
