// Reglas del juego sobre objetos: evoluciones que no se compran, un solo objeto de Lágrima
// de la Diosa y, en Support, el objeto de soporte inicial en el slot 1. Caso real: una
// build de Kai'Sa support con Manamune y Muramaná, y sin Guadaña ni Baluarte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { itemRulesFor } from '../../src/features/buildV2/v2ItemRules.js';
import { createEligibleV2Snapshot } from '../../src/features/buildV2/v2Eligibility.js';
import { auditCoreItems } from '../../src/features/buildV2/v2BuildAudit.js';
import { draftFitContext } from '../../src/features/buildV2/v2DraftProfile.js';
import { validateV2Result } from '../../src/features/buildV2/v2Validation.js';

const item = (id, name, fields = {}) => ({ id, name, category: 'Mejorado', type: ['Daño Fisico'], effect_tags: [], situational_role: ['ofensivo'], attack_damage: 40, ...fields });
const coreItems = [
  item('mana', 'Manamune', { description: 'Tiene un límite de 700 de Maná adicional y transforma a Manamune en Muramaná.', mana: 500 }),
  item('mura', 'Muramaná', { description: 'Impacto: drena maná.', mana: 1000 }),
  item('arch', 'Báculo del Arcángel', { type: ['Daño Magico'], description: 'El límite de maná adicional es 700, lo que transforma Bastón del Arcángel en Abrazo de Serafín.', ability_power: 60 }),
  item('sera', 'Abrazo Del Serafin', { type: ['Daño Magico'], description: 'Salvavidas: escudo.', ability_power: 60 }),
  item('winter', 'Llegada del Invierno', { type: ['Defensa'], description: 'Carga de Maná. Limitado a un solo objeto de Lágrima de la Diosa.', life: 500 }),
  item('fimbul', 'Invierno Nórdico', { type: ['Defensa'], description: 'Coloso Congelado: escudo.', life: 500 }),
  ...['botrk', 'guinsoo', 'nashor', 'terminus', 'statikk', 'wits'].map(id => item(id, id.toUpperCase(), { attack_speed: 30, effect_tags: ['daño_on_hit'] })),
];
const starters = [
  item('scythe', 'Guadaña de Niebla Oscura', { category: 'Básico', type: ['Soporte'], description: 'Versátil. Invocación Álmica: cada 60 seg obtienes oro.' }),
  item('bulwark', 'Baluarte de la Montaña', { category: 'Básico', type: ['Soporte'], description: 'Cada 60 s, otorga 60 de oro.' }),
];
const kaisa = { id: 'kaisa', name: "Kai'Sa", roles: ['Tirador'], traits: ['dependiente_on_hit', 'rango'], damage_type: 'Hybrid', item_scalings: ['daño_ataque', 'velocidad_ataque', 'on_hit'] };
const leona = { id: 'leona', name: 'Leona', roles: ['Tanque'], traits: ['cc_duro', 'stun', 'alta_durabilidad'], damage_type: 'AP' };
const snapshot = { champions: [kaisa, leona], items: [...coreItems, ...starters], coreItems, movementItems: [], runes: [], spells: [] };
const ids = list => list.map(entry => entry.id);

test('evoluciones, lágrimas y objetos de soporte inicial se reconocen en el catálogo', () => {
  const rules = itemRulesFor(snapshot.items);
  assert.deepEqual(snapshot.items.filter(rules.isEvolved).map(row => row.id), ['mura', 'sera', 'fimbul']);
  assert.deepEqual(snapshot.items.filter(rules.isTear).map(row => row.id), ['mana', 'arch', 'winter']);
  assert.deepEqual(snapshot.items.filter(rules.isSupportStarter).map(row => row.id), ['scythe', 'bulwark']);
});

test('la IA no ve evoluciones; en Support ve los objetos de soporte inicial (también con temática)', () => {
  const adc = createEligibleV2Snapshot(snapshot, 'kaisa', 'adc', { themed: true });
  assert.ok(!ids(adc.coreItems).some(id => ['mura', 'sera', 'fimbul', 'scythe', 'bulwark'].includes(id)));
  const support = createEligibleV2Snapshot(snapshot, 'kaisa', 'support', { themed: true });
  assert.ok(ids(support.coreItems).includes('scythe') && ids(support.coreItems).includes('bulwark'));
});

