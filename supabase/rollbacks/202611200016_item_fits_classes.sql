-- Rollback de 202611200016_item_fits_classes.sql
drop view if exists public.current_wr_items;
alter table public.wr_items drop column if exists fits_classes;

create view public.current_wr_items with (security_invoker = true) as
select (jsonb_populate_record(i, d.data)).*, p.id as patch_id, p.version as patch_version,
  nullif(d.data ->> 'lifesteal', '')::numeric as lifesteal
from public.wr_items i
join public.game_state s on s.id = 1
join public.game_patches p on p.id = s.active_patch_id
join public.item_patch_data d on d.patch_id = p.id and d.item_id = i.id::text;

grant select on public.current_wr_items to anon, authenticated;
