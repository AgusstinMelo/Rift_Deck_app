-- Read-only catalog access for recording matches and builds from published patches.
create or replace function public.get_game_patch_catalog(p_version text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  selected_patch public.game_patches%rowtype;
begin
  select * into selected_patch
  from public.game_patches
  where lower(version) = lower(btrim(p_version))
    and status in ('active', 'archived');

  if selected_patch.id is null then
    raise exception 'Published patch does not exist: %', p_version;
  end if;

  return jsonb_build_object(
    'patchId', selected_patch.id,
    'patchVersion', selected_patch.version,
    'champions', coalesce((
      select jsonb_agg(to_jsonb(c) || d.data || jsonb_build_object(
        'patch_id', selected_patch.id,
        'patch_version', selected_patch.version,
        'lifesteal', nullif(d.data ->> 'lifesteal', '')::numeric
      ) order by c.name)
      from public.champions c
      join public.champion_patch_stats d
        on d.patch_id = selected_patch.id and d.champion_id = c.id::text
      where coalesce((d.data ->> 'active')::boolean, true)
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) || d.data || jsonb_build_object(
        'patch_id', selected_patch.id,
        'patch_version', selected_patch.version,
        'lifesteal', nullif(d.data ->> 'lifesteal', '')::numeric
      ) order by i.name)
      from public.wr_items i
      join public.item_patch_data d
        on d.patch_id = selected_patch.id and d.item_id = i.id::text
      where i.active is not false
        and coalesce((d.data ->> 'active')::boolean, true)
    ), '[]'::jsonb),
    'runes', coalesce((
      select jsonb_agg(to_jsonb(r) || d.data || jsonb_build_object(
        'patch_id', selected_patch.id,
        'patch_version', selected_patch.version,
        'lifesteal', nullif(d.data ->> 'lifesteal', '')::numeric,
        'active', coalesce((d.data ->> 'active')::boolean, true)
      ) order by r.branch, r.group, r.name)
      from public.runes r
      join public.rune_patch_data d
        on d.patch_id = selected_patch.id and d.rune_id = r.id::text
      where coalesce((d.data ->> 'active')::boolean, true)
    ), '[]'::jsonb)
  );
end
$$;

revoke all on function public.get_game_patch_catalog(text) from public;
grant execute on function public.get_game_patch_catalog(text) to anon, authenticated;
