-- Splash en alta resolución de cada campeón (para la tarjeta compartible y futuras
-- pantallas). Las imágenes viven en Storage (riftdeck-assets/champions_splash/) y se cargan
-- con scripts/upload-champion-splashes.mjs.

alter table public.champions add column if not exists image_url_splash text;

-- current_champions usa (jsonb_populate_record(c, d.data)).*: las columnas quedan fijas al
-- crear la vista. Se recrea (igual que en 202609210001) para que exponga la columna nueva.
-- get_game_patch_catalog usa to_jsonb(c) y la incluye sola.
drop view if exists public.current_champions;

create view public.current_champions with (security_invoker = true) as
select (jsonb_populate_record(c, d.data)).*, p.id as patch_id, p.version as patch_version,
  nullif(d.data ->> 'lifesteal', '')::numeric as lifesteal
from public.champions c
join public.game_state s on s.id = 1
join public.game_patches p on p.id = s.active_patch_id
join public.champion_patch_stats d on d.patch_id = p.id and d.champion_id = c.id::text;

grant select on public.current_champions to anon, authenticated;
