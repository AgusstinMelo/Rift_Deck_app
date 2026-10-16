// Agrupaciones de objetivos evaluados para la página y el Dashboard.
import { LIFECYCLE, OUTCOME, PERIOD_STATUS } from './goalConstants.js';

/**
 * @typedef {{ goal: any, evaluation: import('./goalConstants.js').GoalEvaluation, checkins: any[], truncated: boolean }} GoalItem
 */

/** Activos: ciclo de vida activo y período sin cerrar (incluye programados). */
export function isCurrent(item) {
  return item.goal.lifecycle === LIFECYCLE.ACTIVE && item.evaluation.periodStatus !== PERIOD_STATUS.CLOSED;
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

/** Conteos para el resumen de objetivos activos. */
export function summarizeCurrent(current) {
  return {
    total: current.length,
    achieved: current.filter(item => item.evaluation.outcome === OUTCOME.ACHIEVED).length,
    onTrack: current.filter(item => item.evaluation.meetsToday === true).length,
    atRisk: current.filter(item => item.evaluation.meetsToday === false).length,
    scheduled: current.filter(item => item.evaluation.outcome === OUTCOME.SCHEDULED).length,
  };
}
