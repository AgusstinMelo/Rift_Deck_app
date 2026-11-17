-- Perfil público v3: el banner suma KDA promedio, mejor racha del parche y winrate por
-- lado del mapa. get_public_profile() agrega a lo de la v2:
--   stats[].kda_sum: suma del KDA de cada partida (misma fórmula que Estadísticas: sin
--     muertes, K + A; si no, (K + A) / D; un dato sin cargar cuenta como 0). El promedio
--     es kda_sum / games.
--   sides:  récord por tipo de partida y lado del mapa (blue / red).
--   patch:  el parche más reciente con partidas (7.3 incluye 7.3, 7.3b, 7.3f...).
--   patch_results: los resultados de ese parche en orden (tipo y win / loss), para
--     calcular la mejor racha con los tipos de partida elegidos.

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
           nullif(m.side, '') as side,
           substring(m.patch from '^[0-9]+\.[0-9]+') as patch_group,
           m.result,
           m.kills, m.deaths, m.assists,
           case
             when coalesce(m.deaths, 0) = 0 then coalesce(m.kills, 0) + coalesce(m.assists, 0)
             else (coalesce(m.kills, 0) + coalesce(m.assists, 0))::numeric / m.deaths
           end as kda,
           m.date, m.created_at,
           to_jsonb(m)->'ally_champions' as allies
    from public.matches m
    join owner o on m.user_id = o.id
    where m.result in ('win', 'loss')
  ),
  stats as (
    select type, champion, lane, count(*) as games, count(*) filter (where result = 'win') as wins,
           round(sum(kda), 4) as kda_sum
    from games
    group by 1, 2, 3
  ),
  sides as (
    select type, side, count(*) as games, count(*) filter (where result = 'win') as wins
    from games
    where side in ('blue', 'red')
    group by 1, 2
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
  ),
  -- Parche más reciente con partidas (por la fecha de la última partida).
  last_patch as (
    select patch_group
    from games
    where patch_group is not null
    order by date desc nulls last, created_at desc nulls last
    limit 1
  ),
  patch_results as (
    select g.type, g.result
    from games g
    join last_patch p on g.patch_group = p.patch_group
    order by g.date asc nulls first, g.created_at asc nulls first
  )
  select case when o.id is null then null else jsonb_build_object(
    'slug', o.public_slug,
    'name', coalesce(o.visible_name, o.public_slug),
    'avatar_url', o.avatar_url,
    'stats', coalesce((select jsonb_agg(to_jsonb(s)) from stats s), '[]'::jsonb),
    'sides', coalesce((select jsonb_agg(to_jsonb(x)) from sides x), '[]'::jsonb),
    'matchups', coalesce((select jsonb_agg(to_jsonb(x)) from matchups x), '[]'::jsonb),
    'synergies', coalesce((select jsonb_agg(to_jsonb(x)) from synergies x), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(to_jsonb(r)) from recent r), '[]'::jsonb),
    'patch', (select patch_group from last_patch),
    'patch_results', coalesce((select jsonb_agg(jsonb_build_object('type', type, 'result', result)) from patch_results), '[]'::jsonb)
  ) end
  from (select 1) as one
  left join owner o on true;
$$;

revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;
