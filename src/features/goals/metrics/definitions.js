// Métricas de objetivos, descritas como "dato × cálculo".
// Cada dato sabe leerse de una partida y declara qué cálculos admite (total, promedio,
// mejor partida) con sus rangos; las métricas se generan de esas combinaciones.
// Las fórmulas se reutilizan de src/domain/matchStats.js.
import { averageOf, matchKda, percentageOf, sumOf, winratePct } from '../../../domain/matchStats.js';
import { AGGREGATION, EXCLUSION_REASON, METRIC_FAMILY, METRIC_KIND, OPERATOR } from '../model/goalConstants.js';
import { labels, tr } from '../../../i18n/uiI18n.js';
import {
  championMatchesAny, championOf, countStatOf, deathsOf, durationOf, goldOf, resultOf,
} from '../engine/matchFacts.js';

const MATCH_FILTERS = ['types', 'lanes', 'champions', 'patches'];
const BOTH_DIRECTIONS = [OPERATOR.GTE, OPERATOR.LTE];

/** Datos que se leen de cada partida. */
export const STATS = {
  partidas: { },
  victorias: { },
  asesinatos: {
    unit: 'asesinatos',
    read: match => countStatOf(match, 'kills'),
    missing: { reason: EXCLUSION_REASON.MISSING_KILLS, field: 'kills' },
  },
  muertes: {
    unit: 'muertes',
    read: deathsOf,
    missing: { reason: EXCLUSION_REASON.MISSING_DEATHS, field: 'deaths' },
  },
  asistencias: {
    unit: 'asistencias',
    read: match => countStatOf(match, 'assists'),
    missing: { reason: EXCLUSION_REASON.MISSING_ASSISTS, field: 'assists' },
  },
  kda: {
    unit: '',
    read: match => {
      const kills = countStatOf(match, 'kills');
      const deaths = countStatOf(match, 'deaths');
      const assists = countStatOf(match, 'assists');
      return kills === null || deaths === null || assists === null ? null : matchKda(kills, deaths, assists);
    },
    missing: { reason: EXCLUSION_REASON.MISSING_KDA, field: 'kda' },
  },
  oro: {
    unit: 'de oro',
    read: goldOf,
    missing: { reason: EXCLUSION_REASON.MISSING_GOLD, field: 'gold' },
  },
  duracion: {
    unit: 'min',
    read: durationOf,
    missing: { reason: EXCLUSION_REASON.MISSING_DURATION, field: 'duration_minutes' },
  },
  campeones: { },
  manual: { },
};

// Etiqueta visible de cada dato (goals.stat.<id>), en el idioma activo.
for (const id of Object.keys(STATS)) {
  Object.defineProperty(STATS[id], 'label', { enumerable: true, get: () => tr(`goals.stat.${id}`) });
}

export const AGGREGATION_LABELS = labels({
  [AGGREGATION.TOTAL]: 'goals.aggregation.total',
  [AGGREGATION.AVERAGE]: 'goals.aggregation.average',
  [AGGREGATION.BEST]: 'goals.aggregation.best',
  [AGGREGATION.PERCENTAGE]: 'goals.aggregation.percentage',
});

/** Medición de un dato numérico: valor o motivo de exclusión. */
function measureStat(stat) {
  return match => {
    const value = stat.read(match);
    return value === null ? { reason: stat.missing.reason, field: stat.missing.field } : { value };
  };
}

/**
 * Campos comunes a las métricas que se calculan sobre partidas.
 * @returns {{ stat: string, aggregation: string, source: 'matches', allowedFilters: string[], requiredFilters: string[], consumedFilters: string[] }}
 */
function base(statId, aggregation) {
  return {
    stat: statId,
    aggregation,
    source: 'matches',
    allowedFilters: MATCH_FILTERS,
    requiredFilters: [],
    consumedFilters: [],
  };
}

/**
 * Promedio por partida (rendimiento): admite "al menos" y "como máximo".
 * @returns {import('./registry.js').MetricDefinition}
 */
function averageOfStat(statId, { id, decimals, operator, target }) {
  const stat = STATS[statId];
  return {
    ...base(statId, AGGREGATION.AVERAGE),
    id,
    family: METRIC_FAMILY.AVERAGE,
    kind: METRIC_KIND.PERFORMANCE,
    operator,
    operators: BOTH_DIRECTIONS,
    unit: stat.unit,
    decimals,
    target,
    defaultMinSample: 10,
    measure: measureStat(stat),
    aggregate: values => averageOf(values),
  };
}

