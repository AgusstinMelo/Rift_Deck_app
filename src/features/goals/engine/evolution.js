// Serie temporal del valor de un objetivo a lo largo de su período.
import { getMetric } from '../metrics/index.js';

/**
 * Valor acumulado de la métrica al cierre de cada día con datos.
 * @param {string} metricId
 * @param {import('../model/goalConstants.js').Contribution[]} contributions  Ordenadas por fecha.
 * @returns {{ date: string, value: number|null, sample: number }[]}
 */
export function evolutionSeries(metricId, contributions) {
  const metric = getMetric(metricId);
  const series = [];
  const values = [];

  contributions.forEach((contribution, index) => {
    values.push(contribution.value);
    const next = contributions[index + 1];
    if (next && next.date === contribution.date) return;
    series.push({ date: contribution.date, value: metric.aggregate(values), sample: values.length });
  });

  return series;
}
