// Métricas de objetivos, descritas como "dato × cálculo".
// Cada dato sabe leerse de una partida y declara qué cálculos admite (total, promedio,
// mejor partida) con sus rangos; las métricas se generan de esas combinaciones.
// Las fórmulas se reutilizan de src/domain/matchStats.js.
import { averageOf, matchKda, percentageOf, sumOf, winratePct } from '../../../domain/matchStats.js';
import { AGGREGATION, EXCLUSION_REASON, METRIC_FAMILY, METRIC_KIND, OPERATOR } from '../model/goalConstants.js';
import {
  championMatchesAny, championOf, countStatOf, deathsOf, durationOf, goldOf, resultOf,
} from '../engine/matchFacts.js';

const MATCH_FILTERS = ['types', 'lanes', 'champions', 'patches'];
const BOTH_DIRECTIONS = [OPERATOR.GTE, OPERATOR.LTE];

/** Datos que se leen de cada partida. */
export const STATS = {
  partidas: { label: 'Partidas' },
  victorias: { label: 'Victorias' },
  asesinatos: {
    label: 'Asesinatos',
    unit: 'asesinatos',
    read: match => countStatOf(match, 'kills'),
    missing: { reason: EXCLUSION_REASON.MISSING_KILLS, field: 'kills' },
  },
  muertes: {
    label: 'Muertes',
    unit: 'muertes',
    read: deathsOf,
    missing: { reason: EXCLUSION_REASON.MISSING_DEATHS, field: 'deaths' },
  },
  asistencias: {
    label: 'Asistencias',
    unit: 'asistencias',
    read: match => countStatOf(match, 'assists'),
    missing: { reason: EXCLUSION_REASON.MISSING_ASSISTS, field: 'assists' },
  },
  kda: {
    label: 'KDA',
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
    label: 'Oro',
    unit: 'de oro',
    read: goldOf,
    missing: { reason: EXCLUSION_REASON.MISSING_GOLD, field: 'gold' },
  },
  duracion: {
    label: 'Duración',
    unit: 'min',
    read: durationOf,
    missing: { reason: EXCLUSION_REASON.MISSING_DURATION, field: 'duration_minutes' },
  },
  campeones: { label: 'Campeones elegidos' },
  manual: { label: 'Hábito propio (check-ins)' },
};