/**
 * Total del período (acumulativo): solo crece, la meta es "al menos".
 * @returns {import('./registry.js').MetricDefinition}
 */
function totalOfStat(statId, { id, decimals, target }) {
  const stat = STATS[statId];
  return {
    ...base(statId, AGGREGATION.TOTAL),
    id,
    family: METRIC_FAMILY.CUMULATIVE,
    kind: METRIC_KIND.CUMULATIVE,
    operator: OPERATOR.GTE,
    operators: [OPERATOR.GTE],
    unit: stat.unit,
    decimals,
    target,
    defaultMinSample: null,
    measure: measureStat(stat),
    aggregate: values => sumOf(values),
  };
}

/**
 * Objetivo único: lograr algo en una sola partida del período. Se alcanza en cuanto una partida llega a la meta.
 * Con `lowest` se busca la partida con menos (por ejemplo, 0 muertes) y la meta es "como máximo".
 * @returns {import('./registry.js').MetricDefinition}
 */
function bestOfStat(statId, { id, decimals, target, lowest = false, measure = null }) {
  const stat = STATS[statId];
  const operator = lowest ? OPERATOR.LTE : OPERATOR.GTE;
  return {
    ...base(statId, AGGREGATION.BEST),
    id,
    family: METRIC_FAMILY.RECORD,
    kind: METRIC_KIND.CUMULATIVE,
    operator,
    operators: [operator],
    unit: stat.unit,
    decimals,
    target,
    defaultMinSample: null,
    measure: measure || measureStat(stat),
    aggregate: values => (values.length ? (lowest ? Math.min(...values) : Math.max(...values)) : null),
  };
}

const range = (min, max, step, integer, defaultValue) => ({ min, max, step, integer, default: defaultValue });

// ---------------------------------------------------------------- Acumulativos (total)

/** @type {import('./registry.js').MetricDefinition} */
export const partidasRegistradas = {
  ...base('partidas', AGGREGATION.TOTAL),
  id: 'partidas_registradas',
  family: METRIC_FAMILY.CUMULATIVE,
  kind: METRIC_KIND.CUMULATIVE,
  operator: OPERATOR.GTE,
  operators: [OPERATOR.GTE],
  unit: 'partidas',
  decimals: 0,
  target: range(1, 1000, 1, true, 20),
  defaultMinSample: null,
  measure: () => ({ value: 1 }),
  aggregate: values => sumOf(values),
};

/** @type {import('./registry.js').MetricDefinition} */
export const victorias = {
  ...base('victorias', AGGREGATION.TOTAL),
  id: 'victorias',
  family: METRIC_FAMILY.CUMULATIVE,
  kind: METRIC_KIND.CUMULATIVE,
  operator: OPERATOR.GTE,
  operators: [OPERATOR.GTE],
  unit: 'victorias',
  decimals: 0,
  target: range(1, 1000, 1, true, 10),
  defaultMinSample: null,
  measure: match => {
    const result = resultOf(match);
    if (!result) return { reason: EXCLUSION_REASON.MISSING_RESULT, field: 'result' };
    return { value: result === 'win' ? 1 : 0 };
  },
  aggregate: values => sumOf(values),
};

export const sumaAsesinatos = totalOfStat('asesinatos', {
  id: 'suma_asesinatos', decimals: 0,
  target: range(1, 5000, 1, true, 100),
});

export const sumaAsistencias = totalOfStat('asistencias', {
  id: 'suma_asistencias', decimals: 0,
  target: range(1, 10000, 1, true, 150),
});

export const sumaOro = totalOfStat('oro', {
  id: 'suma_oro', decimals: 0,
  target: range(1000, 5000000, 1000, true, 100000),
});

export const sumaDuracion = totalOfStat('duracion', {
  id: 'suma_duracion', decimals: 0,
  target: range(1, 20000, 1, true, 300),
});

// ---------------------------------------------------------------- Promedios

export const promedioMuertes = averageOfStat('muertes', {
  id: 'promedio_muertes', decimals: 2, operator: OPERATOR.LTE,
  target: range(0.1, 30, 0.1, false, 4),
});

