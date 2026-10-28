// Registro de métricas de objetivos. Una métrica nueva solo necesita una
// definición tipada (operador, tipo, filtros, rangos) y sus funciones
// `measure` y `aggregate`; el motor no cambia.
import { AGGREGATION, METRIC_FAMILY, METRIC_KIND, OPERATOR } from '../model/goalConstants.js';
import { listFilterKeys } from '../filters/filterRegistry.js';
import { baseMessages, lookup, tr } from '../../../i18n/uiI18n.js';

/**
 * @typedef {Object} Measurement
 * @property {number} [value]   Valor de la fila para la métrica.
 * @property {string} [reason]  Motivo de exclusión si falta el dato.
 * @property {string} [field]
 */

/**
 * @typedef {Object} MetricDefinition
 * @property {string} id
 * @property {string} [label]            Se completa al registrar: goals.metric.<id>.
 * @property {string} [description]      Se completa al registrar: goals.metricDescription.<id>.
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
  // Las acumulativas evolucionan en un solo sentido, así que su dirección es fija:
  // "al menos" (totales, mejor partida) o "como máximo" (la partida con menos).
  if (def.kind === METRIC_KIND.CUMULATIVE && def.operators.length !== 1) errors.push('operators acumulativa');
  if (def.kind === METRIC_KIND.CUMULATIVE && def.operator === OPERATOR.LTE && def.aggregation !== AGGREGATION.BEST) {
    errors.push('solo "en una sola partida" admite "como máximo" siendo acumulativa');
  }
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
  const { unit } = def;
  const metric = { ...def };
  Object.defineProperties(metric, {
    label: { enumerable: true, get: () => tr(`goals.metric.${def.id}`) },
    description: { enumerable: true, get: () => tr(`goals.metricDescription.${def.id}`) },
    // Unidades con traducción (goals.unit.<unidad>); '%', 'min' y '' quedan igual.
    unit: { enumerable: true, get: () => (lookup(baseMessages, `goals.unit.${unit}`) ? tr(`goals.unit.${unit}`) : unit) },
  });
  metrics.set(def.id, Object.freeze(metric));
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
