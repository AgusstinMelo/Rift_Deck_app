// Textos de la sección Objetivos, armados a partir de src/i18n/ui (sección "goals").
import { MATCH_TYPES } from '../../constants/matchTypes.js';
import { formatLocale, labels, tr } from '../../i18n/uiI18n.js';
import { AGGREGATION, EXCLUSION_REASON, LIFECYCLE, METRIC_FAMILY, METRIC_KIND, OPERATOR, OUTCOME } from './model/goalConstants.js';
import { getMetric, operatorOf } from './metrics/index.js';

export const OUTCOME_LABELS = labels({
  [OUTCOME.SCHEDULED]: 'goals.outcome.scheduled',
  [OUTCOME.IN_PROGRESS]: 'goals.outcome.inProgress',
  [OUTCOME.ACHIEVED]: 'goals.outcome.achieved',
  [OUTCOME.NOT_ACHIEVED]: 'goals.outcome.notAchieved',
  [OUTCOME.INCONCLUSIVE]: 'goals.outcome.inconclusive',
});

/** Estado derivado: el período cerró o el objetivo ya se alcanzó. */
export const finishedLabel = () => tr('goals.outcome.finished');

export const LIFECYCLE_LABELS = labels({
  [LIFECYCLE.ACTIVE]: 'goals.lifecycle.active',
  [LIFECYCLE.CANCELLED]: 'goals.lifecycle.cancelled',
  [LIFECYCLE.ARCHIVED]: 'goals.lifecycle.archived',
});

export const LANE_LABELS = labels({
  top: 'lanes.top', jungler: 'lanes.jungler', mid: 'lanes.mid', adc: 'lanes.adc', support: 'lanes.support',
});

export const FILTER_LABELS = labels({
  types: 'goals.filterNames.types',
  lanes: 'goals.filterNames.lanes',
  champions: 'goals.filterNames.champions',
  patches: 'goals.filterNames.patches',
});

const REASON_LABELS = labels({
  [EXCLUSION_REASON.NO_DATE]: 'goals.exclusion.noDate',
  [EXCLUSION_REASON.MISSING_RESULT]: 'goals.exclusion.missingResult',
  [EXCLUSION_REASON.MISSING_DEATHS]: 'goals.exclusion.missingDeaths',
  [EXCLUSION_REASON.MISSING_CHAMPION]: 'goals.exclusion.missingChampion',
  [EXCLUSION_REASON.MISSING_KDA]: 'goals.exclusion.missingKda',
  [EXCLUSION_REASON.MISSING_KILLS]: 'goals.exclusion.missingKills',
  [EXCLUSION_REASON.MISSING_ASSISTS]: 'goals.exclusion.missingAssists',
  [EXCLUSION_REASON.MISSING_GOLD]: 'goals.exclusion.missingGold',
  [EXCLUSION_REASON.MISSING_DURATION]: 'goals.exclusion.missingDuration',
  [EXCLUSION_REASON.NOT_A_WIN]: 'goals.exclusion.notAWin',
});

/** @param {{ reason: string, field?: string }} exclusion */
export function exclusionLabel({ reason, field }) {
  if (reason === EXCLUSION_REASON.FILTER_MISMATCH) return tr('goals.exclusion.filterMismatch', { filter: FILTER_LABELS[field] || field });
  if (reason === EXCLUSION_REASON.MISSING_FILTER_DATA) return tr('goals.exclusion.missingFilterData', { filter: FILTER_LABELS[field] || field });
  return REASON_LABELS[reason] || tr('goals.exclusion.excluded');
}

const numberFormatters = new Map();
function formatNumber(value, decimals) {
  const key = `${formatLocale()}:${decimals}`;
  if (!numberFormatters.has(key)) {
    numberFormatters.set(key, new Intl.NumberFormat(formatLocale(), { maximumFractionDigits: decimals }));
  }
  return numberFormatters.get(key).format(value);
}

/** Unidad visible de un objetivo (la del usuario en los manuales). */
export function unitOf(goal) {
  return getMetric(goal.metric).source === 'checkins' ? (goal.unit || '') : getMetric(goal.metric).unit;
}

/** Valor con su unidad; "—" si no hay dato. */
export function formatMetricValue(goal, value) {
  if (value === null || value === undefined) return '—';
  const metric = getMetric(goal.metric);
  const text = formatNumber(value, metric.decimals);
  const unit = unitOf(goal);
  if (unit === '%') return `${text}%`;
  return unit ? `${text} ${unit}` : text;
}

/** Diferencia respecto del target con signo, por ejemplo "+2,5%" o "−1 muertes". */
export function formatDifference(goal, difference) {
  if (difference === null || difference === undefined) return '—';
  const sign = difference > 0 ? '+' : difference < 0 ? '−' : '±';
  return `${sign}${formatMetricValue(goal, Math.abs(difference))}`;
}

export function formatDate(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return formatLocale() === 'en' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
}

