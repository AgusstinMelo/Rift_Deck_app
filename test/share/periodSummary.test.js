import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesInPeriod, summarizePeriod } from '../../src/features/share/periodSummary.js';

const NOW = new Date(2026, 10, 16, 20, 0); // 16/11/2026, hora local
let id = 0;
const m = (date, result, fields = {}) => ({
  id: ++id, date, result, own_champion_name: "Kai'Sa", lane: 'adc', kills: 5, deaths: 3, assists: 6, patch: '7.3', ...fields,
});

test('semana: últimos 7 días incluyendo hoy; mes: últimos 30', () => {
  const matches = [m('2026-11-16', 'win'), m('2026-11-10', 'loss'), m('2026-11-09', 'win'), m('2026-10-18', 'win'), m('2026-10-17', 'win')];
  const week = matchesInPeriod(matches, { period: 'week', now: NOW });
  assert.equal(week.from, '2026-11-10');
  assert.equal(week.to, '2026-11-16');
  assert.equal(week.rows.length, 2);
  assert.equal(matchesInPeriod(matches, { period: 'month', now: NOW }).rows.length, 4);
});

test('parche: solo las partidas de ese parche, con sus fechas extremas', () => {
  const matches = [m('2026-11-01', 'win', { patch: '7.2' }), m('2026-11-05', 'win'), m('2026-11-12', 'loss')];
  const result = matchesInPeriod(matches, { period: 'patch', now: NOW, patch: '7.3' });
  assert.equal(result.rows.length, 2);
  assert.equal(result.from, '2026-11-05');
  assert.equal(result.to, '2026-11-12');
  assert.equal(matchesInPeriod(matches, { period: 'patch', now: NOW, patch: '' }).rows.length, 0);
});

test('resumen: récord, winrate, KDA, campeón destacado, mejor partida y racha', () => {
  const matches = [
    m('2026-11-11', 'win', { kills: 10, deaths: 1, assists: 5 }),
    m('2026-11-12', 'win'),
    m('2026-11-13', 'win'),
    m('2026-11-14', 'loss', { own_champion_name: 'Jinx' }),
    m('2026-11-15', 'win', { own_champion_name: 'Jinx', kills: null, deaths: null, assists: null }),
  ];
  const summary = summarizePeriod(matches, { period: 'week', now: NOW });
  assert.equal(summary.games, 5);
  assert.equal(summary.wins, 4);
  assert.equal(summary.losses, 1);
  assert.equal(summary.winrate, 80);
  assert.equal(summary.topChampion.name, "Kai'Sa");
  assert.equal(summary.topChampion.games, 3);
  assert.deepEqual(summary.bestMatch, { champion: "Kai'Sa", kills: 10, deaths: 1, assists: 5, won: true });
  assert.equal(summary.winStreak, 3);
  // Promedio del KDA de cada partida, como Estadísticas: 15, 3,67 x 3 y 0 (la que no tiene K/D/A).
  assert.ok(Math.abs(summary.kda - 5.2) < 1e-9, String(summary.kda));
  assert.deepEqual(summary.totals, { kills: 25, deaths: 10, assists: 23 });
  assert.deepEqual(summary.lanes, ['adc']);
});

test('sin partidas en el período el resumen es null; las partidas sin resultado no cuentan', () => {
  assert.equal(summarizePeriod([m('2026-10-01', 'win')], { period: 'week', now: NOW }), null);
  assert.equal(summarizePeriod([m('2026-11-15', null)], { period: 'week', now: NOW }), null);
});

test('parche: toma el parche completo sin importar la letra del hotfix', () => {
  const matches = [
    m('2026-11-01', 'win', { patch: '7.3' }), m('2026-11-03', 'win', { patch: '7.3b' }),
    m('2026-11-08', 'loss', { patch: '7.3f' }), m('2026-10-20', 'win', { patch: '7.2c' }),
  ];
  assert.equal(matchesInPeriod(matches, { period: 'patch', now: NOW, patch: '7.3f' }).rows.length, 3);
  assert.equal(matchesInPeriod(matches, { period: 'patch', now: NOW, patch: '7.2' }).rows.length, 1);
});

test('tipo de partida: filtra como Estadísticas (sin tipo cargado cuenta como Clasificatoria)', () => {
  const matches = [m('2026-11-15', 'win', { type: 'ranked' }), m('2026-11-15', 'win', { type: null }), m('2026-11-14', 'loss', { type: 'casual' })];
  assert.equal(matchesInPeriod(matches, { period: 'week', now: NOW, types: ['ranked'] }).rows.length, 2);
  assert.equal(matchesInPeriod(matches, { period: 'week', now: NOW, types: ['casual'] }).rows.length, 1);
  // Combinados: Clasificatoria y Normal.
  assert.equal(matchesInPeriod(matches, { period: 'week', now: NOW, types: ['ranked', 'casual'] }).rows.length, 3);
  assert.equal(matchesInPeriod(matches, { period: 'week', now: NOW }).rows.length, 3);
});

test('campeones usados: cuenta los distintos del período; los 3 más jugados van en champions', () => {
  const now = new Date(2026, 10, 17);
  const rows = ['Ahri', 'Ahri', 'Jinx', 'Garen', 'Lux', 'Lux', 'Lux'].map(name => m('2026-11-16', 'win', { own_champion_name: name }));
  const summary = summarizePeriod(rows, { period: 'week', now });
  assert.equal(summary.championCount, 4);
  assert.deepEqual(summary.champions.map(entry => entry.name), ['Lux', 'Ahri', 'Jinx']);
});
