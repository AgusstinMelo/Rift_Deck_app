// Consejos con los 10 jugadores de la partida (match_participants, carga con capturas).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog } from '../../src/features/coach/catalog.js';
import { normalizeMatches } from '../../src/features/coach/normalize.js';
import { summarize } from '../../src/features/coach/stats.js';
import {
  detectDamageShare, detectEnemyItems, detectFightPresence, detectLaneGold, detectParticipantInsights, detectRoleNumbers, participantMatches,
} from '../../src/features/coach/detectors/participants.js';
import { catalog, match } from './fixtures.js';

const index = buildCatalog(catalog);
const LANES = ['top', 'jungler', 'mid', 'adc', 'support'];
// Malphite armado de tanque (con objetos de daño, el Coach lo lee como carry).
const TANK_BUILD = ['Corazón de Hielo', 'Cota de Espinas', 'Presagio de Randuin'];

/** Los 10 jugadores de una partida: `self` y `rival` pisan los valores por defecto. */
function players(matchId, { lane = 'adc', self = {}, rival = {}, allies = {}, enemies = {} } = {}) {
  const base = { damage_dealt: 15000, damage_taken: 15000, healing_shielding: 3000, teamfight_participation: 50, gold: 12000, items: [] };
  return [
    ...LANES.map(entry => ({ match_id: matchId, team: 'ally', lane: entry, is_self: entry === lane, ...base, ...allies, ...(entry === lane ? self : {}) })),
    ...LANES.map(entry => ({ match_id: matchId, team: 'enemy', lane: entry, is_self: false, ...base, ...enemies, ...(entry === lane ? rival : {}) })),
  ];
}

function contextOf(games) {
  const raw = games.map(game => game.match);
  const rows = normalizeMatches(raw, index);
  return { matches: rows, base: summarize(rows), catalog: index, participants: games.flatMap(game => game.players) };
}

const jinx = (result, extra = {}) => match({ own_champion_name: 'Jinx', lane: 'adc', result, items_used: ['Filo Infinito', 'Hidra Titánica', 'Espada Larga'], ...extra });

test('une cada partida con su fila, sus aliados, los enemigos y el rival de línea', () => {
  const game = jinx('win');
  const ctx = contextOf([{ match: game, players: players(game.id, { rival: { gold: 9000 } }) }]);
  const [row] = participantMatches(ctx);
  assert.equal(row.self.lane, 'adc');
  assert.equal(row.allies.length, 5);
  assert.equal(row.enemies.length, 5);
  assert.equal(row.opponent.gold, 9000);
});

test('tu parte del daño cae en las derrotas: consejo de impacto con tu campeón', () => {
  const games = [
    ...Array.from({ length: 4 }, () => { const m = jinx('win'); return { match: m, players: players(m.id, { self: { damage_dealt: 30000 } }) }; }),
    ...Array.from({ length: 4 }, () => { const m = jinx('loss'); return { match: m, players: players(m.id, { self: { damage_dealt: 8000 } }) }; }),
  ];
  const [card] = detectDamageShare(contextOf(games));
  assert.ok(card, 'tendría que salir el consejo');
  assert.equal(card.family, 'impact');
  assert.match(card.thesis, /Jinx/);

  const even = Array.from({ length: 8 }, (_, i) => { const m = jinx(i % 2 ? 'win' : 'loss'); return { match: m, players: players(m.id, { self: { damage_dealt: 20000 } }) }; });
  assert.equal(detectDamageShare(contextOf(even)).length, 0, 'sin diferencia no hay consejo');
});

test('oro contra el rival de línea: las derrotas se arman en la línea', () => {
  const garen = result => match({ own_champion_name: 'Garen', lane: 'top', result });
  const games = [
    ...Array.from({ length: 4 }, () => { const m = garen('win'); return { match: m, players: players(m.id, { lane: 'top', self: { gold: 13000 }, rival: { gold: 12000 } }) }; }),
    ...Array.from({ length: 4 }, () => { const m = garen('loss'); return { match: m, players: players(m.id, { lane: 'top', self: { gold: 10000 }, rival: { gold: 12500 } }) }; }),
  ];
  const [card] = detectLaneGold(contextOf(games));
  assert.ok(card);
  assert.equal(card.family, 'laneEdge');
  assert.match(card.thesis, /2,5k|2\.5k/);
});

test('participación en peleas (dato del juego) baja en las derrotas', () => {
  const games = [
    ...Array.from({ length: 4 }, () => { const m = jinx('win'); return { match: m, players: players(m.id, { self: { teamfight_participation: 62 } }) }; }),
    ...Array.from({ length: 4 }, () => { const m = jinx('loss'); return { match: m, players: players(m.id, { self: { teamfight_participation: 34 } }) }; }),
  ];
  const [card] = detectFightPresence(contextOf(games));
  assert.ok(card);
  assert.equal(card.id, 'teamplay-fight-presence');
});

test('números del rol: un tanque que recibe poco del daño del equipo', () => {
  const games = Array.from({ length: 6 }, (_, i) => {
    const m = match({ own_champion_name: 'Malphite', lane: 'top', result: i % 2 ? 'win' : 'loss', items_used: TANK_BUILD });
    return { match: m, players: players(m.id, { lane: 'top', self: { damage_taken: 6000 } }) };
  });
  const [card] = detectRoleNumbers(contextOf(games));
  assert.ok(card);
  assert.equal(card.id, 'impact-role-tank');

  const solid = Array.from({ length: 6 }, (_, i) => {
    const m = match({ own_champion_name: 'Malphite', lane: 'top', result: i % 2 ? 'win' : 'loss', items_used: TANK_BUILD });
    return { match: m, players: players(m.id, { lane: 'top', self: { damage_taken: 30000 } }) };
  });
  assert.equal(detectRoleNumbers(contextOf(solid)).length, 0);
});

test('build real del rival: armadura acumulada sin penetración, con objeto sugerido', () => {
  const tankyEnemies = { items: ['Corazón de Hielo', 'Cota de Espinas'] };
  const games = [
    // Sin penetración contra 10 objetos de armadura: derrotas.
    ...Array.from({ length: 4 }, () => { const m = jinx('loss'); return { match: m, players: players(m.id, { enemies: tankyEnemies }) }; }),
    // Con Cuchilla Negra (reducción de armadura): victorias.
    ...Array.from({ length: 2 }, () => { const m = jinx('win', { items_used: ['Filo Infinito', 'Cuchilla Negra', 'Hidra Titánica'] }); return { match: m, players: players(m.id, { enemies: tankyEnemies }) }; }),
  ];
  const cards = detectEnemyItems(contextOf(games));
  const armor = cards.find(card => card.id === 'enemy-items-armor');
  assert.ok(armor, cards.map(card => card.id).join(', '));
  assert.match(armor.action, /Recordatorio Mortal|Cuchilla Negra/);
});

test('sin jugadores guardados no hay consejos nuevos', () => {
  const m = jinx('win');
  assert.deepEqual(detectParticipantInsights({ ...contextOf([{ match: m, players: [] }]), participants: [] }), []);
});
