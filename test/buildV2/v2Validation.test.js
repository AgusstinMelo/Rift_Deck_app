import test from 'node:test';
import assert from 'node:assert/strict';
import { validateV2Result } from '../../src/features/buildV2/v2Validation.js';
import { createV2BuildJsonSchema } from '../../src/features/buildV2/v2Schema.js';

const core = n => ({
  id: `i${n}`,
  name: `Core ${n}`,
  category: 'Mejorado',
  type: ['DaÃ±o Fisico'],
  active: true,
});
const movement = { id: 'boot', name: 'Boot', category: 'Mejorado', type: ['Movimiento'], active: true };
const component = { id: 'part', name: 'Part', category: 'Nivel Medio', type: ['DaÃ±o Fisico'], active: true };
const basicBoot = { id: 'basic-boot', name: 'Basic boot', category: 'Nivel Medio', type: ['Movimiento'], active: true };
const runes = [
  { id: 'key', name: 'Key', branch: 'Clave', group: 1 },
  { id: 'p1', name: 'P1', branch: 'PrecisiÃ³n', group: 1 },
  { id: 'p2', name: 'P2', branch: 'PrecisiÃ³n', group: 2 },
  { id: 'p3', name: 'P3', branch: 'PrecisiÃ³n', group: 3 },
  { id: 'p2b', name: 'P2b', branch: 'PrecisiÃ³n', group: 2 },
  { id: 'other', name: 'Other', branch: 'Valor', group: 2 },
];
const spells = [{ id: 'flash', name: 'Destello' }, { id: 'exhaust', name: 'ExtenuaciÃ³n' }, { id: 'smite', name: 'Castigo' }];
const snapshot = { items: [1,2,3,4,5,6].map(core).concat(movement, component, basicBoot), runes, spells };
const pick = id => ({ id, reason: `RazÃ³n ${id}` });
const valid = () => ({
  build_theme: 'DPS sostenido', matchup_read: 'Lectura.', win_condition: 'CondiciÃ³n.',
  composition_analysis: { allied_damage_profile: 'Mixto.', enemy_priority_threats: ['A', 'B'], required_responses: ['C'], archetype_rationale: 'D' },
  build_plan: { primary_archetype: 'CrÃ­tico', target_damage_profile: 'FÃ­sico', first_item_rationale: 'Valor inmediato', transformation_audit: 'Sin conversiones', item_relationships: ['A-B', 'B-C', 'C-D'] },
  core_items: [1,2,3,4,5].map(n => pick(`i${n}`)), movement_item: pick('boot'),
  keystone: pick('key'), primary_runes: ['p1','p2','p3'].map(pick), secondary_rune: pick('other'),
  spells: ['flash','exhaust'].map(pick), key_adaptations: ['A', 'B'],
});
const check = (mutate = x => x, context) => validateV2Result(mutate(valid()), snapshot, context);

test('acepta el contrato completo', () => assert.equal(check().ok, true));
test('rechaza 4 core items', () => assert.equal(check(x => ({ ...x, core_items: x.core_items.slice(0, 4) })).ok, false));
test('rechaza 6 core items', () => assert.equal(check(x => ({ ...x, core_items: [...x.core_items, pick('i6')] })).ok, false));
test('rechaza core duplicado', () => assert.equal(check(x => ({ ...x, core_items: [...x.core_items.slice(0, 4), pick('i1')] })).ok, false));
test('rechaza core inexistente', () => assert.equal(check(x => ({ ...x, core_items: [pick('missing'), ...x.core_items.slice(1)] })).ok, false));
test('rechaza componente como core', () => assert.equal(check(x => ({ ...x, core_items: [pick('part'), ...x.core_items.slice(1)] })).ok, false));
test('rechaza movement dentro de core', () => assert.equal(check(x => ({ ...x, core_items: [pick('boot'), ...x.core_items.slice(1)] })).ok, false));
test('rechaza movement inexistente', () => assert.equal(check(x => ({ ...x, movement_item: pick('missing') })).ok, false));
test('rechaza movement de tier intermedio', () => assert.equal(check(x => ({ ...x, movement_item: pick('basic-boot') })).ok, false));
test('rechaza keystone que no clave', () => assert.equal(check(x => ({ ...x, keystone: pick('p1') })).ok, false));
test('rechaza menos de 3 primarias', () => assert.equal(check(x => ({ ...x, primary_runes: x.primary_runes.slice(0, 2) })).ok, false));
test('rechaza primarias de ramas distintas', () => assert.equal(check(x => ({ ...x, primary_runes: [pick('p1'), pick('p2'), pick('other')] })).ok, false));
test('rechaza grupos primarios repetidos', () => assert.equal(check(x => ({ ...x, primary_runes: [pick('p1'), pick('p2'), pick('p2b')] })).ok, false));
test('rechaza secundaria de la rama principal', () => assert.equal(check(x => ({ ...x, secondary_rune: pick('p2b') })).ok, false));
test('rechaza runas inexistentes', () => assert.equal(check(x => ({ ...x, secondary_rune: pick('missing') })).ok, false));
test('rechaza hechizos duplicados', () => assert.equal(check(x => ({ ...x, spells: [pick('flash'), pick('flash')] })).ok, false));
test('rechaza hechizo inexistente', () => assert.equal(check(x => ({ ...x, spells: [pick('flash'), pick('missing')] })).ok, false));
test('jungler requiere Castigo', () => assert.equal(check(x => x, { role: 'jungler' }).ok, false));
test('jungler acepta Castigo', () => assert.equal(check(x => ({ ...x, spells: [pick('flash'), pick('smite')] }), { role: 'jungler' }).ok, true));
test('rechaza textos requeridos vacÃ­os', () => assert.equal(check(x => ({ ...x, build_theme: '' })).ok, false));
test('la razÃ³n queda unida a su ID', () => assert.equal(check().data.core_items[0].reason, 'RazÃ³n i1'));
test('ninguna entidad ajena al snapshot pasa', () => assert.equal(check(x => ({ ...x, core_items: [pick('inventado'), ...x.core_items.slice(1)] })).ok, false));


test('el schema limita IDs a su catÃ¡logo estructural', () => {
  const schema = createV2BuildJsonSchema({
    coreItems: snapshot.items.filter(item => item.id.startsWith('i')),
    movementItems: [movement],
    runes,
    spells,
  });
  assert.deepEqual(schema.properties.core_items.items.properties.id.enum, ['i1', 'i2', 'i3', 'i4', 'i5', 'i6']);
  assert.deepEqual(schema.properties.movement_item.properties.id.enum, ['boot']);
  assert.deepEqual(schema.properties.keystone.properties.id.enum, ['key']);
  assert.equal(schema.properties.keystone.properties.id.enum.includes('p1'), false);
  assert.equal(schema.properties.spells.items.properties.id.enum.includes('missing'), false);
  assert.equal(schema.anyOf.length, 2);
  const precisionRule = schema.anyOf.find(rule => rule.properties.primary_runes.prefixItems[0].properties.id.enum.includes('p1'));
  assert.deepEqual(precisionRule.properties.primary_runes.prefixItems.map(item => item.properties.id.enum), [['p1'], ['p2', 'p2b'], ['p3']]);
  assert.deepEqual(precisionRule.properties.secondary_rune.properties.id.enum, ['other']);
});
test('rechaza una build sin auditorÃ­a de coherencia', () => {
  const candidate = valid();
  delete candidate.build_plan;
  assert.equal(validateV2Result(candidate, snapshot).ok, false);
});
