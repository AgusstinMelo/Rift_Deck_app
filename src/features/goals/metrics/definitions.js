// Métricas del MVP. Cada una reutiliza las fórmulas de src/domain/matchStats.js.
import { averageOf, percentageOf, sumOf, winratePct } from '../../../domain/matchStats.js';
import { EXCLUSION_REASON, METRIC_KIND, OPERATOR } from '../model/goalConstants.js';
import { championMatchesAny, championOf, deathsOf, resultOf } from '../engine/matchFacts.js';

const MATCH_FILTERS = ['types', 'lanes', 'champions', 'patches'];

/** @type {import('./registry.js').MetricDefinition} */
export const partidasRegistradas = {
  id: 'partidas_registradas',
  label: 'Partidas registradas',
  description: 'Cantidad de partidas registradas en el período que cumplen los filtros.',
  kind: METRIC_KIND.CUMULATIVE,
  operator: OPERATOR.GTE,
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
export const winrate = {
  id: 'winrate',
  label: 'Winrate',
  description: 'Victorias sobre partidas con resultado conocido, en porcentaje.',
  kind: METRIC_KIND.PERFORMANCE,
  operator: OPERATOR.GTE,
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
export const promedioMuertes = {
  id: 'promedio_muertes',
  label: 'Promedio de muertes',
  description: 'Promedio de muertes de las partidas que tienen ese dato registrado.',
  kind: METRIC_KIND.PERFORMANCE,
  operator: OPERATOR.LTE,
  source: 'matches',
  unit: 'muertes',
  decimals: 2,
  allowedFilters: MATCH_FILTERS,
  requiredFilters: [],
  consumedFilters: [],
  target: { min: 0.1, max: 30, step: 0.1, integer: false, default: 4 },
  defaultMinSample: 10,
  measure: match => {
    const deaths = deathsOf(match);
    if (deaths === null) return { reason: EXCLUSION_REASON.MISSING_DEATHS, field: 'deaths' };
    return { value: deaths };
  },
  aggregate: values => averageOf(values),
};

/** @type {import('./registry.js').MetricDefinition} */
export const porcentajeCampeones = {
  id: 'porcentaje_campeones',
  label: 'Porcentaje con campeones',
  description: 'Partidas jugadas con los campeones elegidos sobre todas las partidas del período que cumplen los demás filtros.',
  kind: METRIC_KIND.PERFORMANCE,
  operator: OPERATOR.GTE,
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

/** @type {import('./registry.js').MetricDefinition} */
export const manual = {
  id: 'manual',
  label: 'Manual',
  description: 'Suma de los check-ins que registres a mano.',
  kind: METRIC_KIND.CUMULATIVE,
  operator: OPERATOR.GTE,
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

export const MVP_METRICS = [partidasRegistradas, winrate, promedioMuertes, porcentajeCampeones, manual];
