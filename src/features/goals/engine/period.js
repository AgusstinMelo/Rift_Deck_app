// Manejo de períodos y zonas horarias con Intl (sin dependencias externas).
import { PERIOD_STATUS } from '../model/goalConstants.js';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const formatterCache = new Map();

function partsFormatter(timeZone) {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(timeZone, new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }));
  }
  return formatterCache.get(timeZone);
}

function zonedParts(instantMs, timeZone) {
  const parts = {};
  for (const part of partsFormatter(timeZone).formatToParts(new Date(instantMs))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return parts;
}

/** Diferencia (ms) entre la hora local de la zona y UTC en ese instante. */
function offsetAt(instantMs, timeZone) {
  const p = zonedParts(instantMs, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - (instantMs - (instantMs % 1000 + 1000) % 1000);
}

/** true si el nombre es una zona horaria IANA reconocida por el entorno. */
export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Zona horaria del navegador o del proceso; UTC como respaldo. */
export function detectTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** true si es una fecha de calendario válida con formato YYYY-MM-DD. */
export function isIsoDate(value) {
  const match = DATE_PATTERN.exec(String(value ?? ''));
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Fecha local (YYYY-MM-DD) de un instante en una zona horaria. */
export function toLocalDate(instant, timeZone) {
  const ms = instant instanceof Date ? instant.getTime() : new Date(instant).getTime();
  if (!Number.isFinite(ms)) return null;
  const p = zonedParts(ms, timeZone);
  return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/**
 * Instante UTC que corresponde a una hora de pared en la zona dada.
 * Si la hora se repite (fin del horario de verano) devuelve la primera ocurrencia;
 * si no existe (inicio del horario de verano) devuelve el primer instante válido posterior.
 */
export function zonedWallTimeToUtc(isoDate, timeZone, { hour = 0, minute = 0, second = 0, ms = 0 } = {}) {
  const [, y, m, d] = DATE_PATTERN.exec(isoDate).map(Number);
  const wall = Date.UTC(y, m - 1, d, hour, minute, second, ms);
  const candidates = [...new Set([
    wall - offsetAt(wall - DAY_MS / 2, timeZone),
    wall - offsetAt(wall + DAY_MS / 2, timeZone),
  ])];
  const exact = candidates.filter(candidate => candidate + offsetAt(candidate, timeZone) === wall);
  return new Date(exact.length ? Math.min(...exact) : Math.max(...candidates));
}

/** Inicio del día inicial y final del día final, ambos inclusivos, en la zona dada. */
export function periodBounds(startDate, endDate, timeZone) {
  const start = zonedWallTimeToUtc(startDate, timeZone);
  const nextDayStart = zonedWallTimeToUtc(addDays(endDate, 1), timeZone);
  return {
    period_start: start.toISOString(),
    period_end: new Date(nextDayStart.getTime() - 1).toISOString(),
  };
}

/** Fechas locales (inclusivas) de un objetivo persistido. */
export function periodDates(goal) {
  return {
    startDate: toLocalDate(goal.period_start, goal.timezone),
    endDate: toLocalDate(goal.period_end, goal.timezone),
  };
}

/** Estado del período respecto de `now`. */
export function periodStatus(goal, now) {
  const nowMs = now.getTime();
  if (nowMs < new Date(goal.period_start).getTime()) return PERIOD_STATUS.SCHEDULED;
  if (nowMs > new Date(goal.period_end).getTime()) return PERIOD_STATUS.CLOSED;
  return PERIOD_STATUS.OPEN;
}

/** Suma días a una fecha YYYY-MM-DD. */
export function addDays(isoDate, days) {
  const [, y, m, d] = DATE_PATTERN.exec(isoDate).map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Días calendario entre dos fechas, contando ambas puntas. */
export function inclusiveDayCount(startDate, endDate) {
  const [, y1, m1, d1] = DATE_PATTERN.exec(startDate).map(Number);
  const [, y2, m2, d2] = DATE_PATTERN.exec(endDate).map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS) + 1;
}

/** Fecha local de hoy en la zona dada. */
export function todayIn(timeZone, now = new Date()) {
  return toLocalDate(now, timeZone);
}
