-- Rollback de 202611200021_match_champion_names.sql: vuelve a los nombres guardados antes.
update public.matches m
set own_champion_name = b.own_champion_name,
    enemy_champion_name = b.enemy_champion_name,
    ally_champions = b.ally_champions,
    enemy_champions = b.enemy_champions
from public.backup_match_champion_names_0021 b
where b.id = m.id;
drop table public.backup_match_champion_names_0021;
