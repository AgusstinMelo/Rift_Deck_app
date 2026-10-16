import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGoal } from '../../src/features/goals/engine/evaluateGoal.js';
import { evolutionSeries } from '../../src/features/goals/engine/evolution.js';
import { aggregationsFor, findMetric, listMetrics, listStats } from '../../src/features/goals/metrics/index.js';
import { describeGoal } from '../../src/features/goals/texts.js';
import { AFTER_CLOSE, MID_PERIOD, makeGoal, makeMatch } from './helpers.js';

test('cada combinación dato × cálculo corresponde a una sola métrica', () => {
  const pairs = listMetrics().map(metric => `${metric.stat}:${metric.aggregation}`);
  assert.equal(new Set(pairs).size, pairs.length);
  for (const stat of listStats()) {
    for (const aggregation of aggregationsFor(stat)) {
      assert.equal(findMetric(stat, aggregation)?.stat, stat);
    }
  }
});

test('cada tipo de cálculo tiene al menos un dato que lo admite (el formulario siempre puede cambiar)', () => {
  for (const aggregation of ['total', 'promedio', 'mejor_partida', 'porcentaje']) {
    assert.ok(listStats().some(stat => aggregationsFor(stat).includes(aggregation)), aggregation);
  }
});

test('las métricas existentes conservan su id dentro de la grilla', () => {
  assert.equal(findMetric('victorias', 'porcentaje').id, 'winrate');
  assert.equal(findMetric('partidas', 'total').id, 'partidas_registradas');
  assert.equal(findMetric('muertes', 'promedio').id, 'promedio_muertes');
  assert.equal(findMetric('kda', 'total'), null, 'sumar KDA no tiene sentido y no existe');
  assert.deepEqual(aggregationsFor('asesinatos').sort(), ['mejor_partida', 'promedio', 'total']);
});

test('total: suma el dato de cada partida, excluye los ausentes y se alcanza antes del cierre', () => {
  const data = { matches: [makeMatch({ kills: 10 }), makeMatch({ kills: 7 }), makeMatch({ id: 'x', kills: null })] };
  const goal = makeGoal({ metric: 'suma_asesinatos', target: 15 });
  const result = evaluateGoal(goal, data, MID_PERIOD);
  assert.equal(result.value, 17);
  assert.equal(result.outcome, 'alcanzado');
  assert.deepEqual(result.excluded.map(e => e.reason), ['sin_asesinatos']);
  assert.deepEqual(evolutionSeries(goal.metric, result.contributions).map(p => p.value), [17]);
});

test('tiempo jugado: suma de duraciones', () => {
  const data = { matches: [makeMatch({ duration_minutes: 20 }), makeMatch({ duration_minutes: 25, date: '2026-10-12' })] };
  const result = evaluateGoal(makeGoal({ metric: 'suma_duracion', target: 60 }), data, AFTER_CLOSE);
  assert.equal(result.value, 45);
  assert.equal(result.outcome, 'no_alcanzado');
});

test('mejor partida: alcanza con una sola partida que llegue a la meta', () => {
  const goal = makeGoal({ metric: 'max_asesinatos', target: 15 });
  const before = evaluateGoal(goal, { matches: [makeMatch({ kills: 9 }), makeMatch({ kills: 12 })] }, MID_PERIOD);
  assert.equal(before.value, 12);
  assert.equal(before.outcome, 'en_curso');

  const after = evaluateGoal(goal, { matches: [makeMatch({ kills: 9 }), makeMatch({ kills: 16 })] }, MID_PERIOD);
  assert.equal(after.value, 16);
  assert.equal(after.outcome, 'alcanzado');
  assert.equal(after.provisional, false);
});

test('mejor partida de KDA usa la misma fórmula que Estadísticas', () => {
  const data = { matches: [makeMatch({ kills: 5, deaths: 0, assists: 7 }), makeMatch({ kills: 4, deaths: 2, assists: 4 })] };
  assert.equal(evaluateGoal(makeGoal({ metric: 'max_kda', target: 10 }), data, MID_PERIOD).value, 12);
});

test('frases en lenguaje natural según el cálculo', () => {
  const period = { startDate: '2026-10-01', endDate: '2026-10-31', timezone: 'UTC' };
  assert.equal(describeGoal({ metric: 'suma_asesinatos', target: 100, filters: {} }, period).objective, 'Sumar al menos 100 asesinatos en total.');
  assert.equal(describeGoal({ metric: 'max_asesinatos', target: 15, filters: {} }, period).objective, 'Lograr una partida con al menos 15 asesinatos.');
  assert.equal(describeGoal({ metric: 'suma_duracion', target: 300, filters: {} }, period).objective, 'Jugar al menos 300 min en total.');
  assert.match(describeGoal({ metric: 'max_oro', target: 18000, filters: {} }, period).calculation.join(' '), /mejor partida/);
});
