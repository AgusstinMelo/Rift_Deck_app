import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGoal, remainingToTarget, cumulativeProgressPct } from '../../src/features/goals/engine/evaluateGoal.js';
import { evolutionSeries } from '../../src/features/goals/engine/evolution.js';
import { AFTER_CLOSE, BEFORE_START, MID_PERIOD, makeGoal, makeMatch, matches } from './helpers.js';

const perf = (metric, target, minSample, extra = {}) => makeGoal({ metric, target, minSample, ...extra });

test('usuario sin partidas: acumulativo en curso con valor 0', () => {
  const result = evaluateGoal(makeGoal({ target: 10 }), { matches: [] }, MID_PERIOD);
  assert.equal(result.outcome, 'en_curso');
  assert.equal(result.value, 0);
  assert.equal(result.sampleSize, 0);
  assert.equal(result.provisional, true);
  assert.equal(remainingToTarget(result), 10);
});

test('usuario sin partidas: rendimiento sin valor y no concluyente al cierre', () => {
  const open = evaluateGoal(perf('winrate', 55, 10), { matches: [] }, MID_PERIOD);
  assert.equal(open.outcome, 'en_curso');
  assert.equal(open.value, null);
  assert.equal(open.difference, null);
  assert.equal(open.meetsToday, false);

  const closed = evaluateGoal(perf('winrate', 55, 10), { matches: [] }, AFTER_CLOSE);
  assert.equal(closed.outcome, 'no_concluyente');
});

test('muestra insuficiente: provisional durante el período y no concluyente al cierre aunque cumpla', () => {
  const data = { matches: matches(3, { result: 'win' }) };
  const open = evaluateGoal(perf('winrate', 50, 10), data, MID_PERIOD);
  assert.equal(open.outcome, 'en_curso');
  assert.equal(open.provisional, true);
  assert.equal(open.value, 100);
  assert.equal(open.meetsToday, false, 'no cumple hoy porque no alcanza la muestra mínima');

  const closed = evaluateGoal(perf('winrate', 50, 10), data, AFTER_CLOSE);
  assert.equal(closed.outcome, 'no_concluyente');
  assert.equal(closed.provisional, false);
});

test('acumulativo: se alcanza antes del cierre en cuanto llega al target', () => {
  const result = evaluateGoal(makeGoal({ target: 5 }), { matches: matches(5) }, MID_PERIOD);
  assert.equal(result.outcome, 'alcanzado');
  assert.equal(result.provisional, false);
  assert.equal(result.difference, 0);
  assert.equal(cumulativeProgressPct(result), 100);
});

test('acumulativo: vuelve a en curso si se eliminan partidas', () => {
  const all = matches(5);
  assert.equal(evaluateGoal(makeGoal({ target: 5 }), { matches: all }, MID_PERIOD).outcome, 'alcanzado');
  const afterDelete = evaluateGoal(makeGoal({ target: 5 }), { matches: all.slice(1) }, MID_PERIOD);
  assert.equal(afterDelete.outcome, 'en_curso');
  assert.equal(afterDelete.value, 4);
  assert.equal(remainingToTarget(afterDelete), 1);
});

test('acumulativo vencido sin llegar al target: no alcanzado', () => {
  const result = evaluateGoal(makeGoal({ target: 5 }), { matches: matches(2) }, AFTER_CLOSE);
  assert.equal(result.outcome, 'no_alcanzado');
});

test('objetivo programado: el período todavía no empezó', () => {
  const result = evaluateGoal(perf('winrate', 50, 5), { matches: [] }, BEFORE_START);
  assert.equal(result.outcome, 'programado');
  assert.equal(result.periodStatus, 'scheduled');
  assert.equal(result.meetsToday, null);
});

