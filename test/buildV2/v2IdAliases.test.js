// IDs cortos para Gemini: el prompt y el schema usan I1, M1, R1, S1 y la respuesta se
// traduce de vuelta a los IDs reales.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createIdAliases } from '../../src/features/buildV2/v2IdAliases.js';
import { createV2BuildJsonSchema } from '../../src/features/buildV2/v2Schema.js';
import { buildV2Prompt } from '../../src/features/buildV2/v2PromptBuilder.js';
import { validateV2Result } from '../../src/features/buildV2/v2Validation.js';

const long = n => `6a04bc1334f787bb5bb2e0${String(n).padStart(2, '0')}`;
const snapshot = {
  patchVersion: '7.3f',
  champions: [{ id: 'champ-uuid', name: 'Jinx', roles: ['Tirador'] }],
  items: [],
  coreItems: [1, 2, 3, 4, 5, 6].map(n => ({ id: long(n), name: `Objeto ${n}`, category: 'Mejorado', type: ['Daño Fisico'] })),
  movementItems: [{ id: long(50), name: 'Botas', category: 'Mejorado', type: ['Movimiento'] }],
  runes: [
    { id: long(60), name: 'Clave', branch: 'Clave', group: 1 },
    ...[1, 2, 3].map(group => ({ id: long(60 + group), name: `P${group}`, branch: 'Precisión', group })),
    { id: long(70), name: 'Secundaria', branch: 'Valor', group: 1 },
  ],
  spells: [{ id: long(80), name: 'Destello' }, { id: long(81), name: 'Curación' }, { id: long(82), name: 'Castigo' }],
};
snapshot.items = [...snapshot.coreItems, ...snapshot.movementItems, { id: 'componente', name: 'Espada Larga', category: 'Básico' }];

const answer = {
  build_theme: 't', matchup_read: 't', win_condition: 't',
  composition_analysis: { allied_damage_profile: 't', enemy_priority_threats: ['a', 'b'], required_responses: ['a'], archetype_rationale: 't' },
  build_plan: { primary_archetype: 't', target_damage_profile: 't', first_item_rationale: 't', transformation_audit: 't' },
  key_adaptations: ['a', 'b'],
  core_items: ['I1', 'I2', 'I3', 'I4', 'I5'].map(id => ({ id, reason: 'r' })),
  movement_item: { id: 'M1', reason: 'r' },
  keystone: { id: 'R1', reason: 'r' },
  primary_runes: ['R2', 'R3', 'R4'].map(id => ({ id, reason: 'r' })),
  secondary_rune: { id: 'R5', reason: 'r' },
  spells: [{ id: 'S1', reason: 'r' }, { id: 'S2', reason: 'r' }],
};

test('el prompt y el schema usan IDs cortos; los campeones no cambian', () => {
  const { snapshot: aliased } = createIdAliases(snapshot);
  const schema = JSON.stringify(createV2BuildJsonSchema(aliased, { role: 'adc' }));
  assert.ok(schema.includes('"I1"') && schema.includes('"R5"') && schema.includes('"S2"'));
  assert.ok(!schema.includes(long(1)));
  const prompt = buildV2Prompt({ snapshot: aliased, championId: 'champ-uuid', role: 'adc', allies: { adc: 'champ-uuid' }, enemies: {} });
  assert.ok(!prompt.includes('6a04bc'));
  assert.equal(aliased.champions[0].id, 'champ-uuid');
  // El componente que no se puede elegir conserva su ID.
  assert.equal(aliased.items.at(-1).id, 'componente');
  // Castigo se sigue reconociendo por nombre.
  assert.ok(schema.includes('"S1"') && !JSON.stringify(createV2BuildJsonSchema(aliased, { role: 'adc' }).properties.spells).includes('"S3"'));
});

test('la respuesta vuelve con los IDs reales y valida contra el snapshot real', () => {
  const aliases = createIdAliases(snapshot);
  assert.equal(validateV2Result(answer, aliases.snapshot, { role: 'adc' }).ok, true);
  const restored = aliases.restore(answer);
  assert.deepEqual(restored.core_items.map(item => item.id), [1, 2, 3, 4, 5].map(long));
  assert.equal(restored.movement_item.id, long(50));
  assert.equal(restored.keystone.id, long(60));
  assert.equal(restored.secondary_rune.id, long(70));
  assert.deepEqual(restored.spells.map(spell => spell.id), [long(80), long(81)]);
  assert.equal(validateV2Result(restored, snapshot, { role: 'adc' }).ok, true);
});

test('un ID inventado por la IA queda como vino y la validación lo rechaza', () => {
  const aliases = createIdAliases(snapshot);
  const restored = aliases.restore({ ...answer, keystone: { id: 'R99', reason: 'r' } });
  assert.equal(restored.keystone.id, 'R99');
  assert.equal(validateV2Result(restored, snapshot, { role: 'adc' }).ok, false);
});
