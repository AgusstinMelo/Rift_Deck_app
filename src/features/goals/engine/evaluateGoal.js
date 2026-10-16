// Motor de evaluación de objetivos: funciones puras, sin React ni base de datos.
import { getMetric } from '../metrics/index.js';
import { EXCLUSION_REASON, METRIC_KIND, OPERATOR, OUTCOME, PERIOD_STATUS } from '../model/goalConstants.js';
import { FILTER_RESULT, getFilter } from '../filters/filterRegistry.js';
import { periodDates, periodStatus } from './period.js';
import { playedDateOf } from './matchFacts.js';

// Tolerancia para comparar decimales (por ejemplo 66.666… contra 66.67 no debe cumplir, 60 contra 60 sí).
const EPSILON = 1e-9;

/** true si el valor cumple el target según el operador de la métrica. */
export function meetsTarget(value, target, operator) {
  if (value === null || value === undefined) return false;
  return operator === OPERATOR.LTE ? value <= target + EPSILON : value >= target - EPSILON;
}

function inPeriod(date, period) {
  return date >= period.startDate && date <= period.endDate;
}

/** Primer filtro (no consumido por la métrica) que descarta la partida, o null. */
function firstFilterRejection(match, goal, metric) {
  for (const [key, value] of Object.entries(goal.filters || {})) {
    if (metric.consumedFilters.includes(key)) continue;
    const result = getFilter(key).evaluate(match, value);
    if (result === FILTER_RESULT.MISSING) return { reason: EXCLUSION_REASON.MISSING_FILTER_DATA, field: key };
    if (result === FILTER_RESULT.MISMATCH) return { reason: EXCLUSION_REASON.FILTER_MISMATCH, field: key };
  }
  return null;
}

/** Fecha y clave de cada fila según la fuente de la métrica. */
function datedRows(metric, goal, data) {
  if (metric.source === 'checkins') {
    return (data.checkins || []).map(row => ({ row, id: String(row.id), date: String(row.checkin_date).slice(0, 10) }));
  }
  return (data.matches || []).map(row => ({
    row,
    id: String(row.id),
    date: playedDateOf(row, goal.timezone)?.date ?? null,
  }));
}

/** Clasifica cada fila en incluida (con su valor) o excluida (con su motivo). */
function classifyRows(metric, goal, data, period) {
  const contributions = [];
  const excluded = [];
  let outOfPeriodCount = 0;

  for (const { row, id, date } of datedRows(metric, goal, data)) {
    if (!date) {
      excluded.push({ id, reason: EXCLUSION_REASON.NO_DATE });
      continue;
    }
    if (!inPeriod(date, period)) {
      outOfPeriodCount += 1;
      continue;
    }
    if (metric.source === 'matches') {
      const rejection = firstFilterRejection(row, goal, metric);
      if (rejection) {
        excluded.push({ id, ...rejection });
        continue;
      }
    }
    const measurement = metric.measure(row, goal);
    if (measurement.reason) {
      excluded.push({ id, reason: measurement.reason, field: measurement.field });
      continue;
    }
    contributions.push({ id, date, value: measurement.value });
  }

  contributions.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return { contributions, excluded, outOfPeriodCount };
}

function countByReason(excluded) {
  return excluded.reduce((counts, { reason }) => {
    counts[reason] = (counts[reason] || 0) + 1;
    return counts;
  }, /** @type {Record<string, number>} */ ({}));
}

/** Resultado derivado a partir del estado del período, el valor y la muestra. */
export function deriveOutcome({ kind, status, meets, sampleSize, minSample }) {
  if (status === PERIOD_STATUS.SCHEDULED) {
    return { outcome: OUTCOME.SCHEDULED, provisional: false };
  }

  if (kind === METRIC_KIND.CUMULATIVE) {
    if (meets) return { outcome: OUTCOME.ACHIEVED, provisional: false };
    return status === PERIOD_STATUS.CLOSED
      ? { outcome: OUTCOME.NOT_ACHIEVED, provisional: false }
      : { outcome: OUTCOME.IN_PROGRESS, provisional: true };
  }

  if (status === PERIOD_STATUS.OPEN) return { outcome: OUTCOME.IN_PROGRESS, provisional: true };
  if (sampleSize < (minSample ?? 1)) return { outcome: OUTCOME.INCONCLUSIVE, provisional: false };
  return { outcome: meets ? OUTCOME.ACHIEVED : OUTCOME.NOT_ACHIEVED, provisional: false };
}

/**
 * Evalúa un objetivo.
 * @param {import('../model/goalConstants.js').GoalDefinition} goal
 * @param {{ matches?: any[], checkins?: any[] }} data
 * @param {Date} now
 * @returns {import('../model/goalConstants.js').GoalEvaluation}
 */
export function evaluateGoal(goal, data, now) {
  const metric = getMetric(goal.metric);
  const period = periodDates(goal);
  const status = periodStatus(goal, now);
  const { contributions, excluded, outOfPeriodCount } = classifyRows(metric, goal, data, period);

  const value = metric.aggregate(contributions.map(c => c.value));
  const target = Number(goal.target);
  const sampleSize = contributions.length;
  const minSample = metric.kind === METRIC_KIND.PERFORMANCE ? Number(goal.min_sample ?? metric.defaultMinSample) : null;
  const meets = meetsTarget(value, target, metric.operator);
  const { outcome, provisional } = deriveOutcome({ kind: metric.kind, status, meets, sampleSize, minSample });

  const isOpenPerformance = metric.kind === METRIC_KIND.PERFORMANCE && status === PERIOD_STATUS.OPEN;

  return {
    outcome,
    provisional,
    meetsToday: isOpenPerformance ? meets && sampleSize >= minSample : null,
    value,
    target,
    difference: value === null ? null : value - target,
    sampleSize,
    minSample,
    includedIds: contributions.map(c => c.id),
    excluded,
    exclusionCounts: countByReason(excluded),
    contributions,
    outOfPeriodCount,
    periodStatus: status,
    period,
    kind: metric.kind,
    operator: metric.operator,
  };
}

/** Cuánto falta para el target en métricas acumulativas (nunca negativo). */
export function remainingToTarget(evaluation) {
  if (evaluation.kind !== METRIC_KIND.CUMULATIVE) return null;
  return Math.max(0, evaluation.target - (evaluation.value ?? 0));
}

/** Avance 0–100 de una métrica acumulativa, para barras de progreso. */
export function cumulativeProgressPct(evaluation) {
  if (evaluation.kind !== METRIC_KIND.CUMULATIVE || evaluation.target <= 0) return null;
  return Math.min(100, ((evaluation.value ?? 0) / evaluation.target) * 100);
}
