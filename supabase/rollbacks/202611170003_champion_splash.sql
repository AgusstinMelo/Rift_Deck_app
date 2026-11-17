-- Rollback de 202611170003_champion_splash.sql
-- Quita la columna y recrea current_champions sin ella. Las imágenes de Storage
-- (riftdeck-assets/champions_splash/) no se borran: se eliminan a mano si hace falta.

drop view if exists public.current_champions;

alter table public.champions drop column if exists image_url_splash;

create view public.current_champions with (security_invoker = true) as
select (jsonb_populate_record(c, d.data)).*, p.id as patch_id, p.version as patch_version,
  nullif(d.data ->> 'lifesteal', '')::numeric as lifesteal
from public.champions c
join public.game_state s on s.id = 1
join public.game_patches p on p.id = s.active_patch_id
join public.champion_patch_stats d on d.patch_id = p.id and d.champion_id = c.id::text;

grant select on public.current_champions to anon, authenticated;
