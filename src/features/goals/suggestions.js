// Objetivos sugeridos con valores por defecto razonables.
import { DEFAULT_MATCH_TYPE } from '../../constants/matchTypes.js';
import { addDays, todayIn } from './engine/period.js';
import { championOf } from './engine/matchFacts.js';
import { getMetric } from './metrics/index.js';

export const GOAL_CATEGORIES = [
  { id: 'constancia', label: 'Constancia', description: 'Sostener el hábito de jugar y registrar.' },
  { id: 'resultados', label: 'Resultados', description: 'Mejorar lo que pasa en tus partidas.' },
  { id: 'pool', label: 'Pool de campeones', description: 'Enfocarte en pocos campeones.' },
  { id: 'habitos', label: 'Hábitos', description: 'Metas propias que registrás a mano.' },
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
    target: metric.target.default,
    minSample: metric.defaultMinSample,
    unit: '',
    filters: {},
    description: '',
    ...overrides,
  };
}

/**
 * Sugerencias listas para el paso de configuración.
 * @param {{ timezone: string, now?: Date, matches?: any[] }} context
 */
export function buildSuggestions({ timezone, now = new Date(), matches = [] }) {
  const today = todayIn(timezone, now);
  const period = days => ({ startDate: today, endDate: addDays(today, days - 1), timezone });
  const pool = topChampions(matches);

  const suggestions = [
    {
      id: 'registrar-20',
      category: 'constancia',
      title: 'Registrar 20 partidas en 2 semanas',
      input: draft('partidas_registradas', { name: 'Registrar 20 partidas', target: 20, ...period(14) }),
    },
    {
      id: 'winrate-55',
      category: 'resultados',
      title: 'Winrate de 55% en clasificatorias este mes',
      input: draft('winrate', {
        name: 'Winrate 55% en clasificatorias', target: 55, minSample: 15,
        filters: { types: [DEFAULT_MATCH_TYPE] }, ...period(30),
      }),
    },
    {
      id: 'muertes-4',
      category: 'resultados',
      title: 'Promediar 4 muertes o menos',
      input: draft('promedio_muertes', { name: 'Morir menos', target: 4, minSample: 10, ...period(14) }),
    },
    {
      id: 'manual-replays',
      category: 'habitos',
      title: '5 horas de replays en un mes',
      input: draft('manual', { name: 'Ver replays', target: 5, unit: 'horas de replay', ...period(30) }),
    },
  ];

  if (pool.length > 0) {
    suggestions.splice(3, 0, {
      id: 'pool-60',
      category: 'pool',
      title: `60% de partidas con ${pool.map(c => c.name).join(', ')}`,
      input: draft('porcentaje_campeones', {
        name: 'Enfocar mi pool', target: 60, minSample: 10, filters: { champions: pool }, ...period(21),
      }),
    });
  }

  return suggestions;
}

/** Borrador vacío para un objetivo personalizado de la métrica elegida. */
export function blankDraft(metricId, { timezone, now = new Date() }) {
  const today = todayIn(timezone, now);
  return draft(metricId, { name: '', startDate: today, endDate: addDays(today, 29), timezone });
}
