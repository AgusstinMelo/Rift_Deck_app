// Registro de métricas de objetivos. Una métrica nueva solo necesita una
// definición tipada (operador, tipo, filtros, rangos) y sus funciones
// `measure` y `aggregate`; el motor no cambia.
import { AGGREGATION, METRIC_FAMILY, METRIC_KIND, OPERATOR } from '../model/goalConstants.js';
import { listFilterKeys } from '../filters/filterRegistry.js';

/**
 * @typedef {Object} Measurement
 * @property {number} [value]   Valor de la fila para la métrica.
 * @property {string} [reason]  Motivo de exclusión si falta el dato.
 * @property {string} [field]
 */

/**
 * @typedef {Object} MetricDefinition
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string} stat                 Dato que mide (asesinatos, oro, victorias…).
 * @property {string} aggregation          AGGREGATION: cómo se combinan los valores (total, promedio…).
 * @property {string} family               METRIC_FAMILY (agrupación en la UI)
 * @property {string} kind                 METRIC_KIND
 * @property {string} operator             OPERATOR por defecto
 * @property {string[]} operators          Direcciones que el usuario puede elegir (incluye la por defecto).
 * @property {'matches' | 'checkins'} source
 * @property {string} unit                 Unidad corta para mostrar ('partidas', '%', 'muertes', o '' si la define el usuario).
 * @property {number} decimals             Decimales al mostrar el valor.
 * @property {string[]} allowedFilters
 * @property {string[]} requiredFilters
 * @property {string[]} consumedFilters    Filtros que la métrica usa para medir, no para descartar filas.
 * @property {{ min: number, max: number, step: number, integer: boolean, default: number }} target
 * @property {number|null} defaultMinSample
 * @property {(row: any, goal: any) => Measurement} measure
 * @property {(values: number[]) => number|null} aggregate
 */

/** @type {Map<string, MetricDefinition>} */
const metrics = new Map();

function assertDefinition(def) {
  const errors = [];
  if (!def.id) errors.push('id');
  if (!Object.values(METRIC_KIND).includes(def.kind)) errors.push('kind');
  if (!Object.values(METRIC_FAMILY).includes(def.family)) errors.push('family');
  if (!def.stat) errors.push('stat');
  if (!Object.values(AGGREGATION).includes(def.aggregation)) errors.push('aggregation');
  if (!Object.values(OPERATOR).includes(def.operator)) errors.push('operator');
  if (!Array.isArray(def.operators) || !def.operators.includes(def.operator)
    || def.operators.some(op => !Object.values(OPERATOR).includes(op))) errors.push('operators');
  // Una métrica acumulativa solo puede crecer: su meta siempre es "al menos".
  if (def.kind === METRIC_KIND.CUMULATIVE && def.operators.some(op => op !== OPERATOR.GTE)) errors.push('operators acumulativa');
  if (!['matches', 'checkins'].includes(def.source)) errors.push('source');
  if (typeof def.measure !== 'function' || typeof def.aggregate !== 'function') errors.push('measure/aggregate');
  const knownFilters = listFilterKeys();
  [...def.allowedFilters, ...def.requiredFilters, ...def.consumedFilters]
    .filter(key => !knownFilters.includes(key))
    .forEach(key => errors.push(`filtro ${key}`));
  if (def.requiredFilters.some(key => !def.allowedFilters.includes(key))) errors.push('requiredFilters ⊄ allowedFilters');
  if (def.kind === METRIC_KIND.PERFORMANCE && !def.defaultMinSample) errors.push('defaultMinSample');
  if (errors.length) throw new Error(`Definición de métrica inválida (${def.id}): ${errors.join(', ')}`);
}

/** @param {MetricDefinition} def */
export function registerMetric(def) {
  assertDefinition(def);
  if (metrics.has(def.id)) throw new Error(`Métrica duplicada: ${def.id}`);
  if (findMetric(def.stat, def.aggregation)) throw new Error(`Combinación duplicada: ${def.stat} × ${def.aggregation}`);
  metrics.set(def.id, Object.freeze({ ...def }));
}

/** @returns {MetricDefinition} */
export function getMetric(id) {
  const metric = metrics.get(id);
  if (!metric) throw new Error(`Métrica desconocida: ${id}`);
  return metric;
}

export function hasMetric(id) {
  return metrics.has(id);
}

/** @returns {MetricDefinition[]} */
export function listMetrics() {
  return [...metrics.values()];
}

/** Métrica que corresponde a un dato y un tipo de cálculo, o null si la combinación no existe. */
export function findMetric(stat, aggregation) {
  return listMetrics().find(metric => metric.stat === stat && metric.aggregation === aggregation) || null;
}

/** Datos disponibles, en el orden en que se registraron. */
export function listStats() {
  return [...new Set(listMetrics().map(metric => metric.stat))];
}

/** Tipos de cálculo que admite un dato. */
export function aggregationsFor(stat) {
  return listMetrics().filter(metric => metric.stat === stat).map(metric => metric.aggregation);
}

/** Dirección efectiva de un objetivo: la elegida si la métrica la admite, o la por defecto. */
export function operatorOf(goal) {
  const metric = getMetric(goal.metric);
  return metric.operators.includes(goal.operator) ? goal.operator : metric.operator;
}

export function isPerformanceMetric(id) {
  return getMetric(id).kind === METRIC_KIND.PERFORMANCE;
}
