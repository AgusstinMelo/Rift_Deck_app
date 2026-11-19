-- Nombres de campeones mal guardados en partidas: "Yunara\n" (el catálogo tuvo un salto de
-- línea en el nombre) y "Shivana" (en el catálogo: Shyvana). La tarjeta de partida y el
-- Coach buscan por nombre exacto y no los encontraban: se veía la inicial y el Coach no
-- reconocía al campeón. Se limpian espacios y saltos de línea en los extremos y se corrige
-- la escritura. Copia de las filas tocadas en backup_match_champion_names_0021 (para el rollback).

create or replace function pg_temp.fix_champion_name(value text) returns text language sql immutable as $$
  select case when cleaned = 'Shivana' then 'Shyvana' else cleaned end
  from (select regexp_replace(value, '^\s+|\s+$', '', 'g') as cleaned) as t
$$;

create or replace function pg_temp.fix_champion_list(value jsonb) returns jsonb language sql immutable as $$
  select case when jsonb_typeof(value) <> 'array' then value
    else coalesce((select jsonb_agg(case when jsonb_typeof(element) = 'string' then to_jsonb(pg_temp.fix_champion_name(element #>> '{}')) else element end order by ord)
      from jsonb_array_elements(value) with ordinality as e(element, ord)), '[]'::jsonb) end
$$;

create table public.backup_match_champion_names_0021 as
select id, own_champion_name, enemy_champion_name, ally_champions, enemy_champions
from public.matches
where own_champion_name is distinct from pg_temp.fix_champion_name(own_champion_name)
   or enemy_champion_name is distinct from pg_temp.fix_champion_name(enemy_champion_name)
   or ally_champions is distinct from pg_temp.fix_champion_list(ally_champions)
   or enemy_champions is distinct from pg_temp.fix_champion_list(enemy_champions);

-- Copia privada: sin políticas, la API no la expone.
alter table public.backup_match_champion_names_0021 enable row level security;

update public.matches m
set own_champion_name = pg_temp.fix_champion_name(m.own_champion_name),
    enemy_champion_name = pg_temp.fix_champion_name(m.enemy_champion_name),
    ally_champions = pg_temp.fix_champion_list(m.ally_champions),
    enemy_champions = pg_temp.fix_champion_list(m.enemy_champions)
from public.backup_match_champion_names_0021 b
where b.id = m.id;
