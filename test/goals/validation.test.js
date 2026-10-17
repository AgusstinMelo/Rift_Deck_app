import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGoalInput, validateGoalUpdate, toGoalRecord, editPermissions } from '../../src/features/goals/validation/goalSchema.js';
import { validateCheckinInput } from '../../src/features/goals/validation/checkinSchema.js';
import { listMetrics, registerMetric } from '../../src/features/goals/metrics/index.js';
import { makeGoal } from './helpers.js';

const NOW = new Date('2026-10-15T12:00:00Z');

const base = (overrides = {}) => ({
  name: 'Mi objetivo',
  description: '',
  metric: 'winrate',
  target: 55,
  minSample: 10,
  unit: '',
  filters: {},
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  timezone: 'America/Argentina/Buenos_Aires',
  ...overrides,
});

const errorsOf = input => {
  const result = validateGoalInput(input, { now: NOW });
  assert.equal(result.success, false, 'se esperaba un error de validación');
  return /** @type {{ errors: Record<string, string> }} */ (result).errors;
};

test('entrada válida se normaliza y se convierte en fila', () => {
  const result = validateGoalInput(base({ filters: { lanes: ['mid'], types: [] } }), { now: NOW });
  assert.equal(result.success, true);
  const record = toGoalRecord(/** @type {any} */ (result).data);
  assert.deepEqual(record.filters, { lanes: ['mid'] });
  assert.equal(record.description, null);
  assert.equal(record.unit, null);
  assert.equal(record.period_start, '2026-10-01T03:00:00.000Z');
  assert.equal(record.period_end, '2026-11-01T02:59:59.999Z');
});

test('las métricas acumulativas descartan la muestra mínima', () => {
  const result = validateGoalInput(base({ metric: 'partidas_registradas', target: 10, minSample: 7 }), { now: NOW });
  assert.equal(/** @type {any} */ (result).data.minSample, null);
});

test('combinaciones de métrica y filtro incompatibles', () => {
  assert.match(errorsOf(base({ metric: 'manual', target: 5, unit: 'horas', minSample: null, filters: { lanes: ['mid'] } }))['filters.lanes'], /no es compatible/);
  assert.match(errorsOf(base({ filters: { inventado: ['x'] } }))['filters.inventado'], /no es compatible/);
  assert.ok(errorsOf(base({ metric: 'porcentaje_campeones', target: 60, filters: {} }))['filters.champions']);
  assert.ok(errorsOf(base({ filters: { lanes: ['bot'] } }))['filters.lanes.0']);
  assert.ok(errorsOf(base({ filters: { types: ['aram'] } }))['filters.types.0']);
});

test('fechas inválidas', () => {
  assert.ok(errorsOf(base({ startDate: '2026-02-30' })).startDate);
  assert.ok(errorsOf(base({ endDate: 'mañana' })).endDate);
  assert.match(errorsOf(base({ startDate: '2026-10-20', endDate: '2026-10-10' })).endDate, /posterior/);
  assert.match(errorsOf(base({ startDate: '2026-01-01', endDate: '2027-01-05' })).endDate, /366/);
  assert.match(errorsOf(base({ startDate: '2026-09-01', endDate: '2026-10-14' })).endDate, /pasado/);
  assert.ok(errorsOf(base({ timezone: 'Mars/Olympus' })).timezone);
});

test('targets fuera de rango', () => {
  assert.ok(errorsOf(base({ target: 120 })).target);
  assert.ok(errorsOf(base({ target: 0 })).target);
  assert.ok(errorsOf(base({ target: '' })).target);
  assert.ok(errorsOf(base({ target: 55.555 })).target);
  assert.ok(errorsOf(base({ metric: 'partidas_registradas', target: 2.5 })).target);
  assert.ok(errorsOf(base({ metric: 'partidas_registradas', target: 5000 })).target);
  assert.ok(errorsOf(base({ metric: 'promedio_muertes', target: 0 })).target);
  assert.ok(errorsOf(base({ minSample: 0 })).minSample);
  assert.ok(errorsOf(base({ minSample: null })).minSample);
  assert.ok(errorsOf(base({ metric: 'manual', target: 5, unit: '' })).unit);
  assert.ok(errorsOf(base({ name: '   ' })).name);
});

test('edición: la métrica no se puede cambiar', () => {
  const goal = makeGoal({ metric: 'winrate', target: 55, minSample: 10 });
  const result = validateGoalUpdate(goal, { metric: 'promedio_muertes' }, { now: NOW });
  assert.equal(result.success, false);
});

test('edición con período abierto recalcula límites', () => {
  const goal = makeGoal({ metric: 'winrate', target: 55, minSample: 10, timezone: 'UTC' });
  const result = validateGoalUpdate(goal, { target: 60, endDate: '2026-11-15' }, { now: NOW });
  assert.equal(result.success, true);
  assert.equal(/** @type {any} */ (result).patch.target, 60);
  assert.equal(/** @type {any} */ (result).patch.period_end, '2026-11-15T23:59:59.999Z');
  assert.equal('metric' in /** @type {any} */ (result).patch, false);
});

test('edición con período cerrado: solo nombre y descripción', () => {
  const goal = makeGoal({ metric: 'winrate', target: 55, minSample: 10, startDate: '2026-09-01', endDate: '2026-09-30' });
  assert.equal(editPermissions(goal, NOW).canEditConfig, false);
  assert.equal(editPermissions(goal, NOW).canArchive, true);
  assert.equal(validateGoalUpdate(goal, { target: 40 }, { now: NOW }).success, false);

  const rename = validateGoalUpdate(goal, { name: 'Nuevo nombre', description: 'Algo' }, { now: NOW });
  assert.deepEqual(/** @type {any} */ (rename).patch, { name: 'Nuevo nombre', description: 'Algo' });
});

test('objetivo cancelado no admite cambios de configuración', () => {
  const goal = makeGoal({ metric: 'winrate', target: 55, minSample: 10, lifecycle: 'cancelado' });
  assert.equal(validateGoalUpdate(goal, { minSample: 20 }, { now: NOW }).success, false);
});

test('check-ins: cantidad, fecha dentro del período y no futura', () => {
  const goal = makeGoal({ metric: 'manual', target: 10, unit: 'horas', timezone: 'UTC' });
  assert.equal(validateCheckinInput(goal, { amount: '1.5', date: '2026-10-10', note: '' }, { now: NOW }).success, true);
  const errors = input => /** @type {any} */ (validateCheckinInput(goal, input, { now: NOW })).errors;
  assert.ok(errors({ amount: 0, date: '2026-10-10' }).amount);
  assert.ok(errors({ amount: -2, date: '2026-10-10' }).amount);
  assert.ok(errors({ amount: '', date: '2026-10-10' }).amount);
  assert.match(errors({ amount: 1, date: '2026-09-30' }).date, /período/);
  assert.match(errors({ amount: 1, date: '2026-10-20' }).date, /futura/);
});

test('el registro rechaza métricas mal definidas o duplicadas', () => {
  assert.ok(listMetrics().length >= 5);
  assert.throws(() => registerMetric(/** @type {any} */ ({ ...listMetrics()[0] })), /duplicada/);
  assert.throws(() => registerMetric(/** @type {any} */ ({
    ...listMetrics()[1], id: 'kda_rota', allowedFilters: ['inexistente'],
  })), /inexistente/);
});