test('winrate por encima del target a mitad del período nunca queda alcanzado antes del cierre', () => {
  const goal = perf('winrate', 60, 10);
  const firstHalf = matches(10, { result: 'win', date: '2026-10-05' });
  const mid = evaluateGoal(goal, { matches: firstHalf }, MID_PERIOD);
  assert.equal(mid.outcome, 'en_curso');
  assert.equal(mid.provisional, true);
  assert.equal(mid.meetsToday, true);

  const secondHalf = matches(10, { result: 'loss', date: '2026-10-25' });
  const closed = evaluateGoal(goal, { matches: [...firstHalf, ...secondHalf] }, AFTER_CLOSE);
  assert.equal(closed.value, 50);
  assert.equal(closed.outcome, 'no_alcanzado');
});

test('winrate igual al target cumple (comparación inclusiva)', () => {
  const data = { matches: [...matches(6, { result: 'win' }), ...matches(4, { result: 'loss' })] };
  assert.equal(evaluateGoal(perf('winrate', 60, 10), data, AFTER_CLOSE).outcome, 'alcanzado');
});

test('promedio de muertes que empeora después de mejorar', () => {
  const goal = perf('promedio_muertes', 4, 5);
  const good = matches(5, { deaths: 2, date: '2026-10-03' });
  const mid = evaluateGoal(goal, { matches: good }, MID_PERIOD);
  assert.equal(mid.value, 2);
  assert.equal(mid.meetsToday, true);
  assert.equal(mid.outcome, 'en_curso');

  const bad = matches(5, { deaths: 8, date: '2026-10-28' });
  const closed = evaluateGoal(goal, { matches: [...good, ...bad] }, AFTER_CLOSE);
  assert.equal(closed.value, 5);
  assert.equal(closed.outcome, 'no_alcanzado');
  assert.equal(closed.difference, 1);

  const series = evolutionSeries('promedio_muertes', closed.contributions);
  assert.deepEqual(series.map(point => point.value), [2, 5]);
});

test('datos faltantes se excluyen con motivo y no cuentan como cero', () => {
  const data = {
    matches: [
      makeMatch({ id: 'a', deaths: 6 }),
      makeMatch({ id: 'b', deaths: null }),
      makeMatch({ id: 'c', deaths: '' }),
      makeMatch({ id: 'd', deaths: 0 }),
      makeMatch({ id: 'e', result: null }),
    ],
  };
  const deaths = evaluateGoal(perf('promedio_muertes', 4, 1), data, MID_PERIOD);
  assert.equal(deaths.value, 3, 'promedio de 6, 0 y 3: las vacías no cuentan como cero');
  assert.deepEqual(deaths.includedIds.sort(), ['a', 'd', 'e']);
  assert.deepEqual(deaths.excluded.map(x => [x.id, x.reason]), [['b', 'sin_muertes'], ['c', 'sin_muertes']]);
  assert.equal(deaths.exclusionCounts.sin_muertes, 2);

  const wr = evaluateGoal(perf('winrate', 50, 1), data, MID_PERIOD);
  assert.equal(wr.sampleSize, 4);
  assert.deepEqual(wr.excluded, [{ id: 'e', reason: 'sin_resultado', field: 'result' }]);
});

test('partidas sin fecha jugada ni fecha de registro se excluyen', () => {
  const result = evaluateGoal(makeGoal(), { matches: [makeMatch({ id: 'x', date: null, created_at: null })] }, MID_PERIOD);
  assert.deepEqual(result.excluded, [{ id: 'x', reason: 'sin_fecha' }]);
});

test('partidas editadas o eliminadas recalculan el resultado', () => {
  const original = [makeMatch({ id: 'a', result: 'loss' }), makeMatch({ id: 'b', result: 'win' })];
  const goal = perf('winrate', 50, 2);
  assert.equal(evaluateGoal(goal, { matches: original }, AFTER_CLOSE).outcome, 'alcanzado');

  const edited = [{ ...original[0] }, { ...original[1], result: 'loss' }];
  assert.equal(evaluateGoal(goal, { matches: edited }, AFTER_CLOSE).outcome, 'no_alcanzado');

  const movedOut = [original[0], { ...original[1], date: '2026-12-01' }];
  const result = evaluateGoal(goal, { matches: movedOut }, AFTER_CLOSE);
  assert.equal(result.outcome, 'no_concluyente');
  assert.equal(result.outOfPeriodCount, 1);
});

