-- Rollback de 202611200004_coach_profile_columns.sql
-- Las vistas se recrean después de borrar las columnas para que no las expongan.
drop view if exists public.current_champions;
drop view if exists public.current_runes;

alter table public.champions
  drop column if exists team_roles,
  drop column if exists score_engage,
  drop column if exists score_peel,
  drop column if exists score_disengage,
  drop column if exists score_mobility,
  drop column if exists score_burst,
  drop column if exists score_sustained_damage,
  drop column if exists score_range,
  drop column if exists score_self_sustain,
  drop column if exists score_waveclear;

alter table public.runes
  drop column if exists fits_classes,
  drop column if exists counters;

alter table public.spells
  drop column if exists fits_classes,
  drop column if exists fits_lanes,
  drop column if exists counters;

create view public.current_champions with (security_invoker = true) as
select (jsonb_populate_record(c, d.data)).*, p.id as patch_id, p.version as patch_version,
  nullif(d.data ->> 'lifesteal', '')::numeric as lifesteal
from public.champions c
join public.game_state s on s.id = 1
join public.game_patches p on p.id = s.active_patch_id
join public.champion_patch_stats d on d.patch_id = p.id and d.champion_id = c.id::text;

grant select on public.current_champions to anon, authenticated;

create view public.current_runes with (security_invoker = true) as
select
  (jsonb_populate_record(r, d.data)).*,
  p.id as patch_id,
  p.version as patch_version,
  nullif(d.data ->> 'lifesteal', '')::numeric as lifesteal,
  coalesce(d.data -> 'tags', '[]'::jsonb) as tags,
  coalesce((d.data ->> 'active')::boolean, true) as active
from public.runes r
join public.game_state s on s.id = 1
join public.game_patches p on p.id = s.active_patch_id
join public.rune_patch_data d on d.patch_id = p.id and d.rune_id = r.id::text
where coalesce((d.data ->> 'active')::boolean, true);

grant select on public.current_runes to anon, authenticated;
