import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGoal } from '../../src/features/goals/engine/evaluateGoal.js';
import { isFinished, partitionGoals, summarizeCurrent } from '../../src/features/goals/model/goalLists.js';
import { MID_PERIOD, makeGoal, matches } from './helpers.js';

const item = (goalOverrides, data = { matches: [] }) => {
  const goal = { ...makeGoal(goalOverrides), id: goalOverrides.id };
  return { goal, evaluation: evaluateGoal(goal, data, MID_PERIOD), checkins: [], truncated: false };
};

test('agrupa en activos, finalizados y archivados', () => {
  const items = [
    item({ id: 'open' }),
    item({ id: 'reached-early', target: 2 }, { matches: matches(2) }),
    item({ id: 'scheduled', startDate: '2026-11-01', endDate: '2026-11-30' }),
    item({ id: 'closed', startDate: '2026-09-01', endDate: '2026-09-30' }),
    item({ id: 'cancelled', lifecycle: 'cancelado' }),
    item({ id: 'archived', lifecycle: 'archivado', startDate: '2026-09-01', endDate: '2026-09-30' }),
  ];
  const { current, finished, archived } = partitionGoals(items);
  assert.deepEqual(current.map(i => i.goal.id), ['open', 'scheduled']);
  assert.deepEqual(finished.map(i => i.goal.id).sort(), ['cancelled', 'closed', 'reached-early']);
  assert.deepEqual(archived.map(i => i.goal.id), ['archived']);
});

test('resumen: activos, alcanzados en total, en riesgo y programados', () => {
  const reached = item({ id: 'done', target: 2 }, { matches: matches(2) });
  const cancelledReached = item({ id: 'cx', target: 2, lifecycle: 'cancelado' }, { matches: matches(2) });
  const current = [
    item({ id: 'a', target: 5 }, { matches: matches(2) }),
    item({ id: 'b', metric: 'winrate', target: 60, minSample: 2 }, { matches: matches(2, { result: 'win' }) }),
    item({ id: 'c', metric: 'winrate', target: 60, minSample: 2 }, { matches: matches(2, { result: 'loss' }) }),
    item({ id: 'd', startDate: '2026-11-01', endDate: '2026-11-30' }),
  ];
  const all = [...current, reached, cancelledReached];
  assert.deepEqual(summarizeCurrent(current, all), { total: 4, achieved: 1, onTrack: 1, atRisk: 1, scheduled: 1 });
});

test('finalizado es derivado: alcanzar antes del cierre lo finaliza y borrar datos lo reactiva', () => {
  const reached = item({ id: 'x', target: 2 }, { matches: matches(2) });
  assert.equal(isFinished(reached.evaluation), true);
  assert.equal(reached.evaluation.outcome, 'alcanzado');

  const reverted = item({ id: 'x', target: 2 }, { matches: matches(1) });
  assert.equal(isFinished(reverted.evaluation), false);
  assert.deepEqual(partitionGoals([reverted]).current.map(i => i.goal.id), ['x']);

  const closedNotReached = item({ id: 'y', target: 5, startDate: '2026-09-01', endDate: '2026-09-30' });
  assert.equal(isFinished(closedNotReached.evaluation), true);
  assert.equal(closedNotReached.evaluation.outcome, 'no_alcanzado');
});

test('un objetivo alcanzado antes del cierre se archiva, no se cancela', async () => {
  const { editPermissions } = await import('../../src/features/goals/validation/goalSchema.js');
  const reached = item({ id: 'x', target: 2 }, { matches: matches(2) });
  const permissions = editPermissions(reached.goal, MID_PERIOD, reached.evaluation);
  assert.equal(permissions.canArchive, true);
  assert.equal(permissions.canCancel, false);
  assert.equal(permissions.canEditConfig, true, 'con el período abierto se puede, por ejemplo, subir la meta');

  const inProgress = item({ id: 'y', target: 5 }, { matches: matches(1) });
  const open = editPermissions(inProgress.goal, MID_PERIOD, inProgress.evaluation);
  assert.equal(open.canCancel, true);
  assert.equal(open.canArchive, false);
});