test('cambio de período en un objetivo existente', () => {
  const data = { matches: [makeMatch({ id: 'a', date: '2026-10-02' }), makeMatch({ id: 'b', date: '2026-10-20' })] };
  const before = evaluateGoal(makeGoal({ target: 2 }), data, MID_PERIOD);
  assert.equal(before.outcome, 'alcanzado');
  const narrowed = evaluateGoal(makeGoal({ target: 2, startDate: '2026-10-10', endDate: '2026-10-31' }), data, MID_PERIOD);
  assert.deepEqual(narrowed.includedIds, ['b']);
  assert.equal(narrowed.outcome, 'en_curso');
});

test('filtros sin resultados: todas las partidas excluidas con su motivo', () => {
  const data = { matches: [makeMatch({ id: 'a', lane: 'top' }), makeMatch({ id: 'b', lane: '' })] };
  const result = evaluateGoal(perf('winrate', 50, 1, { filters: { lanes: ['support'] } }), data, AFTER_CLOSE);
  assert.equal(result.sampleSize, 0);
  assert.equal(result.value, null);
  assert.equal(result.outcome, 'no_concluyente');
  assert.deepEqual(result.excluded, [
    { id: 'a', reason: 'no_cumple_filtro', field: 'lanes' },
    { id: 'b', reason: 'dato_de_filtro_faltante', field: 'lanes' },
  ]);
});

test('filtros por tipo, campeón y parche', () => {
  const data = {
    matches: [
      makeMatch({ id: 'a', type: 'ranked', patch: '7.3a' }),
      makeMatch({ id: 'b', type: 'casual', patch: '7.3a' }),
      makeMatch({ id: 'c', type: 'ranked', patch: '7.2d' }),
      makeMatch({ id: 'd', type: 'ranked', patch: '7.3b', own_champion_id: 'lux', own_champion_name: 'Lux' }),
    ],
  };
  const goal = makeGoal({ filters: { types: ['ranked'], patches: ['7.3'], champions: [{ id: 'ahri', name: 'Ahri' }] } });
  const result = evaluateGoal(goal, data, MID_PERIOD);
  assert.deepEqual(result.includedIds, ['a']);
  assert.deepEqual(result.excluded.map(x => [x.id, x.field]), [['b', 'types'], ['c', 'patches'], ['d', 'champions']]);
});

test('porcentaje de campeones: el denominador son todas las partidas válidas que cumplen los demás filtros', () => {
  const pool = [{ id: 'ahri', name: 'Ahri' }, { id: null, name: 'Lux' }];
  const data = {
    matches: [
      makeMatch({ id: 'p1', own_champion_id: 'ahri', own_champion_name: 'Ahri' }),
      makeMatch({ id: 'p2', own_champion_id: 'lux-7.3', own_champion_name: 'Lux' }), // coincide por nombre
      makeMatch({ id: 'o1', own_champion_id: 'zed', own_champion_name: 'Zed' }),
      makeMatch({ id: 'o2', own_champion_id: 'yasuo', own_champion_name: 'Yasuo' }),
      makeMatch({ id: 'top', lane: 'top', own_champion_id: 'ahri', own_champion_name: 'Ahri' }),
      makeMatch({ id: 'none', own_champion_id: '', own_champion_name: '' }),
      makeMatch({ id: 'old', date: '2026-09-01' }),
    ],
  };
  const goal = perf('porcentaje_campeones', 50, 4, { filters: { champions: pool, lanes: ['mid'] } });
  const result = evaluateGoal(goal, data, AFTER_CLOSE);
  assert.equal(result.sampleSize, 4, 'p1, p2, o1, o2: la de top la descarta el filtro de línea');
  assert.equal(result.value, 50);
  assert.equal(result.outcome, 'alcanzado');
  assert.deepEqual(result.excluded.map(x => [x.id, x.reason]), [['top', 'no_cumple_filtro'], ['none', 'sin_campeon']]);
  assert.equal(result.outOfPeriodCount, 1);
});

