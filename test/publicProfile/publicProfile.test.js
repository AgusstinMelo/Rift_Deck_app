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

test('foco del campeón: mejor y peor matchup y sinergia, priorizando los de 2+ partidas', async () => {
  const { championFocus } = await import('../../src/features/publicProfile/publicProfile.js');
  const profile = {
    matchups: [
      { type: 'ranked', champion: "Kai'Sa", opponent: 'Ezreal', games: 4, wins: 3 },
      { type: 'ranked', champion: "Kai'Sa", opponent: 'Jinx', games: 1, wins: 1 },
      { type: 'ranked', champion: "Kai'Sa", opponent: 'Caitlyn', games: 3, wins: 0 },
      { type: 'ranked', champion: "Kai'Sa", opponent: 'Vayne', games: 2, wins: 1 },
      { type: 'casual', champion: "Kai'Sa", opponent: 'Draven', games: 5, wins: 0 },
      { type: 'ranked', champion: 'Lux', opponent: 'Ahri', games: 3, wins: 3 },
    ],
    synergies: [
      { type: 'ranked', champion: "kai'sa", ally: 'Nautilus', games: 3, wins: 3 },
      { type: 'ranked', champion: "Kai'Sa", ally: 'Lulu', games: 2, wins: 0 },
    ],
  };
  const focus = championFocus(profile, "Kai'Sa", ['ranked']);
  assert.equal(focus.bestMatchup.name, 'Ezreal');      // 3/4 le gana a 1/1 (Jinx, 1 partida)
  assert.equal(focus.worstMatchup.name, 'Caitlyn');    // Draven es casual: no cuenta
  assert.equal(focus.bestSynergy.name, 'Nautilus');    // sin distinguir mayúsculas
  assert.equal(focus.worstSynergy.name, 'Lulu');
  assert.equal(championFocus(profile, 'Lux', ['ranked']).worstMatchup, null);
});

test('burbujas: no se superponen y la más jugada es la más grande', async () => {
  const { packBubbles } = await import('../../src/features/publicProfile/publicProfile.js');
  const entries = [43, 9, 7, 5, 4, 3, 2, 2, 1, 1, 1, 1].map((games, index) => ({ name: `C${index}`, games }));
  const { bubbles, bounds } = packBubbles(entries, { gap: 4 });
  assert.equal(bubbles.length, entries.length);
  assert.equal(bubbles[0].r, Math.max(...bubbles.map(b => b.r)));
  for (let i = 0; i < bubbles.length; i += 1) {
    for (let j = i + 1; j < bubbles.length; j += 1) {
      const a = bubbles[i]; const b = bubbles[j];
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r + 4 - 1e-9, `${a.name} y ${b.name} se pisan`);
    }
  }
  assert.ok(bounds.width > 0 && bounds.height > 0);
});

test('últimas partidas: filtra por tipo y corta en el límite', async () => {
  const { recentMatches } = await import('../../src/features/publicProfile/publicProfile.js');
  const recent = [{ type: 'ranked' }, { type: 'casual' }, { type: null }, { type: 'ranked' }];
  assert.equal(recentMatches(recent, ['ranked']).length, 3);
  assert.equal(recentMatches(recent, [], 2).length, 2);
});

test('banner: KDA promedio, winrate por lado del mapa y mejor racha del parche', async () => {
  const { bestStreak, sideSummary, summarizePublicStats } = await import('../../src/features/publicProfile/publicProfile.js');
  const stats = [
    { type: 'ranked', champion: "Kai'Sa", lane: 'adc', games: 4, wins: 3, kda_sum: 14 },
    { type: 'ranked', champion: 'Lux', lane: 'mid', games: 1, wins: 0, kda_sum: 1 },
    { type: 'casual', champion: 'Lux', lane: 'mid', games: 5, wins: 5, kda_sum: 50 },
  ];
  assert.equal(summarizePublicStats(stats, ['ranked']).kda, 3);
  assert.equal(summarizePublicStats([{ type: 'ranked', champion: 'A', lane: 'mid', games: 2, wins: 1 }], ['ranked']).kda, null);

  const sides = sideSummary([
    { type: 'ranked', side: 'blue', games: 10, wins: 7 },
    { type: 'ranked', side: 'red', games: 4, wins: 1 },
    { type: 'casual', side: 'red', games: 6, wins: 6 },
  ], ['ranked']);
  assert.deepEqual(sides.blue, { games: 10, wins: 7, winrate: 70 });
  assert.deepEqual(sides.red, { games: 4, wins: 1, winrate: 25 });
  assert.equal(sideSummary([], ['ranked']).blue.winrate, null);

  const results = ['win', 'win', 'loss', 'win', 'win', 'win', 'loss'].map(result => ({ type: 'ranked', result }));
  results.splice(4, 0, { type: 'casual', result: 'loss' }); // una casual en el medio no corta la racha clasificatoria
  assert.equal(bestStreak(results, ['ranked']), 3);
  assert.equal(bestStreak(results, ['ranked', 'casual']), 2);
});
