-- Recuperada del historial remoto (supabase_migrations.schema_migrations) el 16/11/2026:
-- se había aplicado en producción sin que el archivo llegara al repo.

-- Keep current_* contracts synchronized with semantic columns added to base tables.
-- Existing columns remain in their original order; new columns are appended so
-- CREATE OR REPLACE VIEW is safe for dependent objects and PostgREST clients.

create or replace view public.current_champions
with (security_invoker = true)
as
select
  m.id, m.external_id, m.name, m.original_name, m.image_url, m.image_url_card,
  m.lane, m.roles, m.difficulty, m.damage_type, m.scaling, m.strategic_notes,
  m.recommended_items, m.strong_against, m.weak_against, m.synergies, m.tags,
  m.life, m.mana, m.armor, m.magic_res, m.attack_damage, m.attack_speed,
  m.movement, m.attack_range, m.damage, m.survive, m.assist, m.created_at,
  m.updated_at, m.bonus_attack_speed, m.life_reg, m.mana_reg, m.physic_vamp,
  m.magic_vamp,
  p.id as patch_id,
  p.version as patch_version,
  m.traits,
  m.item_scalings,
  m.vulnerabilities
from public.champions c
join public.game_state s on s.id = 1
join public.game_patches p on p.id = s.active_patch_id
join public.champion_patch_stats d
  on d.patch_id = p.id and d.champion_id = c.id::text
cross join lateral jsonb_populate_record(c, d.data) as m;

create or replace view public.current_wr_items
with (security_invoker = true)
as
select
  m.id, m.name, m.image_url, m.category, m.type, m.description, m.tags, m.price,
  m.life, m.life_reg, m.mana, m.mana_reg, m.attack_damage, m.attack_speed,
  m.ability_power, m.armor, m.magic_res, m.flat_movement, m.percentage_movement,
  m.critical_impact, m.critical_damage, m.physic_vamp, m.magic_vamp,
  m.ability_haste, m.tenacity, m.healing_and_shield, m.adaptable_ad,
  m.adaptable_ap, m.created_at, m.updated_at, m.flat_armor_penetration,
  m.avoid_against, m.percentage_armor_penetration,
  m.percentage_magic_penetration, m.flat_magic_penetration, m.good_against,
  m.created_date, m.updated_date, m.created_by_id, m.active,
  p.id as patch_id,
  p.version as patch_version,
  m.effect_tags,
  m.situational_role
from public.wr_items i
join public.game_state s on s.id = 1
join public.game_patches p on p.id = s.active_patch_id
join public.item_patch_data d
  on d.patch_id = p.id and d.item_id = i.id::text
cross join lateral jsonb_populate_record(i, d.data) as m;

create or replace view public.current_runes
with (security_invoker = true)
as
select
  m.id, m.name, m.image_url, m.branch, m.group, m.description,
  m.benefit_tags as tags,
  m.created_at, m.updated_at, m.mana_reg, m.attack_damage, m.attack_speed,
  m.recommended_champions, m.life, m.flat_armor_penetration,
  m.percentage_movement, m.percentage_armor_penetration, m.critical_damage,
  m.percentage_magic_res, m.tenacity, m.percentage_magic_penetration,
  m.percentage_armor, m.life_reg, m.ability_power, m.ability_haste,
  m.critical_impact, m.playstyles, m.flat_magic_penetration, m.magic_res,
  m.physic_vamp, m.armor, m.mana, m.healing_and_shield, m.flat_movement,
  m.magic_vamp, m.created_date, m.updated_date, m.created_by_id, m.is_sample,
  p.id as patch_id,
  p.version as patch_version,
  m.benefit_tags,
  m.trigger_tags
from public.runes r
join public.game_state s on s.id = 1
join public.game_patches p on p.id = s.active_patch_id
join public.rune_patch_data d
  on d.patch_id = p.id and d.rune_id = r.id::text
cross join lateral jsonb_populate_record(r, d.data) as m;
