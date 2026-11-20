// Por qué cada pieza encaja en esta partida: lo que recibe la IA (responds_to) y la línea
// "Responde a" de la pantalla del resultado salen del mismo cálculo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDraftProfile } from '../../src/features/buildV2/v2DraftProfile.js';
import { pieceDraftFacts, respondsToText } from '../../src/features/buildV2/v2DraftReasons.js';
import { buildV2Prompt } from '../../src/features/buildV2/v2PromptBuilder.js';

const zed = { id: 'zed', name: 'Zed', roles: ['Asesino'], damage_type: 'AD', score_burst: 5 };
const talon = { id: 'talon', name: 'Talon', roles: ['Asesino'], damage_type: 'AD', score_burst: 5 };
const lux = { id: 'lux', name: 'Lux', roles: ['Mago'], damage_type: 'AP' };
const kaisa = { id: 'kaisa', name: "Kai'Sa", roles: ['Tirador'], damage_type: 'Hybrid', item_scalings: ['velocidad_ataque', 'on_hit'] };

const ga = { id: 'ga', name: 'Ángel Guardián', category: 'Mejorado', type: ['Daño Fisico', 'Defensa'], effect_tags: ['revivir', 'anti_burst'], armor: 40, attack_damage: 40 };
const guinsoo = { id: 'guinsoo', name: 'Espadafuria de Guinsoo', category: 'Mejorado', type: ['Daño Fisico'], effect_tags: ['dano_on_hit'], attack_speed: 30 };
const barrier = { id: 'barrier', name: 'Barrera', counters: ['burst', 'asesinos'] };

const profile = buildDraftProfile({ champion: kaisa, role: 'adc', allies: [], enemies: [zed, talon, lux] });
const scalings = new Set(kaisa.item_scalings);

test('un defensivo responde a las amenazas del rival con quiénes las forman', () => {
  const facts = pieceDraftFacts(ga, 'item', { profile, scalings });
  const signals = facts.answers.map(entry => entry.signal);
  assert.ok(signals.includes('burst') && signals.includes('asesinos'));
  assert.deepEqual(facts.answers.find(entry => entry.signal === 'asesinos').champions, ['Zed', 'Talon']);
  assert.match(respondsToText(facts), /asesinos \(Zed, Talon\)/);
});

test('un objeto de daño sin amenaza que responder se explica por el kit; runas y hechizos por sus counters', () => {
  const facts = pieceDraftFacts(guinsoo, 'item', { profile, scalings });
  assert.deepEqual(facts.answers, []);
  assert.deepEqual(facts.scalings, ['velocidad_ataque', 'on_hit']);
  assert.deepEqual(pieceDraftFacts(barrier, 'spell', { profile }).answers.map(entry => entry.signal).sort(), ['asesinos', 'burst']);
  assert.deepEqual(pieceDraftFacts(ga, 'item', { profile: buildDraftProfile({ champion: kaisa, role: 'adc', allies: [], enemies: [] }), scalings }).answers, [], 'sin rivales cargados no hay amenazas');
});

test('el prompt manda responds_to con los nombres y pide arrancar el motivo por la partida', () => {
  const snapshot = {
    patchVersion: '7.3',
    champions: [kaisa, zed, talon, lux],
    coreItems: [ga, guinsoo],
    movementItems: [],
    runes: [{ id: 'k', name: 'Cadencia Letal', branch: 'Clave', group: 1 }],
    spells: [barrier],
  };
  const prompt = buildV2Prompt({ snapshot, championId: 'kaisa', role: 'adc', allies: { adc: 'kaisa' }, enemies: { mid: 'zed', jungler: 'talon', support: 'lux' } });
  assert.match(prompt, /"responds_to"/);
  assert.match(prompt, /asesinos \(Zed, Talon\)/);
  assert.match(prompt, /primero el motivo de la partida/);
  assert.match(prompt, /Para la build de penetración que pediste/);
  assert.match(prompt, /Sin enemigos cargados no hay amenazas que citar/);
});
