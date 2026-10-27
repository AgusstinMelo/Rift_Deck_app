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

/**
 * Objetivos que cuentan para el límite de la cuenta free: ciclo de vida activo y
 * período sin cerrar. Es la misma regla que aplica la base al crear un objetivo,
 * por eso no usa la evaluación (un objetivo alcanzado antes de tiempo sigue contando).
 * @param {any[]} goals
 * @param {Date} [now]
 */
export function countOpenGoals(goals, now = new Date()) {
  return goals.filter(goal => goal.lifecycle === LIFECYCLE.ACTIVE && new Date(goal.period_end) > now).length;
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

/** true si el período está abierto y cierra dentro de los próximos días. */
export function isDueSoon(item, now = new Date()) {
  if (item.evaluation.periodStatus !== PERIOD_STATUS.OPEN) return false;
  const today = todayIn(item.goal.timezone, now);
  return inclusiveDayCount(today, item.evaluation.period.endDate) <= DUE_SOON_DAYS;
}

/**
 * Tasa de logro: alcanzados sobre finalizados con resultado definitivo (alcanzado o no alcanzado).
 * No cuenta los no concluyentes ni los cancelados. null si todavía no hay ninguno.
 * @param {GoalItem[]} items
 */
export function successRate(items) {
  const decided = items.filter(item => item.goal.lifecycle !== LIFECYCLE.CANCELLED
    && isFinished(item.evaluation)
    && /** @type {string[]} */ ([OUTCOME.ACHIEVED, OUTCOME.NOT_ACHIEVED]).includes(item.evaluation.outcome));
  if (decided.length === 0) return null;
  return (decided.filter(item => item.evaluation.outcome === OUTCOME.ACHIEVED).length / decided.length) * 100;
}

/**
 * Conteos para el resumen de objetivos.
 * @param {GoalItem[]} current  Objetivos activos.
 * @param {GoalItem[]} all      Todos los objetivos (alcanzados y tasa de logro son históricos).
 * @param {Date} [now]
 */
export function summarizeCurrent(current, all = current, now = new Date()) {
  return {
    total: current.length,
    scheduled: current.filter(item => item.evaluation.outcome === OUTCOME.SCHEDULED).length,
    dueSoon: current.filter(item => isDueSoon(item, now)).length,
    achieved: countAchieved(all),
    successRate: successRate(all),
  };
}
