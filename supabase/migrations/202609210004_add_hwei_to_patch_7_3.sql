-- Add Hwei to the draft 7.3 champion snapshot.
-- The champion was created after the patch snapshot, so it was not copied automatically.

do $$
declare
  target_patch_id bigint;
  target_champion_id text;
begin
  select id into target_patch_id
  from public.game_patches
  where version = '7.3' and status = 'draft';

  if target_patch_id is null then
    raise exception 'Draft patch 7.3 does not exist';
  end if;

  select id::text into target_champion_id
  from public.champions
  where lower(name) = 'hwei';

  if target_champion_id is null then
    raise exception 'Champion Hwei does not exist';
  end if;

  insert into public.champion_patch_stats (champion_id, patch_id, data)
  select
    c.id::text,
    target_patch_id,
    (
      to_jsonb(c)
      - array[
          'id', 'name', 'image_url', 'image_url_card', 'external_id', 'original_name',
          'physic_vamp', 'magic_vamp'
        ]
    ) || jsonb_build_object(
      'lifesteal', greatest(
        coalesce(nullif(to_jsonb(c) ->> 'physic_vamp', '')::numeric, 0),
        coalesce(nullif(to_jsonb(c) ->> 'magic_vamp', '')::numeric, 0)
      )
    )
  from public.champions c
  where c.id::text = target_champion_id
  on conflict (champion_id, patch_id) do nothing;
end
$$;