// Esquema compartido de los check-ins de objetivos manuales.
import { z } from 'zod';
import { GOAL_LIMITS } from '../model/goalConstants.js';
import { isIsoDate, periodDates, todayIn } from '../engine/period.js';
import { errorsByField } from './goalSchema.js';

/**
 * @param {{ period_start: string, period_end: string, timezone: string }} goal
 * @param {{ now?: Date }} [options]
 */
export function checkinInputSchema(goal, { now = new Date() } = {}) {
  const { startDate, endDate } = periodDates(goal);
  const today = todayIn(goal.timezone, now);

  return z.object({
    amount: z.preprocess(
      value => (value === '' || value === null || value === undefined ? undefined : Number(value)),
      z.number({ required_error: 'Ingresá una cantidad.', invalid_type_error: 'Ingresá una cantidad.' })
        .finite('Ingresá una cantidad.')
        .positive('La cantidad debe ser mayor que cero.')
        .max(GOAL_LIMITS.CHECKIN_MAX, `La cantidad máxima es ${GOAL_LIMITS.CHECKIN_MAX}.`)
        .refine(value => Math.abs(Math.round(value * 100) - value * 100) < 1e-6, 'Admite hasta dos decimales.'),
    ),
    date: z.string({ required_error: 'Elegí una fecha.' })
      .refine(isIsoDate, 'La fecha no es válida.')
      .refine(date => !isIsoDate(date) || (date >= startDate && date <= endDate), 'La fecha debe estar dentro del período del objetivo.')
      .refine(date => !isIsoDate(date) || date <= today, 'La fecha no puede ser futura.'),
    note: z.preprocess(
      value => (typeof value === 'string' && value.trim() === '' ? null : value ?? null),
      z.string().trim().max(GOAL_LIMITS.NOTE_MAX, `La nota admite hasta ${GOAL_LIMITS.NOTE_MAX} caracteres.`).nullable(),
    ),
  });
}

/**
 * @returns {{ success: true, data: { amount: number, date: string, note: string|null } } | { success: false, errors: Record<string, string> }}
 */
export function validateCheckinInput(goal, input, { now = new Date() } = {}) {
  const result = checkinInputSchema(goal, { now }).safeParse(input);
  if (!result.success) return { success: false, errors: errorsByField(result.error) };
  return { success: true, data: /** @type {{ amount: number, date: string, note: string|null }} */ (result.data) };
}

export function toCheckinRecord(data) {
  return { amount: data.amount, checkin_date: data.date, note: data.note };
}
