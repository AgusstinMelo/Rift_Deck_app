import { periodBounds } from '../../src/features/goals/engine/period.js';

let nextId = 1;

export function makeGoal({
  metric = 'partidas_registradas',
  target = 5,
  minSample = null,
  filters = {},
  startDate = '2026-10-01',
  endDate = '2026-10-31',
  timezone = 'UTC',
  lifecycle = 'activo',
  unit = null,
} = {}) {
  return {
    id: 'goal-1',
    name: 'Objetivo de prueba',
    metric,
    target,
    min_sample: minSample,
    unit,
    filters,
    timezone,
    lifecycle,
    ...periodBounds(startDate, endDate, timezone),
  };
}

export function makeMatch(overrides = {}) {
  return {
    id: `m${nextId++}`,
    date: '2026-10-10',
    hour: null,
    result: 'win',
    kills: 5,
    deaths: 3,
    assists: 7,
    lane: 'mid',
    type: 'ranked',
    own_champion_id: 'ahri',
    own_champion_name: 'Ahri',
    patch: '7.3a',
    created_at: '2026-10-10T20:00:00Z',
    ...overrides,
  };
}

export function matches(count, overrides = {}) {
  return Array.from({ length: count }, () => makeMatch(overrides));
}

/** Instante "durante el período" y "después del cierre" para el período por defecto. */
export const MID_PERIOD = new Date('2026-10-15T12:00:00Z');
export const AFTER_CLOSE = new Date('2026-11-02T12:00:00Z');
export const BEFORE_START = new Date('2026-09-20T12:00:00Z');
