import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSuggestions, blankDraft, topChampions } from '../../src/features/goals/suggestions.js';
import { validateGoalInput } from '../../src/features/goals/validation/goalSchema.js';
import { describeGoal, exclusionLabel, formatDifference, formatMetricValue } from '../../src/features/goals/texts.js';
import { listMetrics } from '../../src/features/goals/metrics/index.js';
import { makeMatch } from './helpers.js';

const NOW = new Date('2026-10-15T12:00:00Z');
const TZ = 'America/Argentina/Buenos_Aires';

test('todas las sugerencias son objetivos válidos', () => {
  const matches = [makeMatch(), makeMatch(), makeMatch({ own_champion_id: 'lux', own_champion_name: 'Lux' })];
  const suggestions = buildSuggestions({ timezone: TZ, now: NOW, matches });
  assert.ok(suggestions.some(s => s.input.metric === 'porcentaje_campeones'));
  for (const suggestion of suggestions) {
    const result = validateGoalInput(suggestion.input, { now: NOW });
    assert.equal(result.success, true, `${suggestion.id}: ${JSON.stringify(/** @type {any} */ (result).errors)}`);
  }
});

test('sin partidas no se sugiere el objetivo de pool', () => {
  assert.equal(buildSuggestions({ timezone: TZ, now: NOW }).some(s => s.category === 'pool'), false);
});

test('topChampions ordena por cantidad de partidas', () => {
  const matches = [makeMatch(), makeMatch({ own_champion_name: 'Lux', own_champion_id: 'lux' }), makeMatch()];
  assert.deepEqual(topChampions(matches, 1), [{ id: 'ahri', name: 'Ahri' }]);
});

test('borradores en blanco por métrica solo fallan por el nombre faltante', () => {
  for (const metric of listMetrics()) {
    const draft = { ...blankDraft(metric.id, { timezone: TZ, now: NOW }), unit: metric.source === 'checkins' ? 'horas' : '' };
    if (metric.requiredFilters.includes('champions')) draft.filters = { champions: [{ id: 'ahri', name: 'Ahri' }] };
    const result = validateGoalInput(draft, { now: NOW });
    assert.deepEqual(Object.keys(/** @type {any} */ (result).errors), ['name'], metric.id);
  }
});

test('resumen en lenguaje natural', () => {
  const goal = { metric: 'promedio_muertes', target: 4, min_sample: 10, filters: { lanes: ['mid'] } };
  const text = describeGoal(goal, { startDate: '2026-10-01', endDate: '2026-10-31', timezone: TZ });
  assert.equal(text.objective, 'Promediar como máximo 4 muertes por partida en Mid.');
  assert.match(text.calculation.join(' '), /no se toman como cero/);
  assert.match(text.definitive, /menos de 10 partidas/);

  const pool = describeGoal(
    { metric: 'porcentaje_campeones', target: 60, min_sample: 10, filters: { champions: [{ name: 'Ahri' }, { name: 'Lux' }] } },
    { startDate: '2026-10-01', endDate: '2026-10-31', timezone: TZ },
  );
  assert.equal(pool.objective, 'Que al menos el 60% de tus partidas sean con Ahri y Lux.');
});

test('formatos de valor, diferencia y motivos', () => {
  assert.equal(formatMetricValue({ metric: 'winrate' }, 55.25), '55,3%');
  assert.equal(formatMetricValue({ metric: 'manual', unit: 'horas' }, 2.5), '2,5 horas');
  assert.equal(formatMetricValue({ metric: 'winrate' }, null), '—');
  assert.equal(formatDifference({ metric: 'promedio_muertes' }, -1.5), '−1,5 muertes');
  assert.equal(exclusionLabel({ reason: 'no_cumple_filtro', field: 'lanes' }), 'No cumple el filtro de línea');
});