export const promedioKda = averageOfStat('kda', {
  id: 'promedio_kda', decimals: 2, operator: OPERATOR.GTE,
  target: range(0.1, 50, 0.1, false, 3),
});

export const promedioAsesinatos = averageOfStat('asesinatos', {
  id: 'promedio_asesinatos', decimals: 2, operator: OPERATOR.GTE,
  target: range(0.1, 40, 0.1, false, 6),
});

export const promedioAsistencias = averageOfStat('asistencias', {
  id: 'promedio_asistencias', decimals: 2, operator: OPERATOR.GTE,
  target: range(0.1, 50, 0.1, false, 8),
});

export const promedioOro = averageOfStat('oro', {
  id: 'promedio_oro', decimals: 0, operator: OPERATOR.GTE,
  target: range(100, 50000, 100, true, 10000),
});

export const promedioDuracion = averageOfStat('duracion', {
  id: 'promedio_duracion', decimals: 1, operator: OPERATOR.LTE,
  target: range(1, 60, 0.5, false, 18),
});

// ---------------------------------------------------------------- Mejor partida

export const maxAsesinatos = bestOfStat('asesinatos', {
  id: 'max_asesinatos', decimals: 0,
  target: range(1, 60, 1, true, 20),
});

export const maxAsistencias = bestOfStat('asistencias', {
  id: 'max_asistencias', decimals: 0,
  target: range(1, 80, 1, true, 20),
});

export const maxOro = bestOfStat('oro', {
  id: 'max_oro', decimals: 0,
  target: range(1000, 80000, 500, true, 20000),
});

export const maxKda = bestOfStat('kda', {
  id: 'max_kda', decimals: 2,
  target: range(0.5, 100, 0.5, false, 10),
});

export const minMuertes = bestOfStat('muertes', {
  id: 'min_muertes', decimals: 0, lowest: true,
  target: range(0, 20, 1, true, 0),
});

export const minDuracion = bestOfStat('duracion', {
  id: 'min_duracion', decimals: 1, lowest: true,
  target: range(5, 60, 0.5, false, 15),
  measure: match => {
    const result = resultOf(match);
    if (!result) return { reason: EXCLUSION_REASON.MISSING_RESULT, field: 'result' };
    if (result !== 'win') return { reason: EXCLUSION_REASON.NOT_A_WIN, field: 'result' };
    const duration = durationOf(match);
    return duration === null ? { reason: EXCLUSION_REASON.MISSING_DURATION, field: 'duration_minutes' } : { value: duration };
  },
});

// ---------------------------------------------------------------- Porcentajes

/** @type {import('./registry.js').MetricDefinition} */
export const winrate = {
  ...base('victorias', AGGREGATION.PERCENTAGE),
  id: 'winrate',
  family: METRIC_FAMILY.PERCENTAGE,
  kind: METRIC_KIND.PERFORMANCE,
  operator: OPERATOR.GTE,
  operators: BOTH_DIRECTIONS,
  unit: '%',
  decimals: 1,
  target: range(1, 100, 1, false, 55),
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
  ...base('campeones', AGGREGATION.PERCENTAGE),
  id: 'porcentaje_campeones',
  family: METRIC_FAMILY.PERCENTAGE,
  kind: METRIC_KIND.PERFORMANCE,
  operator: OPERATOR.GTE,
  operators: BOTH_DIRECTIONS,
  unit: '%',
  decimals: 1,
  requiredFilters: ['champions'],
  // Los campeones definen el numerador; no descartan filas del denominador.
  consumedFilters: ['champions'],
  target: range(1, 100, 1, false, 60),
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
  stat: 'manual',
  aggregation: AGGREGATION.TOTAL,
  id: 'manual',
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
  target: range(0.01, 100000, 0.01, false, 10),
  defaultMinSample: null,
  measure: checkin => ({ value: Number(checkin.amount) }),
  aggregate: values => sumOf(values),
};

export const MVP_METRICS = [
  partidasRegistradas, victorias, sumaAsesinatos, sumaAsistencias, sumaOro, sumaDuracion,
  promedioMuertes, promedioKda, promedioAsesinatos, promedioAsistencias, promedioOro, promedioDuracion,
  maxAsesinatos, maxAsistencias, maxOro, maxKda, minMuertes, minDuracion,
  winrate, porcentajeCampeones,
  manual,
];
