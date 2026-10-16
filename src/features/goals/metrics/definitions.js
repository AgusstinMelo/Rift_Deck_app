// Métricas de objetivos. Cada una reutiliza las fórmulas de src/domain/matchStats.js.
import { averageOf, matchKda, percentageOf, sumOf, winratePct } from '../../../domain/matchStats.js';
import { EXCLUSION_REASON, METRIC_FAMILY, METRIC_KIND, OPERATOR } from '../model/goalConstants.js';
import {
  championMatchesAny, championOf, countStatOf, deathsOf, durationOf, goldOf, resultOf,
} from '../engine/matchFacts.js';

const MATCH_FILTERS = ['types', 'lanes', 'champions', 'patches'];
const BOTH_DIRECTIONS = [OPERATOR.GTE, OPERATOR.LTE];

/**
 * Base común de las métricas que promedian un dato por partida.
 * @returns {import('./registry.js').MetricDefinition}
 */
function averageMetric({ id, label, description, unit, decimals, operator, target, read, missingReason, field }) {
  return {
    id,
    label,
    description,
    family: METRIC_FAMILY.AVERAGE,
    kind: METRIC_KIND.PERFORMANCE,
    operator,
    operators: BOTH_DIRECTIONS,
    source: 'matches',
    unit,
    decimals,
    allowedFilters: MATCH_FILTERS,
    requiredFilters: [],
    consumedFilters: [],
    target,
    defaultMinSample: 10,
    measure: match => {
      const value = read(match);
      return value === null ? { reason: missingReason, field } : { value };
    },
    aggregate: values => averageOf(values),
  };
}

// ---------------------------------------------------------------- Acumulativos

/** @type {import('./registry.js').MetricDefinition} */
export const partidasRegistradas = {
  id: 'partidas_registradas',
  label: 'Partidas registradas',
  description: 'Cantidad de partidas registradas en el período que cumplen los filtros.',
  family: METRIC_FAMILY.CUMULATIVE,
  kind: METRIC_KIND.CUMULATIVE,
  operator: OPERATOR.GTE,
  operators: [OPERATOR.GTE],
  source: 'matches',
  unit: 'partidas',
  decimals: 0,
  allowedFilters: MATCH_FILTERS,
  requiredFilters: [],
  consumedFilters: [],
  target: { min: 1, max: 1000, step: 1, integer: true, default: 20 },
  defaultMinSample: null,
  measure: () => ({ value: 1 }),
  aggregate: values => sumOf(values),
};

/** @type {import('./registry.js').MetricDefinition} */
export const victorias = {
  id: 'victorias',
  label: 'Victorias',
  description: 'Cantidad de partidas ganadas en el período que cumplen los filtros.',
  family: METRIC_FAMILY.CUMULATIVE,
  kind: METRIC_KIND.CUMULATIVE,
  operator: OPERATOR.GTE,
  operators: [OPERATOR.GTE],
  source: 'matches',
  unit: 'victorias',
  decimals: 0,
  allowedFilters: MATCH_FILTERS,
  requiredFilters: [],
  consumedFilters: [],
  target: { min: 1, max: 1000, step: 1, integer: true, default: 10 },
  defaultMinSample: null,
  measure: match => {
    const result = resultOf(match);
    if (!result) return { reason: EXCLUSION_REASON.MISSING_RESULT, field: 'result' };
    return { value: result === 'win' ? 1 : 0 };
  },
  aggregate: values => sumOf(values),
};

// ---------------------------------------------------------------- Promedios

/** @type {import('./registry.js').MetricDefinition} */
export const promedioMuertes = averageMetric({
  id: 'promedio_muertes',
  label: 'Promedio de muertes',
  description: 'Promedio de muertes de las partidas que tienen ese dato registrado.',
  unit: 'muertes',
  decimals: 2,
  operator: OPERATOR.LTE,
  target: { min: 0.1, max: 30, step: 0.1, integer: false, default: 4 },
  read: deathsOf,
  missingReason: EXCLUSION_REASON.MISSING_DEATHS,
  field: 'deaths',
});

/** @type {import('./registry.js').MetricDefinition} */
export const promedioKda = averageMetric({
  id: 'promedio_kda',
  label: 'KDA promedio',
  description: 'Promedio del KDA de cada partida, (asesinatos + asistencias) / muertes, en las partidas con K, D y A registrados.',
  unit: '',
  decimals: 2,
  operator: OPERATOR.GTE,
  target: { min: 0.1, max: 50, step: 0.1, integer: false, default: 3 },
  read: match => {
    const kills = countStatOf(match, 'kills');
    const deaths = countStatOf(match, 'deaths');
    const assists = countStatOf(match, 'assists');
    return kills === null || deaths === null || assists === null ? null : matchKda(kills, deaths, assists);
  },
  missingReason: EXCLUSION_REASON.MISSING_KDA,
  field: 'kda',
});

/** @type {import('./registry.js').MetricDefinition} */
export const promedioAsesinatos = averageMetric({
  id: 'promedio_asesinatos',
  label: 'Promedio de asesinatos',
  description: 'Promedio de asesinatos de las partidas que tienen ese dato registrado.',
  unit: 'asesinatos',
  decimals: 2,
  operator: OPERATOR.GTE,
  target: { min: 0.1, max: 40, step: 0.1, integer: false, default: 6 },
  read: match => countStatOf(match, 'kills'),
  missingReason: EXCLUSION_REASON.MISSING_KILLS,
  field: 'kills',
});

