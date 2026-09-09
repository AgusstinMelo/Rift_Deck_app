import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
