// Punto de entrada: registra las métricas del MVP una sola vez.
import { MVP_METRICS } from './definitions.js';
import { hasMetric, registerMetric } from './registry.js';

MVP_METRICS.forEach(metric => {
  if (!hasMetric(metric.id)) registerMetric(metric);
});

export {
  aggregationsFor, findMetric, getMetric, hasMetric, isPerformanceMetric, listMetrics, listStats, operatorOf, registerMetric,
} from './registry.js';
export { AGGREGATION_LABELS, STATS } from './definitions.js';
