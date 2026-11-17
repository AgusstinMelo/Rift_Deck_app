-- Perfil público v2: la página pasa a ser visual (pool de campeones, radar por línea,
-- matchups y sinergias por campeón y últimas partidas). Las builds dejan de mostrarse.
--
-- get_public_profile() devuelve, solo si el perfil es público:
--   stats:     récord por tipo de partida, campeón y línea.
--   matchups:  récord por tipo, campeón propio y rival directo (enemy_champion_name).
--   synergies: récord por tipo, campeón propio y aliado (ally_champions).
--   recent:    las últimas 12 partidas (campeón, línea, rival, resultado, K/D/A, fecha).
-- Nunca el email, el nombre completo, notas ni capturas.
--
-- ally_champions se lee del JSON de la fila: funciona sea text[] o jsonb.

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
  games as (
    select coalesce(m.type, 'ranked') as type,
           nullif(trim(m.own_champion_name), '') as champion,
           nullif(m.lane, '') as lane,
           nullif(trim(m.enemy_champion_name), '') as opponent,
           m.result,
           m.kills, m.deaths, m.assists,
           m.date, m.created_at,
           to_jsonb(m)->'ally_champions' as allies
    from public.matches m
    join owner o on m.user_id = o.id
    where m.result in ('win', 'loss')
  ),
  stats as (
    select type, champion, lane, count(*) as games, count(*) filter (where result = 'win') as wins
    from games
    group by 1, 2, 3
  ),
  matchups as (
    select type, champion, opponent, count(*) as games, count(*) filter (where result = 'win') as wins
    from games
    where champion is not null and opponent is not null and lower(opponent) <> lower(champion)
    group by 1, 2, 3
  ),
  synergies as (
    select g.type, g.champion, trim(ally.name) as ally, count(*) as games, count(*) filter (where g.result = 'win') as wins
    from games g
    cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(g.allies) = 'array' then g.allies else '[]'::jsonb end
    ) as ally(name)
    where g.champion is not null and trim(ally.name) <> '' and lower(trim(ally.name)) <> lower(g.champion)
    group by 1, 2, 3
  ),
  recent as (
    select type, champion, lane, opponent, result, kills, deaths, assists, date
    from games
    order by date desc nulls last, created_at desc nulls last
    limit 12
  )
  select case when o.id is null then null else jsonb_build_object(
    'slug', o.public_slug,
    'name', coalesce(o.visible_name, o.public_slug),
    'avatar_url', o.avatar_url,
    'stats', coalesce((select jsonb_agg(to_jsonb(s)) from stats s), '[]'::jsonb),
    'matchups', coalesce((select jsonb_agg(to_jsonb(x)) from matchups x), '[]'::jsonb),
    'synergies', coalesce((select jsonb_agg(to_jsonb(x)) from synergies x), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(to_jsonb(r)) from recent r), '[]'::jsonb)
  ) end
  from (select 1) as one
  left join owner o on true;
$$;

revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;
