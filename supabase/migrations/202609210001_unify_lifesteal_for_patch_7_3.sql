-- Patch 7.3 replaces physic_vamp and magic_vamp with a single lifesteal stat.
-- Older snapshots retain both legacy keys so rollback remains lossless.

do $$
declare
  target_patch_id bigint;
begin
  select id into target_patch_id
  from public.game_patches
  where version = '7.3' and status = 'draft';

  if target_patch_id is null then
    raise exception 'Draft patch 7.3 does not exist';
  end if;

  update public.champion_patch_stats
  set data = (data - 'physic_vamp' - 'magic_vamp') || jsonb_build_object(
    'lifesteal', case
      when data ? 'lifesteal' then coalesce(nullif(data ->> 'lifesteal', '')::numeric, 0)
      else greatest(
        coalesce(nullif(data ->> 'physic_vamp', '')::numeric, 0),
        coalesce(nullif(data ->> 'magic_vamp', '')::numeric, 0)
      )
    end
  )
  where patch_id = target_patch_id;

  update public.item_patch_data
  set data = (data - 'physic_vamp' - 'magic_vamp') || jsonb_build_object(
    'lifesteal', case
      when data ? 'lifesteal' then coalesce(nullif(data ->> 'lifesteal', '')::numeric, 0)
      else greatest(
        coalesce(nullif(data ->> 'physic_vamp', '')::numeric, 0),
        coalesce(nullif(data ->> 'magic_vamp', '')::numeric, 0)
      )
    end
  )
  where patch_id = target_patch_id;

  update public.rune_patch_data
  set data = (data - 'physic_vamp' - 'magic_vamp') || jsonb_build_object(
    'lifesteal', case
      when data ? 'lifesteal' then coalesce(nullif(data ->> 'lifesteal', '')::numeric, 0)
      else greatest(
        coalesce(nullif(data ->> 'physic_vamp', '')::numeric, 0),
        coalesce(nullif(data ->> 'magic_vamp', '')::numeric, 0)
      )
    end
  )
  where patch_id = target_patch_id;
end
$$;

-- jsonb_populate_record(...).* follows the current base-table column order.
-- Recreate instead of replace so schema additions do not look like column renames.
drop view if exists public.current_champions;
drop view if exists public.current_wr_items;
drop view if exists public.current_runes;

create view public.current_champions with (security_invoker = true) as
select (jsonb_populate_record(c, d.data)).*, p.id as patch_id, p.version as patch_version,
  nullif(d.data ->> 'lifesteal', '')::numeric as lifesteal
from public.champions c
join public.game_state s on s.id = 1
join public.game_patches p on p.id = s.active_patch_id
join public.champion_patch_stats d on d.patch_id = p.id and d.champion_id = c.id::text;

create view public.current_wr_items with (security_invoker = true) as
select (jsonb_populate_record(i, d.data)).*, p.id as patch_id, p.version as patch_version,
  nullif(d.data ->> 'lifesteal', '')::numeric as lifesteal
from public.wr_items i
join public.game_state s on s.id = 1
join public.game_patches p on p.id = s.active_patch_id
join public.item_patch_data d on d.patch_id = p.id and d.item_id = i.id::text;

create view public.current_runes with (security_invoker = true) as
select (jsonb_populate_record(r, d.data)).*, p.id as patch_id, p.version as patch_version,
  nullif(d.data ->> 'lifesteal', '')::numeric as lifesteal
from public.runes r
join public.game_state s on s.id = 1
join public.game_patches p on p.id = s.active_patch_id
join public.rune_patch_data d on d.patch_id = p.id and d.rune_id = r.id::text;

grant select on public.current_champions, public.current_wr_items, public.current_runes
  to anon, authenticated;
