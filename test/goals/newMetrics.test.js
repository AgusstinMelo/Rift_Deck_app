import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGoal } from '../../src/features/goals/engine/evaluateGoal.js';
import { validateGoalInput, validateGoalUpdate, toGoalRecord, goalToInput } from '../../src/features/goals/validation/goalSchema.js';
import { listMetrics, operatorOf } from '../../src/features/goals/metrics/index.js';
import { buildSuggestions } from '../../src/features/goals/suggestions.js';
import { describeGoal } from '../../src/features/goals/texts.js';
import { AFTER_CLOSE, MID_PERIOD, makeGoal, makeMatch, matches } from './helpers.js';

const NOW = new Date('2026-10-15T12:00:00Z');
const perf = (metric, target, extra = {}) => makeGoal({ metric, target, minSample: 1, ...extra });

test('todas las métricas declaran familia y direcciones válidas; las acumulativas tienen dirección fija', () => {
  for (const metric of listMetrics()) {
    assert.ok(metric.family, metric.id);
    assert.ok(metric.operators.includes(metric.operator), metric.id);
    if (metric.kind === 'acumulativa') {
      assert.equal(metric.operators.length, 1, metric.id);
      // Solo los objetivos únicos "con menos" (sin morir, victoria rápida) apuntan a "como máximo".
      if (metric.operator === 'lte') assert.equal(metric.aggregation, 'mejor_partida', metric.id);
    }
  }
});

test('victorias: cuenta solo las ganadas y excluye las sin resultado', () => {
  const data = { matches: [...matches(3, { result: 'win' }), ...matches(2, { result: 'loss' }), makeMatch({ id: 'x', result: null })] };
  const result = evaluateGoal(makeGoal({ metric: 'victorias', target: 3 }), data, MID_PERIOD);
  assert.equal(result.value, 3);
  assert.equal(result.outcome, 'alcanzado');
  assert.deepEqual(result.excluded.map(e => e.reason), ['sin_resultado']);
});

test('KDA promedio: promedia el KDA de cada partida y excluye las que no tienen K, D y A', () => {
  const data = {
    matches: [
      makeMatch({ id: 'a', kills: 6, deaths: 2, assists: 4 }), // 5
      makeMatch({ id: 'b', kills: 2, deaths: 0, assists: 1 }), // 3 (sin muertes: K + A)
      makeMatch({ id: 'c', kills: 3, deaths: null, assists: 3 }),
    ],
  };
  const result = evaluateGoal(perf('promedio_kda', 4), data, AFTER_CLOSE);
  assert.equal(result.value, 4);
  assert.equal(result.outcome, 'alcanzado');
  assert.deepEqual(result.excluded, [{ id: 'c', reason: 'sin_kda', field: 'kda' }]);
});

test('oro y duración: 0 o vacío se consideran no registrados', () => {
  const data = {
    matches: [
      makeMatch({ id: 'a', gold: 9000, duration_minutes: 16 }),
      makeMatch({ id: 'b', gold: 11000, duration_minutes: 20 }),
      makeMatch({ id: 'c', gold: 0, duration_minutes: null }),
    ],
  };
  const gold = evaluateGoal(perf('promedio_oro', 10000), data, AFTER_CLOSE);
  assert.equal(gold.value, 10000);
  assert.equal(gold.exclusionCounts.sin_oro, 1);

  const duration = evaluateGoal(perf('promedio_duracion', 18), data, AFTER_CLOSE);
  assert.equal(duration.value, 18);
  assert.equal(duration.operator, 'lte', 'la duración apunta por defecto a "como máximo"');
  assert.equal(duration.outcome, 'alcanzado');
  assert.equal(duration.exclusionCounts.sin_duracion, 1);
});

