// Textos de la sección Objetivos. El proyecto no tiene i18n: se centralizan acá.
import { MATCH_TYPES } from '../../constants/matchTypes.js';
import { AGGREGATION, EXCLUSION_REASON, LIFECYCLE, METRIC_FAMILY, METRIC_KIND, OPERATOR, OUTCOME } from './model/goalConstants.js';
import { getMetric, operatorOf } from './metrics/index.js';

export const OUTCOME_LABELS = {
  [OUTCOME.SCHEDULED]: 'Programado',
  [OUTCOME.IN_PROGRESS]: 'En curso',
  [OUTCOME.ACHIEVED]: 'Alcanzado',
  [OUTCOME.NOT_ACHIEVED]: 'No alcanzado',
  [OUTCOME.INCONCLUSIVE]: 'No concluyente',
};

export const LIFECYCLE_LABELS = {
  [LIFECYCLE.ACTIVE]: 'Activo',
  [LIFECYCLE.CANCELLED]: 'Cancelado',
  [LIFECYCLE.ARCHIVED]: 'Archivado',
};

export const LANE_LABELS = { top: 'Top', jungler: 'Jungla', mid: 'Mid', adc: 'ADC', support: 'Support' };

export const FILTER_LABELS = { types: 'tipo de partida', lanes: 'línea', champions: 'campeón', patches: 'parche' };

const REASON_LABELS = {
  [EXCLUSION_REASON.NO_DATE]: 'No tiene fecha de juego ni de registro',
  [EXCLUSION_REASON.MISSING_RESULT]: 'No tiene resultado registrado',
  [EXCLUSION_REASON.MISSING_DEATHS]: 'No tiene muertes registradas',
  [EXCLUSION_REASON.MISSING_CHAMPION]: 'No tiene campeón registrado',
  [EXCLUSION_REASON.MISSING_KDA]: 'No tiene asesinatos, muertes y asistencias registrados',
  [EXCLUSION_REASON.MISSING_KILLS]: 'No tiene asesinatos registrados',
  [EXCLUSION_REASON.MISSING_ASSISTS]: 'No tiene asistencias registradas',
  [EXCLUSION_REASON.MISSING_GOLD]: 'No tiene oro registrado',
  [EXCLUSION_REASON.MISSING_DURATION]: 'No tiene duración registrada',
  [EXCLUSION_REASON.NOT_A_WIN]: 'Es una derrota: solo cuentan las victorias',
};

/** @param {{ reason: string, field?: string }} exclusion */
export function exclusionLabel({ reason, field }) {
  if (reason === EXCLUSION_REASON.FILTER_MISMATCH) return `No cumple el filtro de ${FILTER_LABELS[field] || field}`;
  if (reason === EXCLUSION_REASON.MISSING_FILTER_DATA) return `Falta el dato de ${FILTER_LABELS[field] || field}`;
  return REASON_LABELS[reason] || 'Excluida';
}

const numberFormatters = new Map();
function formatNumber(value, decimals) {
  if (!numberFormatters.has(decimals)) {
    numberFormatters.set(decimals, new Intl.NumberFormat('es-AR', { maximumFractionDigits: decimals }));
  }
  return numberFormatters.get(decimals).format(value);
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
  return `${day}/${month}/${year}`;
}

