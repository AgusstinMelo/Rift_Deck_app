-- Revierte 202611200023_rune_counters_new_signals.sql: saca los counters agregados.

update public.runes set counters = array_remove(counters, 'squishies')
where name in ('Electrocutar', 'Cosecha Oscura', 'Tirano', 'Golpe de Gracia', 'Ataque en Cadena', 'Impacto Súbito');

update public.runes set counters = array_remove(counters, 'luchadores')
where name in ('Coraza Ósea', 'Conquistador', 'Agarre del Perpetuo', 'Último Bastión', 'Segundo Aire');

update public.runes set counters = array_remove(counters, 'engage')
where name in ('Inquebrantable', 'Valor del Coloso', 'Guardián', 'Soberano del Hielo', 'Perseverancia');

update public.runes set counters = array_remove(counters, 'pick')
where name in ('Orbe de Anulación', 'Capa del Nimbo', 'Celeridad');

comment on column public.runes.counters is 'Contra qué responde (cualquiera de): poke, desgaste, burst, asesinos, divers, cc, curacion, escudos, tanques, kiteo, daño_magico, daño_fisico (solo sirve contra ese tipo de daño).';
comment on column public.spells.counters is 'Contra qué responde (cualquiera de): poke, desgaste, burst, asesinos, divers, cc, curacion, escudos, tanques, kiteo, daño_magico, daño_fisico (solo sirve contra ese tipo de daño).';
