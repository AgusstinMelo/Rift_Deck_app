-- Rollback de 202611200013_counters_damage_type.sql
update public.runes set counters = array['burst']
where id::text = '6a04bc5f681bf773dac12aa2';

comment on column public.runes.counters is 'Contra qué responde: poke, desgaste, burst, asesinos, divers, cc, curacion, escudos, tanques, kiteo.';
comment on column public.spells.counters is 'Contra qué responde: poke, desgaste, burst, asesinos, divers, cc, curacion, escudos, tanques, kiteo.';
