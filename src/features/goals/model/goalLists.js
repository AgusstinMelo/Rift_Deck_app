// Agrupaciones de objetivos evaluados para la página y el Dashboard.
import { LIFECYCLE, OUTCOME, PERIOD_STATUS } from './goalConstants.js';

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

/**
 * Objetivos alcanzados en total (finalizados y archivados; los cancelados no cuentan).
 * Como un objetivo alcanzado pasa a finalizado, se cuenta sobre todos los objetivos.
 * @param {GoalItem[]} items
 */
export function countAchieved(items) {
  return items.filter(item => item.goal.lifecycle !== LIFECYCLE.CANCELLED && item.evaluation.outcome === OUTCOME.ACHIEVED).length;
}

/**
 * Conteos para el resumen de objetivos.
 * @param {GoalItem[]} current  Objetivos activos.
 * @param {GoalItem[]} all      Todos los objetivos, para contar los alcanzados.
 */
export function summarizeCurrent(current, all = current) {
  return {
    total: current.length,
    achieved: countAchieved(all),
    onTrack: current.filter(item => item.evaluation.meetsToday === true).length,
    atRisk: current.filter(item => item.evaluation.meetsToday === false).length,
    scheduled: current.filter(item => item.evaluation.outcome === OUTCOME.SCHEDULED).length,
  };
}
