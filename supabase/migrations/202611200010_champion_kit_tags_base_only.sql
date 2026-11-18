-- traits, vulnerabilities e item_scalings describen el kit del campeón y se cargan a mano
-- en la tabla champions, igual para todos. Sylas y Hwei eran los únicos que los tenían
-- también en los datos del parche (con los mismos valores que la base), y ahí tapaban
-- cualquier edición hecha en la base. Se borran del parche y el trigger de
-- sincronización deja de copiarlos.

update public.champion_patch_stats
set data = data - array['traits', 'vulnerabilities', 'item_scalings']
where data ?| array['traits', 'vulnerabilities', 'item_scalings'];

create or replace function public.catalog_sync_excluded_columns()
returns text[] language sql immutable as $$
  select array[
    'id', 'created_at', 'created_date', 'created_by_id', 'updated_at', 'updated_date', 'is_sample',
    'counters', 'fits_classes', 'fits_lanes', 'team_roles',
    'score_engage', 'score_peel', 'score_disengage', 'score_mobility', 'score_burst',
    'score_sustained_damage', 'score_range', 'score_self_sustain', 'score_waveclear',
    'traits', 'vulnerabilities', 'item_scalings',
    'tags', 'recommended_champions', 'recommended_champion', 'recommended_items', 'active'
  ]::text[]
$$;
