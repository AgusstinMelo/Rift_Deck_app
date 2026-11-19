-- counters suma luchadores, squishies, engage y pick (lista cerrada en src/features/coach/taxonomy.js;
-- Build V2 detecta las cuatro señales en v2DraftProfile.js). Cada runa conserva sus counters
-- actuales y suma el nuevo. Es una columna de la tabla base (el parche activo no la tiene).

update public.runes set counters = array_append(coalesce(counters, '{}'), 'squishies')
where name in ('Electrocutar', 'Cosecha Oscura', 'Tirano', 'Golpe de Gracia', 'Ataque en Cadena', 'Impacto Súbito') and not ('squishies' = any(coalesce(counters, '{}')));

update public.runes set counters = array_append(coalesce(counters, '{}'), 'luchadores')
where name in ('Coraza Ósea', 'Conquistador', 'Agarre del Perpetuo', 'Último Bastión', 'Segundo Aire') and not ('luchadores' = any(coalesce(counters, '{}')));

update public.runes set counters = array_append(coalesce(counters, '{}'), 'engage')
where name in ('Inquebrantable', 'Valor del Coloso', 'Guardián', 'Soberano del Hielo', 'Perseverancia') and not ('engage' = any(coalesce(counters, '{}')));

update public.runes set counters = array_append(coalesce(counters, '{}'), 'pick')
where name in ('Orbe de Anulación', 'Capa del Nimbo', 'Celeridad') and not ('pick' = any(coalesce(counters, '{}')));

comment on column public.runes.counters is 'Contra qué responde (cualquiera de): poke, desgaste, burst, asesinos, divers, luchadores, squishies, engage, pick, cc, curacion, escudos, tanques, kiteo, daño_magico, daño_fisico (solo sirve contra ese tipo de daño).';
comment on column public.spells.counters is 'Contra qué responde (cualquiera de): poke, desgaste, burst, asesinos, divers, luchadores, squishies, engage, pick, cc, curacion, escudos, tanques, kiteo, daño_magico, daño_fisico (solo sirve contra ese tipo de daño).';
