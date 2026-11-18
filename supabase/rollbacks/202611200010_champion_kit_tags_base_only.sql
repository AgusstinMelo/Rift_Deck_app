-- Rollback de 202611200010_champion_kit_tags_base_only.sql
-- Devuelve los tags de Sylas y Hwei al parche 11 (eran iguales a los de la base) y la
-- lista de exclusiones anterior.

update public.champion_patch_stats d
set data = d.data || jsonb_build_object(
  'traits', to_jsonb(c.traits),
  'vulnerabilities', to_jsonb(c.vulnerabilities),
  'item_scalings', to_jsonb(c.item_scalings))
from public.champions c
where d.champion_id = c.id::text
  and d.patch_id = 11
  and c.id::text in ('41a128bb-05ae-4d59-9681-5712ead836c9', '354db545-88ba-4521-ba5b-5005febd0bef');

create or replace function public.catalog_sync_excluded_columns()
returns text[] language sql immutable as $$
  select array[
    'id', 'created_at', 'created_date', 'created_by_id', 'updated_at', 'updated_date', 'is_sample',
    'counters', 'fits_classes', 'fits_lanes', 'team_roles',
    'score_engage', 'score_peel', 'score_disengage', 'score_mobility', 'score_burst',
    'score_sustained_damage', 'score_range', 'score_self_sustain', 'score_waveclear',
    'tags', 'recommended_champions', 'recommended_champion', 'recommended_items', 'active'
  ]::text[]
$$;
