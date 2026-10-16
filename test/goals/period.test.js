import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, inclusiveDayCount, isIsoDate, isValidTimeZone, periodBounds, periodDates, toLocalDate,
} from '../../src/features/goals/engine/period.js';

const ZONES = ['UTC', 'America/Argentina/Buenos_Aires', 'America/Santiago', 'America/Mexico_City', 'Europe/Madrid', 'Asia/Tokyo', 'Pacific/Auckland'];

test('periodBounds y periodDates son inversas en distintas zonas, incluso con cambios de horario', () => {
  const ranges = [['2026-01-01', '2026-12-31'], ['2026-09-06', '2026-09-06'], ['2026-10-25', '2026-10-25'], ['2026-03-29', '2026-04-05']];
  for (const timezone of ZONES) {
    for (const [startDate, endDate] of ranges) {
      const bounds = periodBounds(startDate, endDate, timezone);
      assert.deepEqual(periodDates({ ...bounds, timezone }), { startDate, endDate }, `${timezone} ${startDate}..${endDate}`);
      const nextDayStart = periodBounds(addDays(endDate, 1), addDays(endDate, 1), timezone).period_start;
      assert.equal(new Date(nextDayStart).getTime() - new Date(bounds.period_end).getTime(), 1, 'el final es 1 ms antes del día siguiente');
    }
  }
});

test('un día con cambio de horario dura 25 horas en Madrid', () => {
  const { period_start, period_end } = periodBounds('2026-10-25', '2026-10-25', 'Europe/Madrid');
  assert.equal(new Date(period_end).getTime() - new Date(period_start).getTime() + 1, 25 * 3600 * 1000);
});

test('toLocalDate cerca de medianoche', () => {
  assert.equal(toLocalDate('2026-10-08T02:59:59Z', 'America/Argentina/Buenos_Aires'), '2026-10-07');
  assert.equal(toLocalDate('2026-10-08T03:00:00Z', 'America/Argentina/Buenos_Aires'), '2026-10-08');
  assert.equal(toLocalDate('2026-10-07T15:00:00Z', 'Asia/Tokyo'), '2026-10-08');
});

test('utilidades de fecha', () => {
  assert.equal(isIsoDate('2026-02-28'), true);
  assert.equal(isIsoDate('2026-02-30'), false);
  assert.equal(isIsoDate('2026-2-3'), false);
  assert.equal(inclusiveDayCount('2026-10-01', '2026-10-01'), 1);
  assert.equal(inclusiveDayCount('2026-01-01', '2026-12-31'), 365);
  assert.equal(isValidTimeZone('America/Argentina/Buenos_Aires'), true);
  assert.equal(isValidTimeZone('Mars/Olympus'), false);
});
