import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGoal } from '../../src/features/goals/engine/evaluateGoal.js';
import { partitionGoals, summarizeCurrent } from '../../src/features/goals/model/goalLists.js';
import { MID_PERIOD, makeGoal, matches } from './helpers.js';

const item = (goalOverrides, data = { matches: [] }) => {
  const goal = { ...makeGoal(goalOverrides), id: goalOverrides.id };
  return { goal, evaluation: evaluateGoal(goal, data, MID_PERIOD), checkins: [], truncated: false };
};

test('agrupa en activos, finalizados y archivados', () => {
  const items = [
    item({ id: 'open' }),
    item({ id: 'scheduled', startDate: '2026-11-01', endDate: '2026-11-30' }),
    item({ id: 'closed', startDate: '2026-09-01', endDate: '2026-09-30' }),
    item({ id: 'cancelled', lifecycle: 'cancelado' }),
    item({ id: 'archived', lifecycle: 'archivado', startDate: '2026-09-01', endDate: '2026-09-30' }),
  ];
  const { current, finished, archived } = partitionGoals(items);
  assert.deepEqual(current.map(i => i.goal.id), ['open', 'scheduled']);
  assert.deepEqual(finished.map(i => i.goal.id).sort(), ['cancelled', 'closed']);
  assert.deepEqual(archived.map(i => i.goal.id), ['archived']);
});

test('resumen de activos: alcanzados, en riesgo y programados', () => {
  const current = [
    item({ id: 'a', target: 2 }, { matches: matches(2) }),
    item({ id: 'b', metric: 'winrate', target: 60, minSample: 2 }, { matches: matches(2, { result: 'win' }) }),
    item({ id: 'c', metric: 'winrate', target: 60, minSample: 2 }, { matches: matches(2, { result: 'loss' }) }),
    item({ id: 'd', startDate: '2026-11-01', endDate: '2026-11-30' }),
  ];
  assert.deepEqual(summarizeCurrent(current), { total: 4, achieved: 1, onTrack: 1, atRisk: 1, scheduled: 1 });
});
