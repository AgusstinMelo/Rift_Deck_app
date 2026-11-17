// Pool de la semana: "esta semana jugá X e Y", insight del día los lunes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCoachReport } from '../../src/features/coach/engine.js';
import { weekKeyOf } from '../../src/features/coach/detectors/weekly.js';
import { catalog, many } from './fixtures.js';

const MONDAY = new Date(2026, 10, 16, 12, 0);
const TUESDAY = new Date(2026, 10, 17, 12, 0);
const TIERLIST = [
  { champion_name: 'Garen', lane: 'top', tier: 'S', position_in_lane: 2, previous_position_in_lane: 6, banrate: 31 },
  { champion_name: 'Aatrox', lane: 'top', tier: 'A', position_in_lane: 8, previous_position_in_lane: 8, banrate: 4 },
  { champion_name: 'Darius', lane: 'top', tier: 'B', position_in_lane: 20, previous_position_in_lane: 18, banrate: 2 },
];
// Top: Garen y Aatrox rinden; Darius, muy jugado, te resta.
const MATCHES = [
  ...many(7, { own_champion_name: 'Garen', result: 'win' }, 1), ...many(2, { own_champion_name: 'Garen', result: 'loss' }, 8),
  ...many(5, { own_champion_name: 'Aatrox', result: 'win' }, 10), ...many(2, { own_champion_name: 'Aatrox', result: 'loss' }, 15),
  ...many(2, { own_champion_name: 'Darius', result: 'win' }, 17), ...many(6, { own_champion_name: 'Darius', result: 'loss' }, 19),
];
const report = (now, extra = {}) => computeCoachReport({ matches: MATCHES, ...catalog, tierlist: TIERLIST, now, limit: 20, ...extra });
const weekly = insights => insights.find(card => card.family === 'weeklyPicks');

test('pool semanal: recomienda los dos que mejor te rinden y deja afuera al que te hace perder', () => {
  const card = weekly(report(TUESDAY).insights);
  assert.ok(card, 'tiene que haber recomendación semanal');
  assert.match(card.title, /Garen/);
  assert.match(card.title, /Aatrox/);
  assert.doesNotMatch(card.title, /Darius/);
  // Darius, muy jugado y por debajo de tu promedio: para normales.
  assert.match(card.action, /Darius/);
  // Garen se banea en el 31%: plan B.
  assert.match(card.action, /31%/);
  // Tier y tendencia de la tierlist en la explicación.
  assert.match(card.thesis, /tier S/);
});

test('pool semanal: los lunes es el insight del día (primero del informe)', () => {
  const monday = report(MONDAY, { limit: 1 }).insights;
  assert.equal(monday[0].family, 'weeklyPicks');
  const tuesday = report(TUESDAY, { limit: 1 }).insights;
  assert.notEqual(tuesday[0].family, 'weeklyPicks');
});

test('pool semanal: una tarjeta por semana (clave por lunes) y funciona sin tierlist', () => {
  assert.equal(weekKeyOf(MONDAY), '2026-11-16');
  assert.equal(weekKeyOf(new Date(2026, 10, 22, 23, 0)), '2026-11-16'); // domingo de esa semana
  assert.equal(weekly(report(TUESDAY).insights).id, 'weekly-picks-2026-11-16');
  const noTier = weekly(computeCoachReport({ matches: MATCHES, ...catalog, now: TUESDAY, limit: 20 }).insights);
  assert.ok(noTier);
  assert.doesNotMatch(noTier.thesis, /tier/);
});

test('pool semanal: con pocas partidas en la línea no hay recomendación', () => {
  const few = computeCoachReport({ matches: many(4, { own_champion_name: 'Garen', result: 'win' }), ...catalog, tierlist: TIERLIST, now: MONDAY, limit: 20 });
  assert.equal(weekly(few.insights), undefined);
});
