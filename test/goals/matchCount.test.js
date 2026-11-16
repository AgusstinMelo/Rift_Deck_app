import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGoal } from '../../src/features/goals/engine/evaluateGoal.js';
import { validateGoalInput } from '../../src/features/goals/validation/goalSchema.js';
import { aggregationsFor, findMetric, getMetric, listStats } from '../../src/features/goals/metrics/index.js';
import { describeGoal } from '../../src/features/goals/texts.js';
import { MID_PERIOD, makeGoal, makeMatch } from './helpers.js';

const NOW = new Date('2026-10-15T12:00:00Z');
const countGoal = (metric, target, condition, filters = {}) =>
  makeGoal({ metric, target, filters: { ...filters, condition } });

test('cada dato ofrece solo sus propios cálculos y cada combinación existe', () => {
  for (const stat of listStats()) {
    for (const aggregation of aggregationsFor(stat)) {
      assert.equal(findMetric(stat, aggregation)?.stat, stat, `${stat} × ${aggregation}`);
    }
  }
  assert.ok(!aggregationsFor('muertes').includes('porcentaje'));
  assert.ok(aggregationsFor('muertes').includes('partidas_que_cumplen'));
});

test('partidas con 0 muertes: cuenta solo las partidas sin morir y excluye las que no tienen el dato', () => {
  const data = {
    matches: [
      makeMatch({ id: 'a', deaths: 0 }),
      makeMatch({ id: 'b', deaths: 0 }),
      makeMatch({ id: 'c', deaths: 1 }),
      makeMatch({ id: 'd', deaths: null }),
    ],
  };
  const result = evaluateGoal(countGoal('partidas_muertes', 2, { op: 'lte', value: 0 }), data, MID_PERIOD);
  assert.equal(result.value, 2);
  assert.equal(result.outcome, 'alcanzado');
  assert.deepEqual(result.excluded.map(e => e.reason), ['sin_muertes']);
});

test('partidas con KDA de 6 o más y con 10 asesinatos o más', () => {
  const data = {
    matches: [
      makeMatch({ id: 'a', kills: 10, deaths: 2, assists: 2 }), // KDA 6
      makeMatch({ id: 'b', kills: 12, deaths: 1, assists: 0 }), // KDA 12
      makeMatch({ id: 'c', kills: 5, deaths: 2, assists: 2 }), // KDA 3.5
    ],
  };
  const kda = evaluateGoal(countGoal('partidas_kda', 10, { op: 'gte', value: 6 }), data, MID_PERIOD);
  assert.equal(kda.value, 2);
  assert.equal(kda.outcome, 'en_curso');

  const kills = evaluateGoal(countGoal('partidas_asesinatos', 20, { op: 'gte', value: 11 }), data, MID_PERIOD);
  assert.equal(kills.value, 1);
});

test('la condición no descarta partidas por sí misma, pero los demás filtros sí', () => {
  const data = { matches: [makeMatch({ id: 'a', deaths: 0, lane: 'mid' }), makeMatch({ id: 'b', deaths: 0, lane: 'top' })] };
  const result = evaluateGoal(countGoal('partidas_muertes', 5, { op: 'lte', value: 0 }, { lanes: ['mid'] }), data, MID_PERIOD);
  assert.equal(result.value, 1);
  assert.deepEqual(result.excluded.map(e => e.reason), ['no_cumple_filtro']);
});

const input = (overrides = {}) => ({
  name: 'Sin morir',
  metric: 'partidas_muertes',
  target: 10,
  minSample: null,
  filters: { condition: { op: 'lte', value: '0' } },
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  timezone: 'UTC',
  ...overrides,
});

test('validación: exige la condición, respeta su rango y la guarda como número', () => {
  const ok = validateGoalInput(input(), { now: NOW });
  assert.equal(ok.success, true);
  assert.deepEqual(ok.data.filters.condition, { op: 'lte', value: 0 });

  const missing = validateGoalInput(input({ filters: {} }), { now: NOW });
  assert.equal(missing.success, false);
  assert.ok(Object.keys(missing.errors).some(key => key.startsWith('filters.condition')));

  const outOfRange = validateGoalInput(input({ filters: { condition: { op: 'lte', value: 99 } } }), { now: NOW });
  assert.equal(outOfRange.success, false);
  assert.ok(outOfRange.errors['filters.condition']);

  const empty = validateGoalInput(input({ filters: { condition: { op: 'lte', value: '' } } }), { now: NOW });
  assert.equal(empty.success, false);

  const decimalsOnInteger = validateGoalInput(input({ filters: { condition: { op: 'gte', value: 1.5 } } }), { now: NOW });
  assert.equal(decimalsOnInteger.success, false);

  const kdaDecimals = validateGoalInput(input({ metric: 'partidas_kda', filters: { condition: { op: 'gte', value: 6.5 } } }), { now: NOW });
  assert.equal(kdaDecimals.success, true);
});

test('la condición solo se admite en las métricas "partidas que cumplen"', () => {
  const result = validateGoalInput(input({ metric: 'promedio_muertes', minSample: 10, target: 4 }), { now: NOW });
  assert.equal(result.success, false);
  assert.ok(result.errors['filters.condition']);
});

test('descripción: frase del objetivo con la condición', () => {
  const period = { startDate: '2026-10-01', endDate: '2026-10-31', timezone: 'UTC' };
  const noDeaths = describeGoal(countGoal('partidas_muertes', 10, { op: 'lte', value: 0 }), period);
  assert.match(noDeaths.objective, /10 partidas sin morir/);
  const kda = describeGoal(countGoal('partidas_kda', 10, { op: 'gte', value: 6 }), period);
  assert.match(kda.objective, /con KDA de 6 o más/);
  const kills = describeGoal(countGoal('partidas_asesinatos', 20, { op: 'gte', value: 10 }), period);
  assert.match(kills.objective, /20 partidas con 10 asesinatos o más/);
  const oneDeath = describeGoal(countGoal('partidas_muertes', 8, { op: 'lte', value: 1 }), period);
  assert.match(oneDeath.objective, /8 partidas con 1 muerte o menos/);
  assert.equal(getMetric('partidas_asesinatos').kind, 'acumulativa');
});
