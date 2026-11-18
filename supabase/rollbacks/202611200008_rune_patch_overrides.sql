-- Rollback de 202611200008_rune_patch_overrides.sql

update public.rune_patch_data
set data = data || '{"trigger_tags": null, "benefit_tags": null}'::jsonb
where patch_id = 11 and rune_id = '44e9f76c-5a0b-4446-953a-db6a1f3fdb75';

update public.rune_patch_data
set data = jsonb_set(data, '{description}', to_jsonb($rd$Después de golpear una torreta con 3 ataques básicos, los campeones cuerpo a cuerpo infligen 85 + 28% de Vida Máxima como daño físico adicional, mientras que los campeones a distancia infligen 50 + 20% de Vida Máxima como daño físico adicional.$rd$::text))
where patch_id = 11 and rune_id = '6a04bc5f681bf773dac12aa9';