test('asesinatos y asistencias promedio', () => {
  const data = { matches: [makeMatch({ kills: 4, assists: 10 }), makeMatch({ kills: 8, assists: 6 }), makeMatch({ kills: null, assists: null })] };
  assert.equal(evaluateGoal(perf('promedio_asesinatos', 6), data, AFTER_CLOSE).value, 6);
  assert.equal(evaluateGoal(perf('promedio_asistencias', 8), data, AFTER_CLOSE).value, 8);
});

test('dirección configurable: la misma duración cumple o no según "al menos" / "como máximo"', () => {
  const data = { matches: [makeMatch({ duration_minutes: 22 }), makeMatch({ duration_minutes: 24 })] };
  const atMost = evaluateGoal({ ...perf('promedio_duracion', 20), operator: 'lte' }, data, AFTER_CLOSE);
  const atLeast = evaluateGoal({ ...perf('promedio_duracion', 20), operator: 'gte' }, data, AFTER_CLOSE);
  assert.equal(atMost.outcome, 'no_alcanzado');
  assert.equal(atLeast.outcome, 'alcanzado');
});

test('objetivos guardados antes de la columna operator usan la dirección por defecto de la métrica', () => {
  assert.equal(operatorOf({ metric: 'promedio_muertes' }), 'lte');
  assert.equal(operatorOf({ metric: 'winrate', operator: null }), 'gte');
  assert.equal(operatorOf({ metric: 'partidas_registradas', operator: 'lte' }), 'gte', 'una dirección no admitida se ignora');
});

test('validación de la dirección', () => {
  const base = {
    name: 'x', description: '', minSample: 10, unit: '', filters: {},
    startDate: '2026-10-01', endDate: '2026-10-31', timezone: 'UTC',
  };
  const ok = validateGoalInput({ ...base, metric: 'winrate', operator: 'lte', target: 45 }, { now: NOW });
  assert.equal(ok.success, true);
  assert.equal(toGoalRecord(/** @type {any} */ (ok).data).operator, 'lte');

  const defaulted = validateGoalInput({ ...base, metric: 'promedio_muertes', target: 4 }, { now: NOW });
  assert.equal(/** @type {any} */ (defaulted).data.operator, 'lte');

  const bad = validateGoalInput({ ...base, metric: 'victorias', operator: 'lte', target: 5, minSample: null }, { now: NOW });
  assert.equal(bad.success, false);
  assert.ok(/** @type {any} */ (bad).errors.operator);
});

test('cambiar la dirección es reconfigurar: solo con el período abierto', () => {
  const open = { ...makeGoal({ metric: 'promedio_duracion', target: 20, minSample: 10 }), operator: 'lte' };
  assert.equal(goalToInput(open).operator, 'lte');
  const changed = validateGoalUpdate(open, { operator: 'gte' }, { now: NOW });
  assert.equal(/** @type {any} */ (changed).patch.operator, 'gte');

  const closed = { ...makeGoal({ metric: 'promedio_duracion', target: 20, minSample: 10, startDate: '2026-09-01', endDate: '2026-09-30' }), operator: 'lte' };
  assert.equal(validateGoalUpdate(closed, { operator: 'gte' }, { now: NOW }).success, false);
});

test('las sugerencias se agrupan por familia y la frase usa la dirección elegida', () => {
  const suggestions = buildSuggestions({ timezone: 'UTC', now: NOW, matches: [makeMatch()] });
  const families = new Set(suggestions.map(s => s.category));
  assert.deepEqual([...families].sort(), ['acumulativos', 'mejor_partida', 'porcentajes', 'promedios']);

  const period = { startDate: '2026-10-01', endDate: '2026-10-31', timezone: 'UTC' };
  assert.equal(
    describeGoal({ metric: 'promedio_duracion', operator: 'gte', target: 20, min_sample: 10, filters: {} }, period).objective,
    'Que tus partidas duren en promedio al menos 20 min.',
  );
  assert.equal(
    describeGoal({ metric: 'promedio_oro', target: 10000, min_sample: 10, filters: {} }, period).objective,
    'Promediar al menos 10.000 de oro por partida.',
  );
});
