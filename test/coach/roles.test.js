// Consejos según el rol y la línea: supports (engage, encantador, mago), tanques y botas.
// Casos que salieron de revisar el Coach con cuentas simuladas de cada rol.
import test from 'node:test';
import assert from 'node:assert/strict';
import { THREATS, buildCatalog, suggestItems } from '../../src/features/coach/catalog.js';
import { normalizeMatch, normalizeMatches } from '../../src/features/coach/normalize.js';
import { keystoneFits, threatAdvice } from '../../src/features/coach/detectors/build.js';
import { survivalTip } from '../../src/features/coach/detectors/performance.js';
import { computeCoachReport } from '../../src/features/coach/engine.js';
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

// ── Temática de la build contra las composiciones (support mago) ─────────────
test('build: support mago sin protección en su kit, de daño contra divers, perdió → pedía protección', () => {
  const lux = fields => match({ own_champion_name: 'Lux', lane: 'support', enemy_champion_name: 'Lee Sin', ...fields });
  const last = lux({
    id: 'lux-last', date: '2026-11-15', created_at: '2026-11-15T20:00:00Z', result: 'loss', kills: 1, deaths: 4, assists: 6,
    ally_champions: ['Ashe', 'Garen', 'Annie', 'Darius'],
    enemy_champions: ['Zed', 'Akali', 'Lee Sin', 'Darius', 'Jinx'],
    items_used: ['Eco de Luden', 'Orbe del Infinito', 'Brazal del Buscador', 'Botas de Mercurio'],
  });
  const insights = computeCoachReport({ matches: [last, lux({}), lux({}), lux({})], ...catalog, now: new Date('2026-11-16T12:00:00Z'), limit: 30 }).insights;
  const card = insights.find(insight => insight.id.startsWith('last-lux-last'));
  assert.ok(card, 'hay tarjeta de última partida');
  assert.match(card.thesis, /Armaste daño \(Eco de Luden y Orbe del Infinito\), pero la partida pedía protección/);
  assert.ok(card.thesis.includes('3 campeones que llegan a la línea de atrás (Zed, Akali y Lee Sin)'));
  assert.match(card.thesis, /Ashe/);
  // El componente con armadura no cuenta como "armaste armadura".
  assert.doesNotMatch(card.thesis, /armadura/);
  assert.match(card.action, /Relicario de los Solari de Hierro|Báculo de Agua Fluyente/);
  assert.doesNotMatch(card.action, /Orbe|Luden/);
  // Consejo del kit: Lux tiene control; lo guarda para cuando salten sobre su tirador.
  assert.match(card.action, /guardá tu control para cuando salte sobre Ashe/);
});

