// Los números de la partida (daño, daño recibido, peleas, oro contra tu rival) en la
// última partida y como tendencia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCoachReport } from '../../src/features/coach/engine.js';
import { buildCatalog } from '../../src/features/coach/catalog.js';
import { normalizeMatches } from '../../src/features/coach/normalize.js';
import { summarize } from '../../src/features/coach/stats.js';
import { detectCarryLoad, detectDamageTrend, detectExposure, fightRole } from '../../src/features/coach/detectors/matchNumbers.js';
import { catalog, match } from './fixtures.js';

const index = buildCatalog(catalog);
const LANES = ['top', 'jungler', 'mid', 'adc', 'support'];
const NOW = new Date('2026-11-16T12:00:00Z');

/** Los 10 jugadores de una partida: `self` y `rival` pisan los valores por defecto. */
function players(matchId, { lane = 'adc', self = {}, rival = {} } = {}) {
  const base = { damage_dealt: 15000, damage_taken: 15000, healing_shielding: 3000, teamfight_participation: 55, gold: 12000, items: [] };
  return [
    ...LANES.map(entry => ({ match_id: matchId, team: 'ally', lane: entry, is_self: entry === lane, ...base, ...(entry === lane ? self : {}) })),
    ...LANES.map(entry => ({ match_id: matchId, team: 'enemy', lane: entry, is_self: false, ...base, ...(entry === lane ? rival : {}) })),
  ];
}

/** Partida de Jinx adc del día `day` de octubre (más alto = más reciente). */
const jinx = (day, result, extra = {}) => match({
  own_champion_name: 'Jinx', lane: 'adc', enemy_champion_name: 'Ashe', result,
  date: `2026-10-${String(day).padStart(2, '0')}`, created_at: `2026-10-${String(day).padStart(2, '0')}T12:00:00Z`,
  items_used: ['Filo Infinito', 'Hidra Titánica', 'Cuchilla Negra'], kills: 5, deaths: 3, assists: 6, ...extra,
});

const game = (m, options) => ({ match: m, players: players(m.id, options) });
const report = games => computeCoachReport({ matches: games.map(g => g.match), ...catalog, participants: games.flatMap(g => g.players), now: NOW, limit: 30 });
const lastCard = games => report(games).insights.find(card => card.id.startsWith(`last-${games[0].match.id}`));
const contextOf = games => {
  const rows = normalizeMatches(games.map(g => g.match), index);
  return { matches: rows, base: summarize(rows), catalog: index, participants: games.flatMap(g => g.players) };
};
/** Historial de Jinx con números normales (su daño: 25k de 85k, el 29%). */
const history = (count, self = { damage_dealt: 25000 }, result = i => (i % 2 ? 'win' : 'loss')) =>
  Array.from({ length: count }, (_, i) => game(jinx(i + 1, result(i)), { self }));

test('rol en la pelea según la clase del campeón', () => {
  assert.equal(fightRole(index.champion('Jinx')), 'backline');
  assert.equal(fightRole(index.champion('Zed')), 'diver');
  assert.equal(fightRole(index.champion('Garen')), 'diver');
  assert.equal(fightRole(index.champion('Malphite')), 'frontline');
});

