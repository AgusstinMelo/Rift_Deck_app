import { z } from 'zod';

const selectedEntitySchema = z.object({
  id: z.string().trim().min(1),
  reason: z.string().trim().min(1),
}).strict();

export const v2BuildSchema = z.object({
  build_theme: z.string().trim().min(1),
  matchup_read: z.string().trim().min(1),
  win_condition: z.string().trim().min(1),
  composition_analysis: z.object({
    allied_damage_profile: z.string().trim().min(1),
    enemy_priority_threats: z.array(z.string().trim().min(1)).min(2).max(5),
    required_responses: z.array(z.string().trim().min(1)).min(1).max(5),
    archetype_rationale: z.string().trim().min(1),
  }).strict(),
  build_plan: z.object({
    primary_archetype: z.string().trim().min(1),
    target_damage_profile: z.string().trim().min(1),
    first_item_rationale: z.string().trim().min(1),
    transformation_audit: z.string().trim().min(1),
    item_relationships: z.array(z.string().trim().min(1)).min(3).max(6),
  }).strict(),  core_items: z.array(selectedEntitySchema).length(5),
  movement_item: selectedEntitySchema,
  keystone: selectedEntitySchema,
  primary_runes: z.array(selectedEntitySchema).length(3),
  secondary_rune: selectedEntitySchema,
  spells: z.array(selectedEntitySchema).length(2),
  key_adaptations: z.array(z.string().trim().min(1)).min(2).max(4),
}).strict();

const entitySelectionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'reason'],
  properties: {
    id: { type: 'string' },
    reason: { type: 'string' },
  },
};

export const v2BuildJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'build_theme', 'matchup_read', 'win_condition', 'composition_analysis', 'build_plan', 'core_items',
    'movement_item', 'keystone', 'primary_runes', 'secondary_rune',
    'spells', 'key_adaptations',
  ],
  properties: {
    build_theme: { type: 'string' },
    matchup_read: { type: 'string' },
    win_condition: { type: 'string' },
    composition_analysis: {
      type: 'object',
      additionalProperties: false,
      required: ['allied_damage_profile', 'enemy_priority_threats', 'required_responses', 'archetype_rationale'],
      properties: {
        allied_damage_profile: { type: 'string' },
        enemy_priority_threats: { type: 'array', minItems: 2, maxItems: 5, items: { type: 'string' } },
        required_responses: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string' } },
        archetype_rationale: { type: 'string' },
      },
    },
    build_plan: {
      type: 'object',
      additionalProperties: false,
      required: ['primary_archetype', 'target_damage_profile', 'first_item_rationale', 'transformation_audit', 'item_relationships'],
      properties: {
        primary_archetype: { type: 'string' },
        target_damage_profile: { type: 'string' },
        first_item_rationale: { type: 'string' },
        transformation_audit: { type: 'string' },
        item_relationships: { type: 'array', minItems: 3, maxItems: 6, items: { type: 'string' } },
      },
    },    core_items: { type: 'array', minItems: 5, maxItems: 5, items: entitySelectionJsonSchema },
    movement_item: entitySelectionJsonSchema,
    keystone: entitySelectionJsonSchema,
    primary_runes: { type: 'array', minItems: 3, maxItems: 3, items: entitySelectionJsonSchema },
    secondary_rune: entitySelectionJsonSchema,
    spells: { type: 'array', minItems: 2, maxItems: 2, items: entitySelectionJsonSchema },
    key_adaptations: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string' } },
  },
};


function selectionSchema(ids) {
  return {
    ...entitySelectionJsonSchema,
    properties: {
      ...entitySelectionJsonSchema.properties,
      id: { type: 'string', enum: ids.map(String) },
    },
  };
}

export function createV2BuildJsonSchema(snapshot) {
  const keystoneIds = snapshot.runes.filter(rune => rune.branch === 'Clave').map(rune => rune.id);
  const regularRunes = snapshot.runes.filter(rune => rune.branch !== 'Clave');
  const regularRuneIds = regularRunes.map(rune => rune.id);
  const branches = [...new Set(regularRunes.map(rune => rune.branch))];
  const branchRules = branches.map(branch => {
    const inBranch = regularRunes.filter(rune => rune.branch === branch);
    const groupIds = [1, 2, 3].map(group => inBranch.filter(rune => Number(rune.group) === group).map(rune => rune.id));
    const secondaryIds = regularRunes.filter(rune => rune.branch !== branch).map(rune => rune.id);
    return {
      type: 'object',
      properties: {
        primary_runes: {
          type: 'array',
          minItems: 3,
          maxItems: 3,
          prefixItems: groupIds.map(ids => selectionSchema(ids)),
        },
        secondary_rune: selectionSchema(secondaryIds),
      },
    };
  });

  return {
    ...v2BuildJsonSchema,
    properties: {
      ...v2BuildJsonSchema.properties,
      core_items: { ...v2BuildJsonSchema.properties.core_items, items: selectionSchema(snapshot.coreItems.map(item => item.id)) },
      movement_item: selectionSchema(snapshot.movementItems.map(item => item.id)),
      keystone: selectionSchema(keystoneIds),
      primary_runes: { ...v2BuildJsonSchema.properties.primary_runes, items: selectionSchema(regularRuneIds) },
      secondary_rune: selectionSchema(regularRuneIds),
      spells: { ...v2BuildJsonSchema.properties.spells, items: selectionSchema(snapshot.spells.map(spell => spell.id)) },
    },
    anyOf: branchRules,
  };
}