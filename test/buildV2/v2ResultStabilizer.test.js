import test from 'node:test';
import assert from 'node:assert/strict';
import { stabilizeV2Result } from '../../src/features/buildV2/v2ResultStabilizer.js';
import { validateV2Result } from '../../src/features/buildV2/v2Validation.js';

const pick = id => ({ id, reason: `Razón ${id}` });
const coreItems = Array.from({ length: 6 }, (_, index) => ({
  id: `i${index + 1}`,
  name: `Objeto ${index + 1}`,
  category: 'Mejorado',
  type: ['Daño Físico'],
  active: true,
  description: 'Aporta daño.',
}));
coreItems[0].name = 'Filo del Infinito';
coreItems[0].situational_role = ['late'];
const movement = { id: 'boots', name: 'Botas', category: 'Mejorado', type: ['Movimiento'], active: true };
const runes = [
  { id: 'key', name: 'Clave', branch: 'Clave', group: 1, description: 'Potencia el combate.' },
  { id: 'p1', name: 'P1', branch: 'Precisión', group: 1, description: 'Daño sostenido.' },
  { id: 'p2', name: 'P2', branch: 'Precisión', group: 2, description: 'Daño sostenido.' },
  { id: 'p3', name: 'P3', branch: 'Precisión', group: 3, description: 'Daño sostenido.' },
  { id: 'v1', name: 'V1', branch: 'Valor', group: 1, description: 'Defensa.' },
  { id: 'v2', name: 'V2', branch: 'Valor', group: 2, description: 'Defensa.' },
  { id: 'v3', name: 'V3', branch: 'Valor', group: 3, description: 'Defensa.' },
];
const spells = [
  { id: 'flash', name: 'Destello', description: 'Movilidad.' },
  { id: 'heal', name: 'Curación', description: 'Restaura vida.' },
  { id: 'smite', name: 'Castigo', description: 'Daño a monstruos.' },
];
const snapshot = {
  coreItems,
  movementItems: [movement],
  items: [...coreItems, movement],
  runes,
  spells,
};
const candidate = () => ({
  build_theme: 'Crítico sostenido',
  matchup_read: 'Lectura del enfrentamiento.',
  win_condition: 'Mantener daño sostenido.',
  composition_analysis: {
    allied_damage_profile: 'Daño mixto.',
    enemy_priority_threats: ['Amenaza A', 'Amenaza B'],
    required_responses: ['Posicionamiento'],
    archetype_rationale: 'El arquetipo encaja.',
  },
  build_plan: {
    primary_archetype: 'Crítico',
    target_damage_profile: 'Físico',
    first_item_rationale: 'Primer pico temprano.',
    transformation_audit: 'Sin transformaciones.',
    item_relationships: ['A con B', 'B con C', 'C con D'],
  },
  core_items: [pick('i1'), pick('i1'), pick('i2'), pick('i3'), pick('i4')],
  movement_item: pick('boots'),
  keystone: pick('key'),
  primary_runes: [pick('p1'), pick('v2'), pick('p3')],
  secondary_rune: pick('p2'),
  spells: [pick('flash'), pick('flash')],
  key_adaptations: ['Adaptación A', 'Adaptación B'],
});

test('corrige ramas, secundaria, objetos y hechizos antes de validar', () => {
  const stabilized = stabilizeV2Result(candidate(), snapshot, { role: 'adc' });
  assert.deepEqual(stabilized.primary_runes.map(rune => rune.id), ['p1', 'p2', 'p3']);
  assert.equal(stabilized.secondary_rune.id, 'v2');
  assert.equal(new Set(stabilized.core_items.map(item => item.id)).size, 5);
  assert.equal(stabilized.core_items.findIndex(item => item.id === 'i1'), 2);
  assert.match(stabilized.build_plan.first_item_rationale, /Filo del Infinito se reserva para el slot/);
  assert.equal(new Set(stabilized.spells.map(spell => spell.id)).size, 2);
  assert.equal(validateV2Result(stabilized, snapshot, { role: 'adc' }).ok, true);
});

test('agrega Castigo únicamente para jungla', () => {
  const stabilized = stabilizeV2Result(candidate(), snapshot, { role: 'jungler' });
  assert.equal(stabilized.spells.some(spell => spell.id === 'smite'), true);
  assert.equal(validateV2Result(stabilized, snapshot, { role: 'jungler' }).ok, true);
});