export function formatPeriod({ startDate, endDate }) {
  return startDate === endDate ? formatDate(startDate) : `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

export const OPERATOR_LABELS = { [OPERATOR.GTE]: 'Al menos', [OPERATOR.LTE]: 'Como máximo' };

export const FAMILY_LABELS = {
  [METRIC_FAMILY.CUMULATIVE]: 'Acumulativos',
  [METRIC_FAMILY.AVERAGE]: 'Promedios',
  [METRIC_FAMILY.PERCENTAGE]: 'Porcentajes',
  [METRIC_FAMILY.RECORD]: 'Únicos',
  [METRIC_FAMILY.MANUAL]: 'Manuales',
};

/** "al menos" / "como máximo" según la dirección del objetivo. */
export function operatorPhrase(goal) {
  return operatorOf(goal) === OPERATOR.LTE ? 'como máximo' : 'al menos';
}

function listPhrase(values) {
  if (values.length <= 1) return values[0] || '';
  return `${values.slice(0, -1).join(', ')} y ${values[values.length - 1]}`;
}

/** Describe los filtros activos en una frase; los consumidos por la métrica se omiten. */
export function describeFilters(goal) {
  const metric = getMetric(goal.metric);
  const filters = goal.filters || {};
  const parts = [];
  if (filters.types?.length) {
    parts.push(`de tipo ${listPhrase(filters.types.map(type => MATCH_TYPES.find(t => t.value === type)?.label || type))}`);
  }
  if (filters.lanes?.length) parts.push(`en ${listPhrase(filters.lanes.map(lane => LANE_LABELS[lane] || lane))}`);
  if (filters.champions?.length && !metric.consumedFilters.includes('champions')) {
    parts.push(`con ${listPhrase(filters.champions.map(champion => champion.name))}`);
  }
  if (filters.patches?.length) parts.push(`del parche ${listPhrase(filters.patches)}`);
  return parts.join(', ');
}

function objectivePhrase(goal) {
  const target = formatMetricValue(goal, Number(goal.target));
  const filters = describeFilters(goal);
  const withFilters = filters ? ` ${filters}` : '';
  const op = operatorPhrase(goal);
  switch (goal.metric) {
    case 'partidas_registradas':
      return `Registrar al menos ${target}${withFilters}.`;
    case 'victorias':
      return `Ganar al menos ${target}${withFilters}.`;
    case 'winrate':
      return `Tener un winrate de ${op} ${target} en tus partidas${withFilters}.`;
    case 'porcentaje_campeones':
      return `Que ${op} el ${target} de tus partidas${withFilters} sean con ${listPhrase((goal.filters?.champions || []).map(c => c.name))}.`;
    case 'promedio_kda':
      return `Tener un KDA promedio de ${op} ${target}${withFilters}.`;
    case 'promedio_duracion':
      return `Que tus partidas duren en promedio ${op} ${target}${withFilters}.`;
    case 'manual':
      return `Sumar al menos ${target} con check-ins manuales.`;
    case 'suma_duracion':
      return `Jugar al menos ${target} en total${withFilters}.`;
    case 'max_kda':
      return `Lograr una partida con KDA de al menos ${target}${withFilters}.`;
    case 'min_muertes':
      return Number(goal.target) === 0
        ? `Lograr una partida sin morir${withFilters}.`
        : `Lograr una partida con ${target} o menos${withFilters}.`;
    case 'min_duracion':
      return `Ganar una partida en ${target} o menos${withFilters}.`;
    default:
      break;
  }
  switch (getMetric(goal.metric).aggregation) {
    case AGGREGATION.AVERAGE:
      return `Promediar ${op} ${target} por partida${withFilters}.`;
    case AGGREGATION.TOTAL:
      return `Sumar al menos ${target} en total${withFilters}.`;
    case AGGREGATION.BEST:
      return `Lograr una partida con al menos ${target}${withFilters}.`;
    default:
      return `Llegar a ${op} ${target}${withFilters}.`;
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
  const range = `entre el ${formatDate(period.startDate)} y el ${formatDate(period.endDate)} (ambos incluidos, zona ${period.timezone})`;
  const calculation = [];

  if (metric.source === 'matches') {
    calculation.push(`Cuentan las partidas cuya fecha de juego cae ${range}${describeFilters(goal) ? ` y que son ${describeFilters(goal)}` : ''}.`);
  } else {
    calculation.push(`Cuentan los check-ins con fecha ${range}.`);
  }

  if (goal.metric === 'winrate') {
    calculation.push('Se dividen las victorias por las partidas con resultado registrado.');
    calculation.push('El winrate registrado depende de las partidas que cargues: no equivale a tu rango real.');
  }
  if (goal.metric === 'promedio_kda') {
    calculation.push('El KDA de cada partida es (asesinatos + asistencias) / muertes; con 0 muertes vale asesinatos + asistencias.');
  }
  if (metric.aggregation === AGGREGATION.TOTAL && metric.stat !== 'partidas' && metric.source === 'matches') {
    calculation.push('Se suma el valor de cada partida.');
  }
  if (metric.aggregation === AGGREGATION.BEST) {
    calculation.push(operatorOf(goal) === OPERATOR.LTE
      ? 'Es un objetivo único: alcanza con que una sola partida quede en la meta o por debajo.'
      : 'Es un objetivo único: alcanza con que una sola partida llegue a la meta.');
  }
  if (goal.metric === 'min_duracion') {
    calculation.push('Solo cuentan las victorias: las derrotas se excluyen.');
  }
  if (/** @type {string[]} */ ([AGGREGATION.AVERAGE, AGGREGATION.TOTAL, AGGREGATION.BEST]).includes(metric.aggregation)
    && !['partidas', 'victorias', 'manual'].includes(metric.stat)) {
    calculation.push('Las partidas sin ese dato registrado no cuentan: no se toman como cero.');
  }
  if (goal.metric === 'porcentaje_campeones') {
    calculation.push('El total son todas las partidas válidas del período que cumplen los demás filtros, juegues el campeón que juegues.');
  }

  const definitive = metric.kind === METRIC_KIND.CUMULATIVE
    ? 'Se marca como alcanzado apenas llegues a la meta, aunque el período siga abierto. Si después eliminás datos y quedás por debajo, vuelve a estar en curso.'
    : `Mientras el período esté abierto el resultado es provisional. Se define al cierre del ${formatDate(period.endDate)}: si hay menos de ${minSample} partidas válidas queda no concluyente.`;

  return { objective: objectivePhrase(goal), calculation, definitive };
}
