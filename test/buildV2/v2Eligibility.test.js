import test from 'node:test';
import assert from 'node:assert/strict';
import {
  spellFitsLane,
  championCanHealOrShieldAllies,
  createEligibleV2Snapshot,
  requiresChampionAllyHealOrShield,
} from '../../src/features/buildV2/v2Eligibility.js';

const kaisa = {
  id: 'kaisa',
  name: `Kai'Sa`,
  traits: ['dependiente_autoataques', 'dependiente_on_hit', 'daño_mixto', 'rango', 'dash'],
  item_scalings: ['daño_ataque', 'velocidad_ataque', 'on_hit', 'poder_habilidad', 'probabilidad_critico'],
};
const nami = {
  id: 'nami',
  name: 'Nami',
  traits: ['curacion_aliada', 'buff_aliado'],
  item_scalings: ['poder_habilidad', 'poder_curacion', 'poder_escudo'],
};
const ardent = {
  id: 'ardent',
  name: 'Pebetero Ardiente',
  description: 'Cuando curas o escudas a un campeón aliado, obtiene Velocidad de Ataque.',
};
const echo = {
  id: 'echo',
  name: 'Eco Armónico',
  description: 'La siguiente habilidad que lances para curar u otorgar un escudo a un aliado le restaura Vida adicional.',
};
const locket = {
  id: 'locket',
  name: 'Relicario',
  description: 'Otorga un escudo para ti y tus aliados cercanos.',
};
const aery = {
  id: 'aery',
  name: 'Aery',
  branch: 'Clave',
  group: 1,
  description: 'Tus ataques infligen daño a enemigos o escudan aliados.',
  trigger_tags: ['autoataque', 'impacto_habilidad', 'cerca_aliado'],
};
const revitalize = {
  id: 'revitalize',
  name: 'Revitalizar',
  branch: 'Valor',
  group: 3,
  description: 'Obtienes amplificación al curar y otorgar escudos.',
  trigger_tags: ['curar', 'escudar'],
};

test('el rol support no inventa curaciones o escudos en Kai\'Sa', () => {
  assert.equal(championCanHealOrShieldAllies(kaisa), false);
  assert.equal(requiresChampionAllyHealOrShield(ardent), true);
  assert.equal(requiresChampionAllyHealOrShield(echo), true);
  assert.equal(requiresChampionAllyHealOrShield(locket), false);
  assert.equal(requiresChampionAllyHealOrShield(aery), false);
  assert.equal(requiresChampionAllyHealOrShield(revitalize), true);
});

test('filtra habilitadores incompatibles pero conserva efectos autocontenidos', () => {
  const snapshot = {
    champions: [kaisa, nami],
    items: [ardent, echo, locket],
    coreItems: [ardent, echo, locket],
    movementItems: [],
    runes: [aery, revitalize],
  };
  const eligible = createEligibleV2Snapshot(snapshot, 'kaisa');
  assert.deepEqual(eligible.coreItems.map(item => item.id), ['locket']);
  assert.deepEqual(eligible.runes.map(rune => rune.id), ['aery']);
  assert.deepEqual(eligible.items.map(item => item.id), ['locket']);
});

test('un campeón con capacidad real conserva los objetos de encantador', () => {
  const snapshot = {
    champions: [kaisa, nami],
    items: [ardent, echo, locket],
    coreItems: [ardent, echo, locket],
    movementItems: [],
    runes: [aery, revitalize],
  };
  assert.equal(championCanHealOrShieldAllies(nami), true);
  assert.equal(createEligibleV2Snapshot(snapshot, 'nami'), snapshot);
});

test('una runa que también se activa al recibir daño o cerca de un aliado no exige curar', () => {
  const guardian = { id: 'guardian', name: 'Guardián', branch: 'Clave', description: 'Protege a un aliado cercano.', trigger_tags: ['escudar', 'cerca_aliado'] };
  const resolve = { id: 'resolve', name: 'Resolución', branch: 'Valor', description: 'Al recibir daño.', trigger_tags: ['curar', 'recibir_daño'] };
  assert.equal(requiresChampionAllyHealOrShield(guardian), false);
  assert.equal(requiresChampionAllyHealOrShield(resolve), false);
});

