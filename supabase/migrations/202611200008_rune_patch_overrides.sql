-- Los datos del parche ganan sobre la tabla base (current_runes usa
-- jsonb_populate_record), incluso cuando el valor del parche es null.
--
-- 1) Leyenda: Aceleración tenía trigger_tags y benefit_tags en null en el parche, lo que
--    tapaba los tags cargados en la base. Se borran las claves null de todos los parches.
-- 2) Demolición: la descripción del parche 7.3f quedó con el texto anterior al cambio a
--    "tercer ataque contra una torreta" (30 seg de enfriamiento) que está en la base.

update public.rune_patch_data
set data = data - 'trigger_tags'
where data ? 'trigger_tags' and data -> 'trigger_tags' = 'null'::jsonb;

update public.rune_patch_data
set data = data - 'benefit_tags'
where data ? 'benefit_tags' and data -> 'benefit_tags' = 'null'::jsonb;

update public.rune_patch_data d
set data = jsonb_set(d.data, '{description}', to_jsonb(r.description))
from public.runes r
where d.rune_id = r.id::text
  and r.id::text = '6a04bc5f681bf773dac12aa9'
  and d.patch_id = 11;
