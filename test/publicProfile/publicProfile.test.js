import test from 'node:test';
import assert from 'node:assert/strict';
import { availableTypes, isValidSlug, summarizePublicStats, toSlug } from '../../src/features/publicProfile/publicProfile.js';

test('nombre del link: válido solo con minúsculas, números y guiones, de 3 a 24', () => {
  assert.equal(isValidSlug('disquete'), true);
  assert.equal(isValidSlug('el-pibe-123'), true);
  assert.equal(isValidSlug('ab'), false);
  assert.equal(isValidSlug('-disquete'), false);
  assert.equal(isValidSlug('disquete-'), false);
  assert.equal(isValidSlug('Disquete'), false);
  assert.equal(isValidSlug('dis quete'), false);
  assert.equal(isValidSlug('a'.repeat(25)), false);
});

test('toSlug: saca tildes, pasa a minúsculas y cambia espacios y símbolos por guiones', () => {
  assert.equal(toSlug('Disquete #RiftDeck'), 'disquete-riftdeck');
  assert.equal(toSlug('  Martín   Ñandú  '), 'martin-nandu');
  assert.equal(toSlug("Kai'Sa__Main!!"), 'kai-sa-main');
  assert.equal(toSlug('x'.repeat(30)).length, 24);
  assert.equal(toSlug('abcdefghijklmnopqrstuvw yz'), 'abcdefghijklmnopqrstuvw');
  assert.ok(isValidSlug(toSlug('Disquete #RiftDeck')));
});

test('resumen: suma por tipo elegido y agrupa campeones y líneas de más a menos jugado', () => {
  const stats = [
    { type: 'ranked', champion: "Kai'Sa", lane: 'adc', games: 10, wins: 6 },
    { type: 'ranked', champion: 'Lux', lane: 'mid', games: 4, wins: 1 },
    { type: 'casual', champion: "Kai'Sa", lane: 'adc', games: 3, wins: 3 },
    { type: null, champion: 'Lux', lane: 'support', games: 2, wins: 2 },
  ];
  const ranked = summarizePublicStats(stats, ['ranked']);
  assert.equal(ranked.games, 16);
  assert.equal(ranked.wins, 9);
  assert.equal(ranked.losses, 7);
  assert.equal(ranked.winrate, 56);
  assert.deepEqual(ranked.champions.map(entry => [entry.name, entry.games, entry.winrate]), [["Kai'Sa", 10, 60], ['Lux', 6, 50]]);
  assert.deepEqual(ranked.lanes.map(entry => entry.lane), ['adc', 'mid', 'support']);

  const all = summarizePublicStats(stats);
  assert.equal(all.games, 19);
  assert.equal(all.champions[0].games, 13);

  assert.deepEqual(availableTypes(stats, ['ranked', 'legendary_ranked', 'casual']), ['ranked', 'casual']);
});

test('toSlugDraft: mientras se escribe deja un guion al final', async () => {
  const { toSlugDraft } = await import('../../src/features/publicProfile/publicProfile.js');
  assert.equal(toSlugDraft('el pibe '), 'el-pibe-');
  assert.equal(toSlugDraft('el-pibe-'), 'el-pibe-');
  assert.equal(toSlugDraft('El Pibe'), 'el-pibe');
  assert.equal(toSlugDraft('-'), '');
});
