import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveV2Result } from '../../src/features/buildV2/v2ResultResolver.js';

test('ordena las runas primarias por group sin perder razones', () => {
  const result = { core_items: [], movement_item: { id: 'i', reason: 'm' }, keystone: { id: 'k', reason: 'k' }, primary_runes: [{ id: 'r3', reason: 'tres' }, { id: 'r1', reason: 'uno' }, { id: 'r2', reason: 'dos' }], secondary_rune: { id: 's', reason: 's' }, spells: [] };
  const snapshot = { items: [{ id: 'i' }], runes: [{ id: 'k' }, { id: 'r1', group: 1 }, { id: 'r2', group: 2 }, { id: 'r3', group: 3 }, { id: 's' }], spells: [] };
  const resolved = resolveV2Result(result, snapshot);
  assert.deepEqual(resolved.primary_runes.map(x => x.id), ['r1', 'r2', 'r3']);
  assert.equal(resolved.primary_runes[0].reason, 'uno');
});
