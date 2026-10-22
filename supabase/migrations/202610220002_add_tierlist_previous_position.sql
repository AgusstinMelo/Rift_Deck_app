-- Posición en la línea que tenía el campeón en el promedio del día anterior
-- (mismo grupo de parche). Se usa para la variación de la tierlist.
-- Después de aplicarla, recalcular los promedios con {"rebuild_averages": "all"}.

alter table public.tierlist_patch_averages
  add column if not exists previous_position_in_lane integer;
