// Builds guardadas vinculadas a las partidas (matches.build_id): récord por build y
// consejo del Coach cuando una build del mismo campeón rinde claramente más que otra.
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCoachReport } from '../../src/features/coach/engine.js';
import { recordsByBuild } from '../../src/domain/matchStats.js';
import { catalog, many } from './fixtures.js';

const NOW = new Date('2026-11-16T12:00:00Z');
const BUILDS = [
  { id: 'b1', name: 'Daño', champion_name: 'Garen', items: ['Hidra Titánica', 'Filo Infinito', 'Cuchilla Negra'] },
  { id: 'b2', name: 'Aguante', champion_name: 'Garen', items: ['Hidra Titánica', 'Corazón Helado', 'Presagio de Randuin'] },
];
const report = (matches, builds = BUILDS) => computeCoachReport({ matches, ...catalog, builds, now: NOW, limit: 20 });
const find = (insights, prefix) => insights.find(card => card.id.startsWith(prefix));

test('récord por build: partidas, victorias y derrotas de las vinculadas', () => {
  const records = recordsByBuild([
    { build_id: 'b1', result: 'win' }, { build_id: 'b1', result: 'loss' }, { build_id: 'b1', result: 'win' },
    { build_id: 7, result: 'loss' }, { build_id: null, result: 'win' }, { result: 'win' },
  ]);
  assert.deepEqual(records.get('b1'), { games: 3, wins: 2, losses: 1 });
  assert.deepEqual(records.get('7'), { games: 1, wins: 0, losses: 1 });
  assert.equal(records.size, 2);
});

test('Coach: con el mismo campeón, una build que rinde claramente más genera un consejo con la diferencia de objetos', () => {
  const matches = [
    ...many(6, { build_id: 'b1', result: 'win' }), ...many(2, { build_id: 'b1', result: 'loss' }, 7),
    ...many(2, { build_id: 'b2', result: 'win' }, 9), ...many(6, { build_id: 'b2', result: 'loss' }, 11),
  ];
  const card = find(report(matches).insights, 'saved-build-garen');
  assert.ok(card, 'tiene que haber un consejo de builds guardadas');
  assert.equal(card.family, 'savedBuild');
  assert.match(card.title, /Daño/);
  assert.match(card.thesis, /Filo Infinito/);
  assert.match(card.thesis, /Corazón Helado/);
  assert.match(card.action, /Daño/);
});

test('Coach: sin diferencia clara, con pocas partidas o sin builds no hay consejo de builds', () => {
  const even = [
    ...many(3, { build_id: 'b1', result: 'win' }), ...many(3, { build_id: 'b1', result: 'loss' }, 4),
    ...many(3, { build_id: 'b2', result: 'win' }, 7), ...many(3, { build_id: 'b2', result: 'loss' }, 10),
  ];
  assert.equal(find(report(even).insights, 'saved-build'), undefined);
  const few = [...many(3, { build_id: 'b1', result: 'win' }), ...many(3, { build_id: 'b2', result: 'loss' }, 4)];
  assert.equal(find(report(few).insights, 'saved-build'), undefined);
  const clear = [...many(6, { build_id: 'b1', result: 'win' }), ...many(6, { build_id: 'b2', result: 'loss' }, 7)];
  assert.equal(find(report(clear, []).insights, 'saved-build'), undefined);
});
