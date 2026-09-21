-- Restore rune tags exposed by current_runes after the patch 7.3 view rebuild.
-- Tags live in the per-patch JSON snapshot rather than in the base runes row type.

drop view if exists public.current_runes;

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