test("build: Seraphine de daño ganó con Smolder contra Riven y K'Sante → bien armada, y el tanque no cuenta como diver", () => {
  const seraphine = fields => match({ own_champion_name: 'Seraphine', lane: 'support', enemy_champion_name: 'Lux', ...fields });
  const last = seraphine({
    id: 'sera-real', date: '2026-11-15', created_at: '2026-11-15T20:00:00Z', result: 'win', kills: 1, deaths: 2, assists: 14,
    ally_champions: ['Smolder', 'Garen', 'Lee Sin', 'Darius'],
    enemy_champions: ["K'Sante", 'Riven', 'Lux', 'Jinx', 'Darius'],
    items_used: ['Eco de Luden', 'Orbe del Infinito', 'Brazal del Buscador', 'Botas de Mercurio'],
  });
  const insights = computeCoachReport({ matches: [last, seraphine({}), seraphine({}), seraphine({})], ...catalog, now: new Date('2026-11-16T12:00:00Z'), limit: 30 }).insights;
  const card = insights.find(insight => insight.id.startsWith('last-sera-real'));
  assert.doesNotMatch(card.thesis, /hay algo para corregir|pedía/);
  assert.doesNotMatch(card.thesis, /K'Sante/, 'un tanque no es un rival que se tira a la línea de atrás');
  assert.match(card.thesis, /tu build de daño era la indicada, porque tu equipo no tenía otro daño mágico y a Smolder, que escala tarde, tu poke en línea le daba espacio para farmear/);
  assert.match(card.action, /Contra Riven, que se tira a la línea de atrás, guardá tu control para cuando salte sobre Smolder/);
});

test('build: Seraphine de daño que ganó contra 3 divers → alternativa (su poder de habilidad también protege), no error', () => {
  const seraphine = fields => match({ own_champion_name: 'Seraphine', lane: 'support', enemy_champion_name: 'Lee Sin', ...fields });
  const last = seraphine({
    id: 'sera-alt', date: '2026-11-15', created_at: '2026-11-15T20:00:00Z', result: 'win', kills: 1, deaths: 2, assists: 14,
    ally_champions: ['Smolder', 'Garen', 'Lux', 'Darius'],
    enemy_champions: ['Zed', 'Akali', 'Lee Sin', 'Darius', 'Jinx'],
    items_used: ['Eco de Luden', 'Orbe del Infinito', 'Botas de Mercurio'],
  });
  const participants = [
    { match_id: 'sera-alt', team: 'ally', is_self: true, lane: 'support', champion: 'Seraphine', kills: 1, deaths: 2, assists: 14 },
    { match_id: 'sera-alt', team: 'ally', is_self: false, lane: 'adc', champion: 'Smolder', kills: 9, deaths: 2, assists: 5 },
  ];
  const insights = computeCoachReport({ matches: [last, seraphine({}), seraphine({}), seraphine({})], participants, ...catalog, now: new Date('2026-11-16T12:00:00Z'), limit: 30 }).insights;
  const card = insights.find(insight => insight.id.startsWith('last-sera-alt'));
  assert.equal(card.tone, 'positive');
  assert.doesNotMatch(card.thesis, /hay algo para corregir/);
  assert.match(card.thesis, /Armaste daño y te funcionó \(Smolder murió solo 2 veces\); con Seraphine, el poder de habilidad también agranda tus escudos y curaciones\. También tenías la opción de armar protección/);
  assert.match(card.action, /^Si se repite una composición así, otra opción: jugá al lado de tu tirador/);
});

test('build: ganó, pero el tirador a cuidar murió 7 veces → la build no lo protegió (corrección)', () => {
  const lux = fields => match({ own_champion_name: 'Lux', lane: 'support', enemy_champion_name: 'Lee Sin', ...fields });
  const last = lux({
    id: 'lux-died', date: '2026-11-15', created_at: '2026-11-15T20:00:00Z', result: 'win', kills: 3, deaths: 3, assists: 9,
    ally_champions: ['Ashe', 'Garen', 'Annie', 'Darius'],
    enemy_champions: ['Zed', 'Akali', 'Lee Sin', 'Darius', 'Jinx'],
    items_used: ['Eco de Luden', 'Orbe del Infinito', 'Botas de Mercurio'],
  });
  const participants = [{ match_id: 'lux-died', team: 'ally', is_self: false, lane: 'adc', champion: 'Ashe', kills: 4, deaths: 7, assists: 3 }];
  const insights = computeCoachReport({ matches: [last, lux({}), lux({}), lux({})], participants, ...catalog, now: new Date('2026-11-16T12:00:00Z'), limit: 30 }).insights;
  const card = insights.find(insight => insight.id.startsWith('last-lux-died'));
  assert.match(card.thesis, /Ganaste, pero hay algo para corregir\. Armaste daño .*pero la partida pedía protección/);
  assert.match(card.thesis, /Ashe murió 7 veces/);
});

test('build: Seraphine support de daño en un equipo sin daño mágico y sin divers rivales → bien armada', () => {
  const seraphine = fields => match({ own_champion_name: 'Seraphine', lane: 'support', enemy_champion_name: 'Jinx', ...fields });
  const last = seraphine({
    id: 'sera-good', date: '2026-11-15', created_at: '2026-11-15T20:00:00Z', result: 'win', kills: 4, deaths: 1, assists: 12,
    ally_champions: ['Ashe', 'Garen', 'Darius', 'Sett'],
    enemy_champions: ['Darius', 'Jinx', 'Lux', 'Malphite', 'Soraka'],
    items_used: ['Eco de Luden', 'Orbe del Infinito', 'Botas de Mercurio'],
  });
  const insights = computeCoachReport({ matches: [last, seraphine({}), seraphine({}), seraphine({})], ...catalog, now: new Date('2026-11-16T12:00:00Z'), limit: 30 }).insights;
  const card = insights.find(insight => insight.id.startsWith('last-sera-good'));
  assert.ok(card);
  assert.match(card.thesis, /tu build de daño era la indicada, porque tu equipo no tenía otro daño mágico/);
});

/** Tarjeta de última partida de `last` (con 3 partidas de historial del mismo campeón). */
function lastCard(last, history) {
  const insights = computeCoachReport({ matches: [last, history({}), history({}), history({})], ...catalog, now: new Date('2026-11-16T12:00:00Z'), limit: 30 }).insights;
  return insights.find(insight => insight.id.startsWith(`last-${last.id}`));
}
const recent = { date: '2026-11-15', created_at: '2026-11-15T20:00:00Z', result: 'loss', kills: 4, deaths: 3, assists: 5 };

test('build: carry full daño con la build terminada contra 3 divers y sin quien lo cuide → pedía un defensivo', () => {
  const kaisa = fields => match({ own_champion_name: "Kai'Sa", lane: 'adc', enemy_champion_name: 'Zed', ...fields });
  const fight = { ally_champions: ['Garen', 'Lux', 'Ahri', 'Sett'], enemy_champions: ['Zed', 'Akali', 'Lee Sin', 'Darius', 'Malphite'] };
  const card = lastCard(kaisa({ id: 'kai-full', ...recent, ...fight, items_used: ['Hidra Titánica', 'Filo Infinito', 'Cuchilla Negra', 'Recordatorio Mortal', 'Hoja del Rey Arruinado'] }), kaisa);
  assert.match(card.thesis, /Armaste full daño .*pero la partida pedía daño con un objeto defensivo/);
  assert.ok(card.thesis.includes('(Zed, Akali y Lee Sin)'));
  assert.match(card.thesis, /no tenías tanque ni encantador/);
  assert.match(card.action, /Ángel Guardián|Danza de la Muerte/);
  assert.doesNotMatch(card.action, /Corazón|Cota|Randuin/, 'nunca objetos de tanque a un carry');
  // Con slots libres no se juzga: el defensivo pudo venir de 5º objeto.
  const early = lastCard(kaisa({ id: 'kai-early', ...recent, ...fight, items_used: ['Hidra Titánica', 'Filo Infinito', 'Cuchilla Negra', 'Recordatorio Mortal'] }), kaisa);
  assert.doesNotMatch(early?.thesis || '', /pedía/);
});

test('build: carry con defensivo cuando nadie lo alcanzaba y tenía tanque → podía ir full daño', () => {
  const kaisa = fields => match({ own_champion_name: "Kai'Sa", lane: 'adc', enemy_champion_name: 'Jinx', ...fields });
  const card = lastCard(kaisa({
    id: 'kai-guard', ...recent, ally_champions: ['Malphite', 'Garen', 'Darius', 'Soraka'],
    enemy_champions: ['Darius', 'Jinx', 'Lux', 'Malphite', 'Soraka'], items_used: ['Hidra Titánica', 'Filo Infinito', 'Ángel Guardián'],
  }), kaisa);
  assert.match(card.thesis, /Armaste daño con un objeto defensivo \(Ángel Guardián\), pero la partida pedía full daño/);
  assert.match(card.action, /Cambialo por otro objeto de daño/);
});

test('build: luchador full daño sin tanque en su equipo contra daño físico → pedía resistencias', () => {
  const garen = fields => match({ own_champion_name: 'Garen', lane: 'top', ...fields });
  const card = lastCard(garen({
    id: 'garen-dmg', ...recent, ally_champions: ['Jinx', 'Lux', 'Ahri', 'Soraka'],
    enemy_champions: ['Darius', 'Zed', 'Jinx', 'Aatrox', 'Sett'], items_used: ['Hidra Titánica', 'Cuchilla Negra', 'Filo Infinito'],
  }), garen);
  assert.match(card.thesis, /Armaste daño .*pero la partida pedía resistencias: no tenías tanque, así que/);
  assert.match(card.thesis, /casi todo físico/);
  assert.match(card.action, /Corazón Helado|Cota de Espinas|Presagio de Randuin|Corazón de Hielo/);
});

test('build: tanque con armadura contra un equipo de daño mágico → pedía resistencia mágica', () => {
  const malphite = fields => match({ own_champion_name: 'Malphite', lane: 'top', ...fields });
  const card = lastCard(malphite({
    id: 'malph-armor', ...recent, ally_champions: ['Jinx', 'Garen', 'Ahri', 'Soraka'],
    enemy_champions: ['Lux', 'Ahri', 'Annie', 'Soraka', 'Darius'], items_used: ['Corazón Helado', 'Presagio de Randuin', 'Cota de Espinas'],
  }), malphite);
  assert.match(card.thesis, /Armaste armadura .*pero la partida pedía resistencia mágica: el daño rival era casi todo mágico/);
  assert.match(card.action, /Priorizá resistencia mágica/);
});
