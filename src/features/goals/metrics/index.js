// Punto de entrada: registra las métricas del MVP una sola vez.
import { MVP_METRICS } from './definitions.js';
import { hasMetric, registerMetric } from './registry.js';

MVP_METRICS.forEach(metric => {
  if (!hasMetric(metric.id)) registerMetric(metric);
});

export { getMetric, hasMetric, isPerformanceMetric, listMetrics, operatorOf, registerMetric } from './registry.js';
