// Agrupaciones de objetivos evaluados para la página y el Dashboard.
import { LIFECYCLE, OUTCOME, PERIOD_STATUS } from './goalConstants.js';
import { inclusiveDayCount, todayIn } from '../engine/period.js';

/** Días (incluido hoy) que se consideran "por vencer". */
const DUE_SOON_DAYS = 3;

/**
 * @typedef {{ goal: any, evaluation: import('./goalConstants.js').GoalEvaluation, checkins: any[], truncated: boolean }} GoalItem
 */

/**
 * Finalizado (derivado, nunca persistido): el período cerró o el objetivo ya está alcanzado.
 * Un acumulativo o único alcanzado antes del cierre queda finalizado; si después se borran
 * los datos que lo cumplían, vuelve a estar en curso automáticamente.
 * @param {import('./goalConstants.js').GoalEvaluation} evaluation
 */
export function isFinished(evaluation) {
  return evaluation.periodStatus === PERIOD_STATUS.CLOSED || evaluation.outcome === OUTCOME.ACHIEVED;
}

/** Activos: ciclo de vida activo y todavía en juego (incluye programados). */
export function isCurrent(item) {
  return item.goal.lifecycle === LIFECYCLE.ACTIVE && !isFinished(item.evaluation);
}

/**
 * @param {GoalItem[]} items
 * @returns {{ current: GoalItem[], finished: GoalItem[], archived: GoalItem[] }}
 */
export function partitionGoals(items) {
  const current = [];
  const finished = [];
  const archived = [];
  items.forEach(item => {
    if (item.goal.lifecycle === LIFECYCLE.ARCHIVED) archived.push(item);
    else if (isCurrent(item)) current.push(item);
    else finished.push(item);
  });

  const byEnd = (a, b) => b.goal.period_end.localeCompare(a.goal.period_end);
  current.sort((a, b) => a.goal.period_end.localeCompare(b.goal.period_end));
  finished.sort(byEnd);
  archived.sort(byEnd);
  return { current, finished, archived };
}

/** true si el período está abierto y cierra dentro de los próximos días. */
export function isDueSoon(item, now = new Date()) {
  if (item.evaluation.periodStatus !== PERIOD_STATUS.OPEN) return false;
  const today = todayIn(item.goal.timezone, now);
  return inclusiveDayCount(today, item.evaluation.period.endDate) <= DUE_SOON_DAYS;
}

/** Conteos para el resumen de objetivos activos. */
export function summarizeCurrent(current, now = new Date()) {
  return {
    total: current.length,
    dueSoon: current.filter(item => isDueSoon(item, now)).length,
    onTrack: current.filter(item => item.evaluation.meetsToday === true).length,
    atRisk: current.filter(item => item.evaluation.meetsToday === false).length,
    scheduled: current.filter(item => item.evaluation.outcome === OUTCOME.SCHEDULED).length,
  };
}
