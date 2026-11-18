-- counters suma daño_magico y daño_fisico (lista cerrada en src/features/coach/taxonomy.js):
-- una pieza que solo sirve contra un tipo de daño. Orbe de Anulación solo protege del daño
-- mágico; con burst/asesinos/divers parecía útil contra divers físicos (Irelia, Samira).
-- Es una columna de la tabla base (el parche activo no la tiene).

update public.runes set counters = array['daño_magico']
where id::text = '6a04bc5f681bf773dac12aa2';

comment on column public.runes.counters is 'Contra qué responde (cualquiera de): poke, desgaste, burst, asesinos, divers, cc, curacion, escudos, tanques, kiteo, daño_magico, daño_fisico (solo sirve contra ese tipo de daño).';
comment on column public.spells.counters is 'Contra qué responde (cualquiera de): poke, desgaste, burst, asesinos, divers, cc, curacion, escudos, tanques, kiteo, daño_magico, daño_fisico (solo sirve contra ese tipo de daño).';