test('los hechizos se filtran por la línea (fits_lanes); sin dato, se mantienen', () => {
  const tp = { id: 'tp', name: 'Teleportación', fits_lanes: ['top', 'mid'] };
  const heal = { id: 'heal', name: 'Curación', fits_lanes: ['adc', 'support'] };
  const flash = { id: 'flash', name: 'Destello', fits_lanes: ['top', 'jungler', 'mid', 'adc', 'support'] };
  const unknown = { id: 'x', name: 'Sin datos' };
  assert.equal(spellFitsLane(tp, 'support'), false);
  assert.equal(spellFitsLane(unknown, 'support'), true);
  const snapshot = { champions: [nami], items: [], coreItems: [], movementItems: [], runes: [], spells: [tp, heal, flash, unknown] };
  assert.deepEqual(createEligibleV2Snapshot(snapshot, 'nami', 'support').spells.map(spell => spell.id), ['heal', 'flash', 'x']);
  assert.deepEqual(createEligibleV2Snapshot(snapshot, 'nami', 'top').spells.map(spell => spell.id), ['tp', 'flash', 'x']);
  assert.equal(createEligibleV2Snapshot(snapshot, 'nami'), snapshot);
});

test('sin temática la IA solo ve piezas de la clase; con temática, todo', () => {
  const champion = { id: 'jinx', name: 'Jinx', roles: ['Tirador'], traits: ['rango'], item_scalings: ['daño_ataque'], damage_type: 'AD' };
  const damage = n => ({ id: `d${n}`, name: `Daño ${n}`, category: 'Mejorado', type: ['Daño Fisico'], effect_tags: [], situational_role: ['ofensivo'] });
  const tank = { id: 'tank', name: 'Cota', category: 'Mejorado', type: ['Defensa'], effect_tags: ['defensa_fisica'], situational_role: ['defensivo'], armor: 70 };
  const support = { id: 'sup', name: 'Incensario', category: 'Mejorado', type: ['Soporte'], effect_tags: ['buff_aliado'], situational_role: ['utilidad'] };
  const coreItems = [...Array.from({ length: 12 }, (_, n) => damage(n)), tank, support];
  const runes = [
    { id: 'k1', name: 'Cadencia', branch: 'Clave', group: 1, fits_classes: ['tirador'] },
    { id: 'k2', name: 'Guardián', branch: 'Clave', group: 1, fits_classes: ['soporte', 'tanque'] },
    ...[1, 2, 3].map(group => ({ id: `p${group}`, name: `P${group}`, branch: 'Precisión', group, fits_classes: ['tirador'] })),
    { id: 'v1', name: 'Coraza', branch: 'Valor', group: 1, fits_classes: ['tanque'] },
    { id: 'b1', name: 'Celeridad', branch: 'Brujería', group: 2, fits_classes: ['tirador'] },
  ];
  const snapshot = { champions: [champion], items: coreItems, coreItems, movementItems: [], runes, spells: [] };
  const normal = createEligibleV2Snapshot(snapshot, 'jinx', 'adc');
  assert.deepEqual(normal.coreItems.map(item => item.id).filter(id => !id.startsWith('d')), []);
  assert.deepEqual(normal.runes.map(rune => rune.id), ['k1', 'p1', 'p2', 'p3', 'b1']);
  assert.equal(normal.items.some(item => item.id === 'tank'), false);
  const themed = createEligibleV2Snapshot(snapshot, 'jinx', 'adc', { themed: true });
  assert.equal(themed.coreItems.length, 14);
  assert.equal(themed.runes.length, 7);
  // Con pocos objetos de la clase (menos de 12) se muestra todo, para que la IA tenga de dónde elegir.
  const few = { ...snapshot, coreItems: coreItems.slice(5), items: coreItems.slice(5) };
  assert.equal(createEligibleV2Snapshot(few, 'jinx', 'adc').coreItems.length, few.coreItems.length);
});
