// Consejos según el rol y la línea: supports (engage, encantador, mago), tanques y botas.
// Casos que salieron de revisar el Coach con cuentas simuladas de cada rol.
import test from 'node:test';
import assert from 'node:assert/strict';
import { THREATS, buildCatalog, suggestItems } from '../../src/features/coach/catalog.js';
import { normalizeMatch, normalizeMatches } from '../../src/features/coach/normalize.js';
import { keystoneFits, threatAdvice } from '../../src/features/coach/detectors/build.js';
import { survivalTip } from '../../src/features/coach/detectors/performance.js';
import { catalog, match } from './fixtures.js';

const index = buildCatalog(catalog);
const threat = id => THREATS.find(entry => entry.id === id);
const suggest = (own, id) => suggestItems(index, own, threat(id).answers, { boots: Boolean(threat(id).boots) });
const ctx = { catalog: index, buildHabits: new Map() };
// Curadores, burst y mucho daño físico y mágico a la vez.
const LOADED_COMP = ['Soraka', 'Aatrox', 'Zed', 'Ahri', 'Darius'];

test('en support, Leona juega como support engage y Janna como encantadora', () => {
  const leona = normalizeMatch(match({ own_champion_name: 'Leona', lane: 'support' }), index).own;
  assert.equal(leona.buildClass, 'support');
  assert.equal(leona.supportStyle, 'engage');
  assert.equal(leona.isTank, true);
  const janna = normalizeMatch(match({ own_champion_name: 'Janna', lane: 'support' }), index).own;
  assert.equal(janna.supportStyle, 'enchanter');
  // Fuera de support, Leona sigue siendo tanque.
  assert.equal(normalizeMatch(match({ own_champion_name: 'Leona', lane: 'top' }), index).own.buildClass, 'tank');
});

test('encantadora: no se le piden antiheal ni resistencias; sí respuesta al burst con objetos de soporte', () => {
  const row = normalizeMatch(match({ own_champion_name: 'Janna', lane: 'support', enemy_champions: LOADED_COMP }), index);
  assert.equal(row.threats.healing, undefined);
  assert.equal(row.threats.physical, undefined);
  assert.equal(row.threats.magic, undefined);
  assert.ok(row.threats.burst);
  const items = suggest(row.own, 'burst');
  assert.ok(items.length > 0);
  items.forEach(name => assert.equal(index.items.get(name).type.includes('Soporte'), true, name));
  assert.ok(!items.includes('Presagio de Randuin') && !items.includes('Reloj de Arena de Zhonya'));
});

test('support engage: soporte o defensa, nunca daño; y el texto le habla al support', () => {
  const own = normalizeMatch(match({ own_champion_name: 'Leona', lane: 'support' }), index).own;
  const items = suggest(own, 'physical');
  assert.ok(items.length > 0);
  items.forEach(name => {
    const types = index.items.get(name).type;
    assert.ok(types.includes('Soporte') || types.includes('Defensa') || types.includes('Movimiento'), name);
  });
  const advice = threatAdvice(ctx, 'healing', { name: 'Leona', own });
  assert.doesNotMatch(advice, /guardá tu daño/);
  assert.match(advice, /tirador/);
});

test('support mago: objetos de su daño o de soporte, nunca tanque puro', () => {
  const own = normalizeMatch(match({ own_champion_name: 'Lux', lane: 'support' }), index).own;
  const items = suggest(own, 'burst');
  assert.ok(!items.includes('Presagio de Randuin'), items.join(', '));
  assert.ok(items.includes('Reloj de Arena de Zhonya') || items.includes('Relicario de los Solari de Hierro'), items.join(', '));
});

test('tanque: el timing no le pide guardar daño ni quedarse atrás', () => {
  const own = normalizeMatch(match({ own_champion_name: 'Malphite', lane: 'top' }), index).own;
  assert.doesNotMatch(threatAdvice(ctx, 'healing', { name: 'Malphite', own }), /guardá tu daño/);
  assert.match(threatAdvice(ctx, 'cc', { name: 'Malphite', own }), /entrá primero/);
});

test('las botas aparecen contra el control, no contra el burst', () => {
  const lux = normalizeMatch(match({ own_champion_name: 'Lux', lane: 'mid' }), index).own;
  assert.ok(suggest(lux, 'cc').includes('Botas de Mercurio'));
  assert.ok(!suggest(lux, 'burst').includes('Botas de Mercurio'));
});

test('runa clave: velocidad de ataque en un mago y Cometa en un tirador de autoataques no encajan; los tanques no se juzgan', () => {
  const lux = index.champion('Lux');
  const jinx = index.champion('Jinx');
  assert.equal(keystoneFits(lux, index.rune('Ritmo Letal')), false);
  assert.equal(keystoneFits(lux, index.rune('Cometa Arcano')), true);
  assert.equal(keystoneFits(jinx, index.rune('Cometa Arcano')), false);
  assert.equal(keystoneFits(jinx, index.rune('Ritmo Letal')), true);
  // Conquistador se carga con habilidades: no choca con un mago.
  assert.equal(keystoneFits(lux, index.rune('Conquistador')), true);
  assert.equal(keystoneFits(index.champion('Malphite'), index.rune('Agarre del Perpetuo')), null);
});

