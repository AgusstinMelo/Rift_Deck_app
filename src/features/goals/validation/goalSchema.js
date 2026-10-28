// Esquema compartido entre la UI y la capa de datos para crear y editar objetivos.
import { z } from 'zod';
import { getMetric, hasMetric, operatorOf } from '../metrics/index.js';
import { GOAL_LIMITS, LIFECYCLE, METRIC_KIND, OUTCOME, PERIOD_STATUS } from '../model/goalConstants.js';
import { compactFilters, filtersSchemaFor, getFilter } from '../filters/filterRegistry.js';
import {
  inclusiveDayCount, isIsoDate, isValidTimeZone, periodBounds, periodDates, periodStatus, todayIn,
} from '../engine/period.js';
import { tr } from '../../../i18n/uiI18n.js';

const emptyToNull = value => (value === '' || value === undefined ? null : value);
const optionalNumber = () => z.preprocess(
  value => (value === '' || value === null || value === undefined ? null : Number(value)),
  z.number({ invalid_type_error: tr('goals.validation.enterNumber') }).finite(tr('goals.validation.enterNumber')).nullable(),
);

const hasAtMostTwoDecimals = value => Math.abs(Math.round(value * 100) - value * 100) < 1e-6;

// Se arma en cada validación para que los mensajes salgan en el idioma activo.
const goalInputBase = () => z.object({
  name: z.string({ required_error: tr('goals.validation.nameRequired') }).trim()
    .min(1, tr('goals.validation.nameRequired'))
    .max(GOAL_LIMITS.NAME_MAX, tr('goals.validation.nameMax', { max: GOAL_LIMITS.NAME_MAX })),
  description: z.preprocess(emptyToNull, z.string().trim()
    .max(GOAL_LIMITS.DESCRIPTION_MAX, tr('goals.validation.descriptionMax', { max: GOAL_LIMITS.DESCRIPTION_MAX }))
    .nullable()),
  metric: z.string({ required_error: tr('goals.validation.chooseMetric') }).refine(hasMetric, tr('goals.validation.unknownMetric')),
  operator: z.preprocess(emptyToNull, z.string().nullable()).default(null),
  target: optionalNumber(),
  minSample: optionalNumber(),
  unit: z.preprocess(emptyToNull, z.string().trim().nullable()),
  filters: z.record(z.any()).default({}),
  startDate: z.string({ required_error: tr('goals.validation.chooseStart') }),
  endDate: z.string({ required_error: tr('goals.validation.chooseEnd') }),
  timezone: z.string({ required_error: tr('goals.validation.missingTimezone') }),
});

function issue(ctx, path, message) {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
}

function refineTarget(input, metric, ctx) {
  const { target } = input;
  const range = metric.target;
  if (target === null) return issue(ctx, ['target'], tr('goals.validation.enterTarget'));
  if (target < range.min || target > range.max) {
    return issue(ctx, ['target'], tr('goals.validation.targetRange', { min: range.min, max: range.max }));
  }
  if (range.integer && !Number.isInteger(target)) return issue(ctx, ['target'], tr('goals.validation.targetInteger'));
  if (!hasAtMostTwoDecimals(target)) issue(ctx, ['target'], tr('goals.validation.targetDecimals'));
}

function refineOperator(input, metric, ctx) {
  if (input.operator !== null && !metric.operators.includes(input.operator)) {
    issue(ctx, ['operator'], tr('goals.validation.operatorOnly', {
      metric: metric.label,
      operator: tr(metric.operator === 'lte' ? 'goals.operator.ltePhrase' : 'goals.operator.gtePhrase'),
    }));
  }
}

function refineMinSample(input, metric, ctx) {
  if (metric.kind !== METRIC_KIND.PERFORMANCE) return;
  const { minSample } = input;
  if (minSample === null) return issue(ctx, ['minSample'], tr('goals.validation.enterMinSample'));
  if (!Number.isInteger(minSample) || minSample < 1 || minSample > GOAL_LIMITS.MIN_SAMPLE_MAX) {
    issue(ctx, ['minSample'], tr('goals.validation.minSampleRange', { max: GOAL_LIMITS.MIN_SAMPLE_MAX }));
  }
}

