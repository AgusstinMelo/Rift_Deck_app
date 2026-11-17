-- Perfil público opcional (/p/<nombre>): gratis, apagado por defecto, solo con el link.
--
-- profiles.public_profile: el usuario lo prende desde Perfil.
-- profiles.public_slug: el nombre del link, elegido por el usuario (minúsculas, números y
--   guiones, de 3 a 24 caracteres). Único entre todos los perfiles.
--
-- Los datos se leen solo con get_public_profile(): devuelve agregados (récord por tipo de
-- partida, campeón y línea) y las builds marcadas como públicas. Nunca el email, el nombre
-- completo ni las partidas una por una. Si el perfil no es público, devuelve null.

alter table public.profiles
  add column if not exists public_profile boolean not null default false,
  add column if not exists public_slug text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_public_slug_format') then
    alter table public.profiles
      add constraint profiles_public_slug_format
      check (public_slug is null or public_slug ~ '^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$');
  end if;
end
$$;

create unique index if not exists profiles_public_slug_key on public.profiles (public_slug);

create or replace function public.get_public_profile(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with owner as (
    select id, public_slug, nullif(trim(visible_name), '') as visible_name, avatar_url
    from public.profiles
    where public_profile
      and public_slug = lower(trim(p_slug))
  ),
  stats as (
    select coalesce(m.type, 'ranked') as type,
           m.own_champion_name as champion,
           nullif(m.lane, '') as lane,
           count(*) as games,
           count(*) filter (where m.result = 'win') as wins
    from public.matches m
    join owner o on m.user_id = o.id
    where m.result in ('win', 'loss')
    group by 1, 2, 3
  ),
  -- Solo los campos de la build que se muestran (nunca user_id ni created_by, que es el
  -- email). Se leen del JSON de la fila: si alguna columna no existe, queda en null.
  public_builds as (
    select jsonb_build_object(
             'id', r->'id', 'name', r->'name', 'champion_name', r->'champion_name',
             'champion_id', r->'champion_id', 'lane', r->'lane', 'patch', r->'patch',
             'items', r->'items', 'additional_runes', r->'additional_runes', 'spells', r->'spells'
           ) as build,
           b.created_at
    from public.builds b
    join owner o on b.user_id = o.id
    cross join lateral (select to_jsonb(b) as r) row_json
    where b.is_public
    order by b.created_at desc
    limit 50
  )
  select case when o.id is null then null else jsonb_build_object(
    'slug', o.public_slug,
    'name', coalesce(o.visible_name, o.public_slug),
    'avatar_url', o.avatar_url,
    'stats', coalesce((select jsonb_agg(to_jsonb(s)) from stats s), '[]'::jsonb),
    'builds', coalesce((select jsonb_agg(b.build order by b.created_at desc) from public_builds b), '[]'::jsonb)
  ) end
  from (select 1) as one
  left join owner o on true;
$$;

revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;