test('supervivencia: el encantador recibe su propio consejo', () => {
  const janna = normalizeMatch(match({ own_champion_name: 'Janna', lane: 'support' }), index).own;
  const leona = normalizeMatch(match({ own_champion_name: 'Leona', lane: 'support' }), index).own;
  assert.notEqual(survivalTip('support', janna), survivalTip('support', leona));
  assert.match(survivalTip('support', janna), /escudos y curaciones/);
});

// ── La línea que jugás y los picks exóticos ─────────────────────────────────────

const AP_BUILD = ['Báculo Abisal', 'Orbe del Infinito', 'Reloj de Arena de Zhonya'];
const TANK_BUILD = ['Presagio de Randuin', 'Corazón de Hielo', 'Cota de Espinas'];
const classOf = (matches) => normalizeMatches(matches, index)[0].own.buildClass;

test('un support del catálogo en otra línea juega de carry (Soraka mid)', () => {
  const own = normalizeMatch(match({ own_champion_name: 'Soraka', lane: 'mid' }), index).own;
  assert.equal(own.buildClass, 'carry');
  assert.equal(own.isSupport, false);
  // En support sigue siendo encantadora.
  assert.equal(normalizeMatch(match({ own_champion_name: 'Soraka', lane: 'support' }), index).own.supportStyle, 'enchanter');
});

test('un luchador en support juega como support de pelea: soporte, su daño o defensa', () => {
  const own = normalizeMatch(match({ own_champion_name: 'Sett', lane: 'support' }), index).own;
  assert.equal(own.buildClass, 'support');
  assert.equal(own.supportStyle, 'fighter');
  const items = suggest(own, 'healing');
  assert.ok(items.length > 0);
  assert.ok(items.every(name => !index.items.get(name).type.includes('Daño Magico')), items.join(', '));
});

test('pick exótico: Malphite mid que solo arma daño mágico se trata como carry', () => {
  const malphiteMid = fields => match({ own_champion_name: 'Malphite', lane: 'mid', items_used: AP_BUILD, ...fields });
  assert.equal(classOf([malphiteMid({ id: 'a' }), malphiteMid({ id: 'b' })]), 'carry');
  // Con una sola partida no alcanza para contradecir al catálogo: sigue siendo tanque.
  assert.equal(classOf([malphiteMid({ id: 'c' })]), 'tank');
  // En top, armando tanque, sigue siendo tanque.
  const malphiteTop = fields => match({ own_champion_name: 'Malphite', lane: 'top', items_used: TANK_BUILD, ...fields });
  assert.equal(classOf([malphiteTop({ id: 'd' }), malphiteTop({ id: 'e' })]), 'tank');
});

test('pick exótico: el carry deducido de la build recibe consejos de carry (sin texto de primera línea)', () => {
  const rows = normalizeMatches([
    match({ id: 'm-a', own_champion_name: 'Malphite', lane: 'mid', items_used: AP_BUILD }),
    match({ id: 'm-b', own_champion_name: 'Malphite', lane: 'mid', items_used: AP_BUILD }),
  ], index);
  const own = rows[0].own;
  assert.equal(own.isTank, false);
  assert.doesNotMatch(threatAdvice(ctx, 'cc', { name: 'Malphite', own }), /entrá primero/);
  // El burst le vuelve a tocar: ya no es tanque.
  const burst = normalizeMatches([
    match({ id: 'm-c', own_champion_name: 'Malphite', lane: 'mid', items_used: AP_BUILD, enemy_champions: LOADED_COMP }),
    match({ id: 'm-d', own_champion_name: 'Malphite', lane: 'mid', items_used: AP_BUILD, enemy_champions: LOADED_COMP }),
  ], index);
  assert.ok(burst[0].threats.burst);
});

test('pick exótico: Leona top armando defensa sigue siendo tanque; Lux armando objetos de soporte en mid, support', () => {
  const leona = fields => match({ own_champion_name: 'Leona', lane: 'top', items_used: TANK_BUILD, ...fields });
  assert.equal(classOf([leona({ id: 'l1' }), leona({ id: 'l2' })]), 'tank');
  const supportItems = ['Relicario de los Solari de Hierro', 'Bendición de Mikael', 'Báculo Abisal'];
  const lux = fields => match({ own_champion_name: 'Lux', lane: 'mid', items_used: supportItems, ...fields });
  assert.equal(classOf([lux({ id: 'x1' }), lux({ id: 'x2' })]), 'support');
});