export function formatPeriod({ startDate, endDate }) {
  return startDate === endDate ? formatDate(startDate) : `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

export const OPERATOR_LABELS = labels({ [OPERATOR.GTE]: 'goals.operator.gte', [OPERATOR.LTE]: 'goals.operator.lte' });

export const FAMILY_LABELS = labels({
  [METRIC_FAMILY.CUMULATIVE]: 'goals.family.cumulative',
  [METRIC_FAMILY.AVERAGE]: 'goals.family.average',
  [METRIC_FAMILY.PERCENTAGE]: 'goals.family.percentage',
  [METRIC_FAMILY.RECORD]: 'goals.family.record',
  [METRIC_FAMILY.MANUAL]: 'goals.family.manual',
});

/** "al menos" / "como máximo" según la dirección del objetivo. */
export function operatorPhrase(goal) {
  return tr(operatorOf(goal) === OPERATOR.LTE ? 'goals.operator.ltePhrase' : 'goals.operator.gtePhrase');
}

function listPhrase(values) {
  if (values.length <= 1) return values[0] || '';
  return `${values.slice(0, -1).join(', ')}${tr('goals.list.and')}${values[values.length - 1]}`;
}

/** Describe los filtros activos en una frase; los consumidos por la métrica se omiten. */
export function describeFilters(goal) {
  const metric = getMetric(goal.metric);
  const filters = goal.filters || {};
  const parts = [];
  if (filters.types?.length) {
    const list = listPhrase(filters.types.map(type => MATCH_TYPES.find(t => t.value === type)?.label || type));
    parts.push(tr('goals.filterPhrase.types', { list }));
  }
  if (filters.lanes?.length) {
    parts.push(tr('goals.filterPhrase.lanes', { list: listPhrase(filters.lanes.map(lane => LANE_LABELS[lane] || lane)) }));
  }
  if (filters.champions?.length && !metric.consumedFilters.includes('champions')) {
    parts.push(tr('goals.filterPhrase.champions', { list: listPhrase(filters.champions.map(champion => champion.name)) }));
  }
  if (filters.patches?.length) parts.push(tr('goals.filterPhrase.patches', { list: listPhrase(filters.patches) }));
  return parts.join(', ');
}

function objectivePhrase(goal) {
  const target = formatMetricValue(goal, Number(goal.target));
  const filters = describeFilters(goal);
  const withFilters = filters ? ` ${filters}` : '';
  const vars = { target, filters: withFilters, op: operatorPhrase(goal) };
  switch (goal.metric) {
    case 'porcentaje_campeones':
      return tr('goals.objective.porcentaje_campeones', {
        ...vars,
        champions: listPhrase((goal.filters?.champions || []).map(c => c.name)),
      });
    case 'min_muertes':
      return tr(Number(goal.target) === 0 ? 'goals.objective.noDeaths' : 'goals.objective.min_muertes', vars);
    case 'partidas_registradas':
    case 'victorias':
    case 'winrate':
    case 'promedio_kda':
    case 'promedio_duracion':
    case 'manual':
    case 'suma_duracion':
    case 'max_kda':
    case 'min_duracion':
      return tr(`goals.objective.${goal.metric}`, vars);
    default:
      break;
  }
  switch (getMetric(goal.metric).aggregation) {
    case AGGREGATION.AVERAGE:
      return tr('goals.objective.average', vars);
    case AGGREGATION.TOTAL:
      return tr('goals.objective.total', vars);
    case AGGREGATION.BEST:
      return tr('goals.objective.best', vars);
    default:
      return tr('goals.objective.default', vars);
  }
}

/**
 * Resumen en lenguaje natural de qué quiere conseguir el usuario y cómo se calcula.
 * @param {any} goal  Objetivo con metric, target, min_sample/minSample, filters, unit
 * @param {{ startDate: string, endDate: string, timezone: string }} period
 */
export function describeGoal(goal, period) {
  const metric = getMetric(goal.metric);
  const minSample = goal.min_sample ?? goal.minSample;
  const range = tr('goals.calc.range', {
    start: formatDate(period.startDate),
    end: formatDate(period.endDate),
    timezone: period.timezone,
  });
  const calculation = [];

  if (metric.source === 'matches') {
    const filters = describeFilters(goal);
    calculation.push(filters
      ? tr('goals.calc.matchesFiltered', { range, filters })
      : tr('goals.calc.matches', { range }));
  } else {
    calculation.push(tr('goals.calc.checkins', { range }));
  }

  if (goal.metric === 'winrate') {
    calculation.push(tr('goals.calc.winrateDivide'));
    calculation.push(tr('goals.calc.winrateNote'));
  }
  if (goal.metric === 'promedio_kda') {
    calculation.push(tr('goals.calc.kda'));
  }
  if (metric.aggregation === AGGREGATION.TOTAL && metric.stat !== 'partidas' && metric.source === 'matches') {
    calculation.push(tr('goals.calc.sum'));
  }
  if (metric.aggregation === AGGREGATION.BEST) {
    calculation.push(tr(operatorOf(goal) === OPERATOR.LTE ? 'goals.calc.bestLte' : 'goals.calc.best'));
  }
  if (goal.metric === 'min_duracion') {
    calculation.push(tr('goals.calc.winsOnly'));
  }
  if (/** @type {string[]} */ ([AGGREGATION.AVERAGE, AGGREGATION.TOTAL, AGGREGATION.BEST]).includes(metric.aggregation)
    && !['partidas', 'victorias', 'manual'].includes(metric.stat)) {
    calculation.push(tr('goals.calc.noZero'));
  }
  if (goal.metric === 'porcentaje_campeones') {
    calculation.push(tr('goals.calc.poolTotal'));
  }

  const definitive = metric.kind === METRIC_KIND.CUMULATIVE
    ? tr('goals.calc.definitiveCumulative')
    : tr('goals.calc.definitivePerformance', { end: formatDate(period.endDate), minSample });

  return { objective: objectivePhrase(goal), calculation, definitive };
}