/** @type {import('./registry.js').MetricDefinition} */
export const promedioAsistencias = averageMetric({
  id: 'promedio_asistencias',
  label: 'Promedio de asistencias',
  description: 'Promedio de asistencias de las partidas que tienen ese dato registrado.',
  unit: 'asistencias',
  decimals: 2,
  operator: OPERATOR.GTE,
  target: { min: 0.1, max: 50, step: 0.1, integer: false, default: 8 },
  read: match => countStatOf(match, 'assists'),
  missingReason: EXCLUSION_REASON.MISSING_ASSISTS,
  field: 'assists',
});

/** @type {import('./registry.js').MetricDefinition} */
export const promedioOro = averageMetric({
  id: 'promedio_oro',
  label: 'Oro promedio',
  description: 'Promedio de oro por partida en las partidas que tienen ese dato registrado.',
  unit: 'de oro',
  decimals: 0,
  operator: OPERATOR.GTE,
  target: { min: 100, max: 50000, step: 100, integer: true, default: 10000 },
  read: goldOf,
  missingReason: EXCLUSION_REASON.MISSING_GOLD,
  field: 'gold',
});

/** @type {import('./registry.js').MetricDefinition} */
export const promedioDuracion = averageMetric({
  id: 'promedio_duracion',
  label: 'Duración promedio',
  description: 'Duración promedio de las partidas (en minutos) que tienen ese dato registrado.',
  unit: 'min',
  decimals: 1,
  operator: OPERATOR.LTE,
  target: { min: 1, max: 60, step: 0.5, integer: false, default: 18 },
  read: durationOf,
  missingReason: EXCLUSION_REASON.MISSING_DURATION,
  field: 'duration_minutes',
});

// ---------------------------------------------------------------- Porcentajes

/** @type {import('./registry.js').MetricDefinition} */
export const winrate = {
  id: 'winrate',
  label: 'Winrate',
  description: 'Victorias sobre partidas con resultado conocido, en porcentaje.',
  family: METRIC_FAMILY.PERCENTAGE,
  kind: METRIC_KIND.PERFORMANCE,
  operator: OPERATOR.GTE,
  operators: BOTH_DIRECTIONS,
  source: 'matches',
  unit: '%',
  decimals: 1,
  allowedFilters: MATCH_FILTERS,
  requiredFilters: [],
  consumedFilters: [],
  target: { min: 1, max: 100, step: 1, integer: false, default: 55 },
  defaultMinSample: 15,
  measure: match => {
    const result = resultOf(match);
    if (!result) return { reason: EXCLUSION_REASON.MISSING_RESULT, field: 'result' };
    return { value: result === 'win' ? 1 : 0 };
  },
  aggregate: values => (values.length ? winratePct(sumOf(values), values.length) : null),
};

/** @type {import('./registry.js').MetricDefinition} */
export const porcentajeCampeones = {
  id: 'porcentaje_campeones',
  label: 'Porcentaje con campeones',
  description: 'Partidas jugadas con los campeones elegidos sobre todas las partidas del período que cumplen los demás filtros.',
  family: METRIC_FAMILY.PERCENTAGE,
  kind: METRIC_KIND.PERFORMANCE,
  operator: OPERATOR.GTE,
  operators: BOTH_DIRECTIONS,
  source: 'matches',
  unit: '%',
  decimals: 1,
  allowedFilters: MATCH_FILTERS,
  requiredFilters: ['champions'],
  // Los campeones definen el numerador; no descartan filas del denominador.
  consumedFilters: ['champions'],
  target: { min: 1, max: 100, step: 1, integer: false, default: 60 },
  defaultMinSample: 10,
  measure: (match, goal) => {
    const champion = championOf(match);
    if (!champion) return { reason: EXCLUSION_REASON.MISSING_CHAMPION, field: 'own_champion_name' };
    return { value: championMatchesAny(champion, goal.filters.champions) ? 1 : 0 };
  },
  aggregate: values => (values.length ? percentageOf(sumOf(values), values.length) : null),
};

// ---------------------------------------------------------------- Manual

/** @type {import('./registry.js').MetricDefinition} */
export const manual = {
  id: 'manual',
  label: 'Manual',
  description: 'Suma de los check-ins que registres a mano.',
  family: METRIC_FAMILY.MANUAL,
  kind: METRIC_KIND.CUMULATIVE,
  operator: OPERATOR.GTE,
  operators: [OPERATOR.GTE],
  source: 'checkins',
  unit: '',
  decimals: 2,
  allowedFilters: [],
  requiredFilters: [],
  consumedFilters: [],
  target: { min: 0.01, max: 100000, step: 0.01, integer: false, default: 10 },
  defaultMinSample: null,
  measure: checkin => ({ value: Number(checkin.amount) }),
  aggregate: values => sumOf(values),
};

export const MVP_METRICS = [
  partidasRegistradas, victorias,
  promedioMuertes, promedioKda, promedioAsesinatos, promedioAsistencias, promedioOro, promedioDuracion,
  winrate, porcentajeCampeones,
  manual,
];
