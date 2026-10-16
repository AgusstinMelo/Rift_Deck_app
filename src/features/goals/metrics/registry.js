// Registro de métricas de objetivos. Una métrica nueva solo necesita una
// definición tipada (operador, tipo, filtros, rangos) y sus funciones
// `measure` y `aggregate`; el motor no cambia.
import { METRIC_KIND, OPERATOR } from '../model/goalConstants.js';
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
 * @property {string} kind                 METRIC_KIND
 * @property {string} operator             OPERATOR
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
  if (!Object.values(OPERATOR).includes(def.operator)) errors.push('operator');
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

export function isPerformanceMetric(id) {
  return getMetric(id).kind === METRIC_KIND.PERFORMANCE;
}