export const AGGREGATION_LABELS = {
  [AGGREGATION.TOTAL]: 'Total (suma)',
  [AGGREGATION.AVERAGE]: 'Promedio por partida',
  [AGGREGATION.BEST]: 'Mejor partida',
  [AGGREGATION.PERCENTAGE]: 'Porcentaje de partidas',
};

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
function averageOfStat(statId, { id, label, description, decimals, operator, target }) {
  const stat = STATS[statId];
  return {
    ...base(statId, AGGREGATION.AVERAGE),
    id, label, description,
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
function totalOfStat(statId, { id, label, description, decimals, target }) {
  const stat = STATS[statId];
  return {
    ...base(statId, AGGREGATION.TOTAL),
    id, label, description,
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
 * Mejor partida del período: se alcanza en cuanto una partida llega a la meta.
 * @returns {import('./registry.js').MetricDefinition}
 */
function bestOfStat(statId, { id, label, description, decimals, target }) {
  const stat = STATS[statId];
  return {
    ...base(statId, AGGREGATION.BEST),
    id, label, description,
    family: METRIC_FAMILY.RECORD,
    kind: METRIC_KIND.CUMULATIVE,
    operator: OPERATOR.GTE,
    operators: [OPERATOR.GTE],
    unit: stat.unit,
    decimals,
    target,
    defaultMinSample: null,
    measure: measureStat(stat),
    aggregate: values => (values.length ? Math.max(...values) : null),
  };
}

const range = (min, max, step, integer, defaultValue) => ({ min, max, step, integer, default: defaultValue });

// ---------------------------------------------------------------- Acumulativos (total)

/** @type {import('./registry.js').MetricDefinition} */
export const partidasRegistradas = {
  ...base('partidas', AGGREGATION.TOTAL),
  id: 'partidas_registradas',
  label: 'Partidas registradas',
  description: 'Cantidad de partidas registradas en el período que cumplen los filtros.',
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
  label: 'Victorias',
  description: 'Cantidad de partidas ganadas en el período que cumplen los filtros.',
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
  id: 'suma_asesinatos', label: 'Asesinatos totales', decimals: 0,
  description: 'Suma de los asesinatos de las partidas del período que tienen ese dato registrado.',
  target: range(1, 5000, 1, true, 100),
});

export const sumaAsistencias = totalOfStat('asistencias', {
  id: 'suma_asistencias', label: 'Asistencias totales', decimals: 0,
  description: 'Suma de las asistencias de las partidas del período que tienen ese dato registrado.',
  target: range(1, 10000, 1, true, 150),
});

export const sumaOro = totalOfStat('oro', {
  id: 'suma_oro', label: 'Oro total', decimals: 0,
  description: 'Suma del oro de las partidas del período que tienen ese dato registrado.',
  target: range(1000, 5000000, 1000, true, 100000),
});

export const sumaDuracion = totalOfStat('duracion', {
  id: 'suma_duracion', label: 'Tiempo jugado', decimals: 0,
  description: 'Suma de la duración (en minutos) de las partidas del período que tienen ese dato registrado.',
  target: range(1, 20000, 1, true, 300),
});

// ---------------------------------------------------------------- Promedios

export const promedioMuertes = averageOfStat('muertes', {
  id: 'promedio_muertes', label: 'Promedio de muertes', decimals: 2, operator: OPERATOR.LTE,
  description: 'Promedio de muertes de las partidas que tienen ese dato registrado.',
  target: range(0.1, 30, 0.1, false, 4),
});

export const promedioKda = averageOfStat('kda', {
  id: 'promedio_kda', label: 'KDA promedio', decimals: 2, operator: OPERATOR.GTE,
  description: 'Promedio del KDA de cada partida, (asesinatos + asistencias) / muertes, en las partidas con K, D y A registrados.',
  target: range(0.1, 50, 0.1, false, 3),
});

export const promedioAsesinatos = averageOfStat('asesinatos', {
  id: 'promedio_asesinatos', label: 'Promedio de asesinatos', decimals: 2, operator: OPERATOR.GTE,
  description: 'Promedio de asesinatos de las partidas que tienen ese dato registrado.',
  target: range(0.1, 40, 0.1, false, 6),
});

export const promedioAsistencias = averageOfStat('asistencias', {
  id: 'promedio_asistencias', label: 'Promedio de asistencias', decimals: 2, operator: OPERATOR.GTE,
  description: 'Promedio de asistencias de las partidas que tienen ese dato registrado.',
  target: range(0.1, 50, 0.1, false, 8),
});

export const promedioOro = averageOfStat('oro', {
  id: 'promedio_oro', label: 'Oro promedio', decimals: 0, operator: OPERATOR.GTE,
  description: 'Promedio de oro por partida en las partidas que tienen ese dato registrado.',
  target: range(100, 50000, 100, true, 10000),
});

export const promedioDuracion = averageOfStat('duracion', {
  id: 'promedio_duracion', label: 'Duración promedio', decimals: 1, operator: OPERATOR.LTE,
  description: 'Duración promedio de las partidas (en minutos) que tienen ese dato registrado.',
  target: range(1, 60, 0.5, false, 18),
});

// ---------------------------------------------------------------- Mejor partida

export const maxAsesinatos = bestOfStat('asesinatos', {
  id: 'max_asesinatos', label: 'Récord de asesinatos', decimals: 0,
  description: 'Asesinatos de tu mejor partida del período. Se cumple cuando una partida llega a la meta.',
  target: range(1, 60, 1, true, 15),
});

export const maxAsistencias = bestOfStat('asistencias', {
  id: 'max_asistencias', label: 'Récord de asistencias', decimals: 0,
  description: 'Asistencias de tu mejor partida del período. Se cumple cuando una partida llega a la meta.',
  target: range(1, 80, 1, true, 20),
});

export const maxOro = bestOfStat('oro', {
  id: 'max_oro', label: 'Récord de oro', decimals: 0,
  description: 'Oro de tu mejor partida del período. Se cumple cuando una partida llega a la meta.',
  target: range(1000, 80000, 500, true, 18000),
});

export const maxKda = bestOfStat('kda', {
  id: 'max_kda', label: 'Récord de KDA', decimals: 2,
  description: 'KDA de tu mejor partida del período. Se cumple cuando una partida llega a la meta.',
  target: range(0.5, 100, 0.5, false, 10),
});

// ---------------------------------------------------------------- Porcentajes

/** @type {import('./registry.js').MetricDefinition} */
export const winrate = {
  ...base('victorias', AGGREGATION.PERCENTAGE),
  id: 'winrate',
  label: 'Winrate',
  description: 'Victorias sobre partidas con resultado conocido, en porcentaje.',
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
  label: 'Porcentaje con campeones',
  description: 'Partidas jugadas con los campeones elegidos sobre todas las partidas del período que cumplen los demás filtros.',
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
  target: range(0.01, 100000, 0.01, false, 10),
  defaultMinSample: null,
  measure: checkin => ({ value: Number(checkin.amount) }),
  aggregate: values => sumOf(values),
};

export const MVP_METRICS = [
  partidasRegistradas, victorias, sumaAsesinatos, sumaAsistencias, sumaOro, sumaDuracion,
  promedioMuertes, promedioKda, promedioAsesinatos, promedioAsistencias, promedioOro, promedioDuracion,
  maxAsesinatos, maxAsistencias, maxOro, maxKda,
  winrate, porcentajeCampeones,
  manual,
];
