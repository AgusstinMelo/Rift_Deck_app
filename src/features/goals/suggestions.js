// Objetivos sugeridos con valores por defecto razonables, agrupados por tipo de métrica.
import { DEFAULT_MATCH_TYPE } from '../../constants/matchTypes.js';
import { addDays, todayIn } from './engine/period.js';
import { championOf } from './engine/matchFacts.js';
import { getMetric } from './metrics/index.js';
import { METRIC_FAMILY, OPERATOR } from './model/goalConstants.js';

/** Grupos del paso 1. "A medida" (configuración libre y hábitos manuales) se muestra aparte. */
export const GOAL_GROUPS = [
  {
    id: METRIC_FAMILY.CUMULATIVE,
    label: 'Acumulativos',
    description: 'Sumá partidas o victorias. Se cumplen apenas llegás a la meta.',
  },
  {
    id: METRIC_FAMILY.AVERAGE,
    label: 'Promedios',
    description: 'Mejorá un dato por partida: muertes, KDA, oro, duración y más.',
  },
  {
    id: METRIC_FAMILY.PERCENTAGE,
    label: 'Porcentajes',
    description: 'Winrate o qué parte de tus partidas jugás con ciertos campeones.',
  },
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
  const suggest = (id, title, metricId, overrides) => ({
    id,
    title,
    category: getMetric(metricId).family,
    input: draft(metricId, overrides),
  });

  const suggestions = [
    suggest('registrar-20', 'Registrar 20 partidas en 2 semanas', 'partidas_registradas', {
      name: 'Registrar 20 partidas', target: 20, ...period(14),
    }),
    suggest('ganar-10', 'Ganar 10 clasificatorias este mes', 'victorias', {
      name: 'Ganar 10 clasificatorias', target: 10, filters: { types: [DEFAULT_MATCH_TYPE] }, ...period(30),
    }),
    suggest('muertes-4', 'Promediar 4 muertes o menos', 'promedio_muertes', {
      name: 'Morir menos', target: 4, minSample: 10, ...period(14),
    }),
    suggest('kda-3', 'KDA promedio de 3 o más', 'promedio_kda', {
      name: 'Subir mi KDA', target: 3, minSample: 10, ...period(21),
    }),
    suggest('oro-10k', 'Promediar 10.000 de oro por partida', 'promedio_oro', {
      name: 'Farmear más', target: 10000, minSample: 10, ...period(21),
    }),
    suggest('duracion-18', 'Cerrar partidas en 18 minutos o menos en promedio', 'promedio_duracion', {
      name: 'Cerrar antes las partidas', operator: OPERATOR.LTE, target: 18, minSample: 10, ...period(21),
    }),
    suggest('record-asesinatos', 'Una partida con 15 asesinatos o más', 'max_asesinatos', {
      name: 'Partida de 15 asesinatos', target: 15, ...period(30),
    }),
    suggest('winrate-55', 'Winrate de 55% en clasificatorias este mes', 'winrate', {
      name: 'Winrate 55% en clasificatorias', target: 55, minSample: 15, filters: { types: [DEFAULT_MATCH_TYPE] }, ...period(30),
    }),
  ];

  if (pool.length > 0) {
    suggestions.push(suggest('pool-60', `60% de partidas con ${pool.map(c => c.name).join(', ')}`, 'porcentaje_campeones', {
      name: 'Enfocar mi pool', target: 60, minSample: 10, filters: { champions: pool }, ...period(21),
    }));
  }

  return suggestions;
}

/** Borrador vacío para un objetivo personalizado de la métrica elegida. */
export function blankDraft(metricId, { timezone, now = new Date() }) {
  const today = todayIn(timezone, now);
  return draft(metricId, { name: '', startDate: today, endDate: addDays(today, 29), timezone });
}