function refineUnit(input, metric, ctx) {
  if (metric.source !== 'checkins') return;
  if (!input.unit) return issue(ctx, ['unit'], tr('goals.validation.unitRequired'));
  if (input.unit.length > GOAL_LIMITS.UNIT_MAX) issue(ctx, ['unit'], tr('goals.validation.unitMax', { max: GOAL_LIMITS.UNIT_MAX }));
}

function refineFilters(input, metric, ctx) {
  const filters = compactFilters(input.filters);
  const result = filtersSchemaFor(metric.allowedFilters, metric.requiredFilters).safeParse(filters);
  if (result.success) return;

  for (const zodIssue of result.error.issues) {
    if (zodIssue.code === z.ZodIssueCode.unrecognized_keys) {
      zodIssue.keys.forEach(key => {
        const label = (() => { try { return getFilter(key).label; } catch { return key; } })();
        issue(ctx, ['filters', key], tr('goals.validation.filterIncompatible', { filter: label, metric: metric.label }));
      });
    } else {
      issue(ctx, ['filters', ...zodIssue.path], zodIssue.message);
    }
  }
}

function refinePeriod(input, ctx, { today, requireOpenEnd }) {
  const { startDate, endDate } = input;
  if (!isIsoDate(startDate)) issue(ctx, ['startDate'], tr('goals.validation.invalidStart'));
  if (!isIsoDate(endDate)) issue(ctx, ['endDate'], tr('goals.validation.invalidEnd'));
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) return;

  if (endDate < startDate) return issue(ctx, ['endDate'], tr('goals.validation.endBeforeStart'));
  if (inclusiveDayCount(startDate, endDate) > GOAL_LIMITS.MAX_PERIOD_DAYS) {
    issue(ctx, ['endDate'], tr('goals.validation.periodMax', { max: GOAL_LIMITS.MAX_PERIOD_DAYS }));
  }
  if (requireOpenEnd && today && endDate < today) issue(ctx, ['endDate'], tr('goals.validation.endInPast'));
}

/**
 * Esquema de entrada de un objetivo.
 * @param {{ now?: Date, requireOpenEnd?: boolean }} [options]
 */
export function goalInputSchema({ now = new Date(), requireOpenEnd = true } = {}) {
  return goalInputBase().superRefine((input, ctx) => {
    if (!isValidTimeZone(input.timezone)) issue(ctx, ['timezone'], tr('goals.validation.invalidTimezone'));
    if (!hasMetric(input.metric)) return;

    const metric = getMetric(input.metric);
    const today = isValidTimeZone(input.timezone) ? todayIn(input.timezone, now) : null;
    refineOperator(input, metric, ctx);
    refineTarget(input, metric, ctx);
    refineMinSample(input, metric, ctx);
    refineUnit(input, metric, ctx);
    refineFilters(input, metric, ctx);
    refinePeriod(input, ctx, { today, requireOpenEnd });
  }).transform(input => {
    const metric = getMetric(input.metric);
    return {
      ...input,
      operator: input.operator ?? metric.operator,
      filters: metric.allowedFilters.length ? compactFilters(input.filters) : {},
      minSample: metric.kind === METRIC_KIND.PERFORMANCE ? input.minSample : null,
      unit: metric.source === 'checkins' ? input.unit : null,
    };
  });
}

/** Convierte errores de zod en un mapa `campo → mensaje` (primer error por campo). */
export function errorsByField(error) {
  /** @type {Record<string, string>} */
  const errors = {};
  for (const zodIssue of error.issues) {
    const key = zodIssue.path.join('.') || '_';
    if (!errors[key]) errors[key] = zodIssue.message;
  }
  return errors;
}

/**
 * Valida la entrada de un objetivo nuevo.
 * @returns {{ success: true, data: any } | { success: false, errors: Record<string, string> }}
 */
