-- Rollback de 202611200012_team_roles_pick.sql
comment on column public.champions.team_roles is 'Rol en la pelea (uno o más): frontline, iniciador, diver (se tira a la línea de atrás), protector, poke, daño_sostenido, split (se divide).';