test('última partida: máximo daño del equipo y más daño que el rival de línea → elogio', () => {
  const last = game(jinx(20, 'win', { deaths: 2 }), { self: { damage_dealt: 32000, damage_taken: 9000 }, rival: { damage_dealt: 14000 } });
  const card = lastCard([last, ...history(4)]);
  assert.ok(card);
  assert.match(card.thesis, /hiciste más daño que nadie en tu equipo \(35%/);
  assert.ok(card.evidence.some(line => /Daño: 35% del equipo/.test(line)), card.evidence.join(' | '));
});

test('última partida: daño por debajo de tu habitual con el campeón → corrección', () => {
  const last = game(jinx(20, 'loss', { deaths: 3 }), { self: { damage_dealt: 8000 } });
  const card = lastCard([last, ...history(4)]);
  assert.match(card.thesis, /Hiciste el 12% del daño de tu equipo, por debajo de tu 29% habitual con Jinx/);
  assert.match(card.action, /primera línea/);
});

test('última partida: un tirador que recibe más daño que nadie en su equipo → posición', () => {
  const last = game(jinx(20, 'loss', { deaths: 4 }), { self: { damage_taken: 32000 } });
  const card = lastCard([last, ...history(4)]);
  assert.match(card.thesis, /Recibiste más daño que nadie en tu equipo \(35% del total\)/);
  assert.match(card.action, /borde de la pelea/);
});

test('última partida: pocas peleas contra tu habitual reemplaza a la participación en kills', () => {
  const last = game(jinx(20, 'loss', { team_kills: 20, kills: 2, assists: 2 }), { self: { teamfight_participation: 30 } });
  const card = lastCard([last, ...history(4, { damage_dealt: 25000, teamfight_participation: 65 })]);
  assert.match(card.thesis, /Estuviste en el 30% de las peleas, cuando lo habitual para vos es el 65%/);
  assert.doesNotMatch(card.thesis, /de las kills de tu equipo/);
});

test('última partida: abajo en oro contra tu rival de línea', () => {
  const last = game(jinx(20, 'loss'), { self: { gold: 9500 }, rival: { gold: 12500 } });
  const card = lastCard([last, ...history(4)]);
  assert.match(card.thesis, /Terminaste con 3,0k de oro menos que Ashe|Terminaste con 3\.0k de oro menos que Ashe/);
});

test('tendencia: perdés siendo el que más daño hace', () => {
  const games = [
    ...Array.from({ length: 4 }, (_, i) => game(jinx(i + 1, 'loss', { deaths: 6 }), { self: { damage_dealt: 30000 } })),
    ...Array.from({ length: 3 }, (_, i) => game(jinx(i + 10, 'win'), { self: { damage_dealt: 22000 } })),
  ];
  const [card] = detectCarryLoad(contextOf(games));
  assert.ok(card);
  assert.match(card.thesis, /En 4 de tus 4 derrotas hiciste más daño que nadie/);
  assert.match(card.action, /morís 6\.0 veces|morís 6,0 veces/);

  const split = [
    ...Array.from({ length: 4 }, (_, i) => game(jinx(i + 1, 'loss'), { self: { damage_dealt: 12000 } })),
    ...Array.from({ length: 3 }, (_, i) => game(jinx(i + 10, 'win'), { self: { damage_dealt: 22000 } })),
  ];
  assert.equal(detectCarryLoad(contextOf(split)).length, 0, 'sin ser el máximo daño en las derrotas no hay consejo');
});

test('tendencia: desde atrás recibís demasiado daño', () => {
  const games = Array.from({ length: 6 }, (_, i) => game(jinx(i + 1, i % 2 ? 'win' : 'loss'), { self: { damage_taken: 26000 } }));
  const [card] = detectExposure(contextOf(games));
  assert.ok(card);
  assert.equal(card.id, 'impact-exposed');
  assert.match(card.thesis, /recibís el 30% del daño de tu equipo \(6 partidas\)/);

  const safe = Array.from({ length: 6 }, (_, i) => game(jinx(i + 1, i % 2 ? 'win' : 'loss'), { self: { damage_taken: 9000 } }));
  assert.equal(detectExposure(contextOf(safe)).length, 0);
});

test('tendencia: tu daño de las últimas 5 partidas contra las anteriores', () => {
  const games = [
    ...Array.from({ length: 6 }, (_, i) => game(jinx(i + 1, 'loss'), { self: { damage_dealt: 12000 } })),
    ...Array.from({ length: 5 }, (_, i) => game(jinx(i + 10, 'win'), { self: { damage_dealt: 30000 } })),
  ];
  const [card] = detectDamageTrend(contextOf(games));
  assert.ok(card);
  assert.equal(card.id, 'trend-damage-up');
  assert.equal(card.tone, 'positive');
});

test('el informe no repite tendencias de muertes', () => {
  const deathy = Array.from({ length: 30 }, (_, i) => game(jinx((i % 28) + 1, i < 14 ? 'win' : 'loss', {
    deaths: i < 14 ? 2 : 8, team_kills: 20, enemy_team_kills: 20,
  })));
  const cards = report(deathy).insights.filter(card => card.family !== 'lastMatch' && card.topic === 'muertes');
  assert.ok(cards.length <= 1, cards.map(card => card.id).join(', '));
});