test('Kai\'Sa support: dos lágrimas se corrigen y la Guadaña de Niebla Oscura va en el slot 1', () => {
  const eligible = createEligibleV2Snapshot(snapshot, 'kaisa', 'support', { themed: true });
  const fit = draftFitContext({ snapshot: eligible, championId: 'kaisa', role: 'support', allies: { support: 'kaisa' }, enemies: {} });
  const ai = ['mana', 'arch', 'guinsoo', 'botrk', 'nashor'].map(id => ({ id, reason: id }));
  const result = auditCoreItems({ coreItems: ai, snapshot: eligible, fit, themed: true, role: 'support' });
  const order = ids(result.coreItems);
  assert.equal(order[0], 'scythe');
  assert.equal(order.length, 5);
  assert.equal(order.filter(id => ['mana', 'arch', 'winter'].includes(id)).length, 1);
  assert.ok(result.notes.some(note => /Guadaña de Niebla Oscura/.test(note)));
});

test('Leona support recibe el Baluarte de la Montaña; si la IA puso uno 3º, pasa al 1º', () => {
  const eligible = createEligibleV2Snapshot(snapshot, 'leona', 'support');
  const fit = draftFitContext({ snapshot: eligible, championId: 'leona', role: 'support', allies: { support: 'leona' }, enemies: {} });
  const missing = auditCoreItems({ coreItems: ['winter', 'botrk', 'guinsoo', 'nashor', 'terminus'].map(id => ({ id, reason: id })), snapshot: eligible, fit, role: 'support' });
  assert.equal(ids(missing.coreItems)[0], 'bulwark');
  const third = auditCoreItems({ coreItems: ['winter', 'botrk', 'scythe', 'nashor', 'terminus'].map(id => ({ id, reason: id })), snapshot: eligible, fit, role: 'support' });
  assert.deepEqual(ids(third.coreItems).slice(0, 2), ['scythe', 'winter']);
});

test('la validación rechaza evoluciones, dos lágrimas y Support sin objeto inicial en el slot 1', () => {
  const base = {
    build_theme: 't', matchup_read: 't', win_condition: 't', key_adaptations: ['a', 'b'],
    composition_analysis: { allied_damage_profile: 't', enemy_priority_threats: ['a', 'b'], required_responses: ['a'], archetype_rationale: 't' },
    build_plan: { primary_archetype: 't', target_damage_profile: 't', first_item_rationale: 't', transformation_audit: 't' },
    movement_item: { id: 'boots', reason: 'r' }, keystone: { id: 'k', reason: 'r' },
    primary_runes: ['p1', 'p2', 'p3'].map(id => ({ id, reason: 'r' })), secondary_rune: { id: 's', reason: 'r' },
    spells: [{ id: 'f', reason: 'r' }, { id: 'h', reason: 'r' }],
  };
  const errorsOf = (core, role) => validateV2Result({ ...base, core_items: core.map(id => ({ id, reason: 'r' })) }, snapshot, { role }).validationErrors.join(' | ');
  assert.match(errorsOf(['mana', 'mura', 'botrk', 'guinsoo', 'nashor'], 'adc'), /es una evolución/);
  assert.match(errorsOf(['mana', 'arch', 'botrk', 'guinsoo', 'nashor'], 'adc'), /Lágrima de la Diosa/);
  assert.match(errorsOf(['botrk', 'scythe', 'guinsoo', 'nashor', 'terminus'], 'support'), /core_item 1 debe ser el objeto de soporte inicial/);
  assert.doesNotMatch(errorsOf(['scythe', 'botrk', 'guinsoo', 'nashor', 'terminus'], 'support'), /soporte inicial|core válido/);
  assert.match(errorsOf(['scythe', 'botrk', 'guinsoo', 'nashor', 'terminus'], 'adc'), /solo se arma en Support/);
});