export function validateGoalInput(input, { now = new Date() } = {}) {
  const result = goalInputSchema({ now }).safeParse(input);
  return result.success ? { success: true, data: result.data } : { success: false, errors: errorsByField(result.error) };
}

/** Fila de la base a partir de una entrada ya validada. */
export function toGoalRecord(data) {
  return {
    name: data.name,
    description: data.description,
    metric: data.metric,
    operator: data.operator,
    target: data.target,
    min_sample: data.minSample,
    unit: data.unit,
    filters: data.filters,
    timezone: data.timezone,
    ...periodBounds(data.startDate, data.endDate, data.timezone),
  };
}

/** Valores de formulario a partir de un objetivo persistido. */
export function goalToInput(goal) {
  const { startDate, endDate } = periodDates(goal);
  return {
    name: goal.name,
    description: goal.description ?? '',
    metric: goal.metric,
    operator: operatorOf(goal),
    target: Number(goal.target),
    minSample: goal.min_sample ?? null,
    unit: goal.unit ?? '',
    filters: goal.filters || {},
    startDate,
    endDate,
    timezone: goal.timezone,
  };
}

/** Qué se puede editar de un objetivo en este momento. */
/**
 * Qué se puede hacer con un objetivo en este momento.
 * Con la evaluación, un objetivo ya alcanzado antes del cierre cuenta como finalizado:
 * se puede archivar (no cancelar) y su configuración sigue editable mientras el período esté abierto.
 * @param {any} goal
 * @param {Date} [now]
 * @param {{ outcome: string } | null} [evaluation]
 */
export function editPermissions(goal, now = new Date(), evaluation = null) {
  const isActive = goal.lifecycle === LIFECYCLE.ACTIVE;
  const status = periodStatus(goal, now);
  const isClosed = status === PERIOD_STATUS.CLOSED;
  const isFinished = isClosed || evaluation?.outcome === OUTCOME.ACHIEVED;
  return {
    canEditTexts: true,
    canEditConfig: isActive && !isClosed,
    canEditMetric: false,
    // Un objetivo en juego se cancela; uno finalizado (cerrado o alcanzado) o cancelado se archiva.
    canCancel: isActive && !isFinished,
    canArchive: goal.lifecycle === LIFECYCLE.CANCELLED || (isActive && isFinished),
  };
}

const CONFIG_KEYS = ['operator', 'target', 'minSample', 'unit', 'filters', 'startDate', 'endDate', 'timezone'];

function sameValue(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Valida una edición respetando las reglas de ciclo de vida y período.
 * @returns {{ success: true, patch: Record<string, any> } | { success: false, errors: Record<string, string> }}
 */
export function validateGoalUpdate(goal, input, { now = new Date() } = {}) {
  const permissions = editPermissions(goal, now);
  if (input.metric !== undefined && input.metric !== goal.metric) {
    return { success: false, errors: { metric: tr('goals.validation.metricLocked') } };
  }

  const current = goalToInput(goal);
  const merged = { ...current, ...input, metric: goal.metric };

  if (!permissions.canEditConfig) {
    const changed = CONFIG_KEYS.filter(key => key in input && !sameValue(
      key === 'filters' ? compactFilters(input.filters) : input[key],
      key === 'filters' ? compactFilters(current.filters) : current[key],
    ));
    if (changed.length) {
      return {
        success: false,
        errors: Object.fromEntries(changed.map(key => [key, tr('goals.validation.configLocked')])),
      };
    }
    const result = goalInputSchema({ now, requireOpenEnd: false }).safeParse(merged);
    if (!result.success) return { success: false, errors: errorsByField(result.error) };
    return { success: true, patch: { name: result.data.name, description: result.data.description } };
  }

  const result = goalInputSchema({ now }).safeParse(merged);
  if (!result.success) return { success: false, errors: errorsByField(result.error) };
  const { metric: _metric, ...patch } = toGoalRecord(result.data);
  return { success: true, patch };
}
