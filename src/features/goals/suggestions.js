// Objetivos sugeridos con valores por defecto razonables, agrupados por tipo de métrica.
import { DEFAULT_MATCH_TYPE } from '../../constants/matchTypes.js';
import { addDays, todayIn } from './engine/period.js';
import { championOf } from './engine/matchFacts.js';
import { getMetric } from './metrics/index.js';
import { METRIC_FAMILY, OPERATOR } from './model/goalConstants.js';
import { tr } from '../../i18n/uiI18n.js';

/** Grupos del paso 1. "A medida" (configuración libre y hábitos manuales) se muestra aparte, en una barra. */
const group = (id, key) => ({
  id,
  get label() { return tr(`goals.family.${key}`); },
  get description() { return tr(`goals.groupDescription.${key}`); },
});

export const GOAL_GROUPS = [
  group(METRIC_FAMILY.CUMULATIVE, 'cumulative'),
  group(METRIC_FAMILY.AVERAGE, 'average'),
  group(METRIC_FAMILY.PERCENTAGE, 'percentage'),
  group(METRIC_FAMILY.RECORD, 'record'),
];

/** Campeones más jugados del usuario (por nombre), para precargar sugerencias. */
export function topChampions(matches, limit = 3) {
  const counts = new Map();
  matches.forEach(match => {
    const champion = championOf(match);
    if (!champion?.name) return;
    const current = counts.get(champion.name) || { id: champion.id, name: champion.name, games: 0 };
    current.games += 1;
    counts.set(champion.name, current);
  });
  return [...counts.values()]
    .sort((a, b) => b.games - a.games)
    .slice(0, limit)
    .map(({ id, name }) => ({ id, name }));
}

function draft(metricId, overrides) {
  const metric = getMetric(metricId);
  return {
    metric: metricId,
    operator: metric.operator,
    target: metric.target.default,
    minSample: metric.defaultMinSample,
    unit: '',
    filters: {},
    description: '',
    ...overrides,
  };
}

/**
 * Sugerencias listas para el paso de configuración. `category` es la familia de la métrica.
 * @param {{ timezone: string, now?: Date, matches?: any[] }} context
 */
export function buildSuggestions({ timezone, now = new Date(), matches = [] }) {
  const today = todayIn(timezone, now);
  const period = days => ({ startDate: today, endDate: addDays(today, days - 1), timezone });
  const pool = topChampions(matches);
  // Título y nombre sugerido salen de goals.suggestion.<id>.
  const suggest = (id, metricId, overrides, vars) => ({
    id,
    title: tr(`goals.suggestion.${id}.title`, vars),
    category: getMetric(metricId).family,
    input: draft(metricId, { name: tr(`goals.suggestion.${id}.name`), ...overrides }),
  });

  const suggestions = [
    suggest('registrar-20', 'partidas_registradas', {
      target: 20, ...period(14),
    }),
    suggest('ganar-10', 'victorias', {
      target: 10, filters: { types: [DEFAULT_MATCH_TYPE] }, ...period(30),
    }),
    suggest('muertes-4', 'promedio_muertes', {
      target: 4, minSample: 10, ...period(14),
    }),
    suggest('kda-3', 'promedio_kda', {
      target: 3, minSample: 10, ...period(21),
    }),
    suggest('duracion-18', 'promedio_duracion', {
      operator: OPERATOR.LTE, target: 18, minSample: 10, ...period(21),
    }),
    suggest('oro-10k', 'promedio_oro', {
      target: 10000, minSample: 10, ...period(21),
    }),
    suggest('unico-kda-10', 'max_kda', {
      target: 10, ...period(30),
    }),
    suggest('unico-20-kills', 'max_asesinatos', {
      target: 20, ...period(30),
    }),
    suggest('unico-sin-morir', 'min_muertes', {
      target: 0, ...period(30),
    }),
    suggest('unico-victoria-rapida', 'min_duracion', {
      target: 15, ...period(30),
    }),
    suggest('winrate-55', 'winrate', {
      target: 55, minSample: 15, filters: { types: [DEFAULT_MATCH_TYPE] }, ...period(30),
    }),
  ];

  if (pool.length > 0) {
    suggestions.push(suggest('pool-60', 'porcentaje_campeones', {
      target: 60, minSample: 10, filters: { champions: pool }, ...period(21),
    }, { champions: pool.map(c => c.name).join(', ') }));
  }

  return suggestions;
}

/** Borrador vacío para un objetivo personalizado de la métrica elegida. */
export function blankDraft(metricId, { timezone, now = new Date() }) {
  const today = todayIn(timezone, now);
  return draft(metricId, { name: '', startDate: today, endDate: addDays(today, 29), timezone });
}