test('objetivo manual: suma check-ins del período', () => {
  const goal = makeGoal({ metric: 'manual', target: 5, unit: 'horas' });
  const checkins = [
    { id: 'c1', amount: 2, checkin_date: '2026-10-02' },
    { id: 'c2', amount: '1.5', checkin_date: '2026-10-09' },
    { id: 'c3', amount: 10, checkin_date: '2026-11-15' },
  ];
  const result = evaluateGoal(goal, { checkins }, MID_PERIOD);
  assert.equal(result.value, 3.5);
  assert.equal(result.outcome, 'en_curso');
  assert.equal(result.outOfPeriodCount, 1);

  const reached = evaluateGoal(goal, { checkins: [...checkins, { id: 'c4', amount: 1.5, checkin_date: '2026-10-10' }] }, MID_PERIOD);
  assert.equal(reached.outcome, 'alcanzado');
});

test('límites inclusivos y medianoche en distintas zonas horarias', () => {
  const ba = makeGoal({ startDate: '2026-10-01', endDate: '2026-10-07', timezone: 'America/Argentina/Buenos_Aires' });
  assert.equal(ba.period_start, '2026-10-01T03:00:00.000Z');
  assert.equal(ba.period_end, '2026-10-08T02:59:59.999Z');

  const data = {
    matches: [
      makeMatch({ id: 'first-day', date: '2026-10-01', hour: '00:00' }),
      makeMatch({ id: 'last-day', date: '2026-10-07', hour: '23:59' }),
      makeMatch({ id: 'day-before', date: '2026-09-30', hour: '23:59' }),
      makeMatch({ id: 'day-after', date: '2026-10-08', hour: '00:00' }),
      // Sin fecha jugada: se usa created_at en la zona del objetivo.
      makeMatch({ id: 'reg-2330-local', date: null, created_at: '2026-10-08T02:30:00Z' }), // 7/10 23:30 en BA
      makeMatch({ id: 'reg-0000-local', date: null, created_at: '2026-10-08T03:00:00Z' }), // 8/10 00:00 en BA
    ],
  };
  const result = evaluateGoal(ba, data, new Date('2026-10-05T12:00:00Z'));
  assert.deepEqual(result.includedIds.sort(), ['first-day', 'last-day', 'reg-2330-local']);
  assert.equal(result.outOfPeriodCount, 3);

  // El mismo instante de registro cae en otro día en Tokio.
  const tokyo = makeGoal({ startDate: '2026-10-08', endDate: '2026-10-08', timezone: 'Asia/Tokyo' });
  const tokyoResult = evaluateGoal(tokyo, { matches: [data.matches[4]] }, new Date('2026-10-08T05:00:00Z'));
  assert.deepEqual(tokyoResult.includedIds, ['reg-2330-local']);
});

test('estado del período en el último milisegundo y justo después', () => {
  const goal = makeGoal({ metric: 'winrate', target: 50, minSample: 1, startDate: '2026-10-01', endDate: '2026-10-07', timezone: 'Europe/Madrid' });
  const data = { matches: [makeMatch({ date: '2026-10-07', result: 'win' })] };
  assert.equal(evaluateGoal(goal, data, new Date(goal.period_end)).outcome, 'en_curso');
  assert.equal(evaluateGoal(goal, data, new Date(new Date(goal.period_end).getTime() + 1)).outcome, 'alcanzado');
  assert.equal(evaluateGoal(goal, data, new Date(new Date(goal.period_start).getTime() - 1)).outcome, 'programado');
});
