// Dashboard: tu pool de la semana (los campeones más jugados, con winrate y KDA).
import test from 'node:test';
import assert from 'node:assert/strict';
import { championPool } from '../../src/domain/matchStats.js';

const match = (champion, result, kills = 5, deaths = 2, assists = 5) => ({ own_champion_name: champion, result, kills, deaths, assists });

test('los más jugados primero; a igual cantidad, el de mejor winrate; con su KDA promedio', () => {
  const pool = championPool([
    match("Kai'Sa", 'win'), match("Kai'Sa", 'loss'), match("Kai'Sa", 'win'),
    match('Zeri', 'win', 6, 0, 4), match('Zeri', 'win'),
    match('Ahri', 'loss'), match('Ahri', 'loss'),
    match('', 'win'),
  ]);
  assert.deepEqual(pool.map(entry => [entry.champion, entry.games]), [["Kai'Sa", 3], ['Zeri', 2], ['Ahri', 2]]);
  assert.equal(Math.round(pool[0].wr), 67);
  assert.equal(pool[1].kda, (10 + 5) / 2, 'promedio del KDA de cada partida (sin muertes: K + A)');
  assert.equal(championPool([match('A', 'win'), match('B', 'win'), match('C', 'win')], 2).length, 2);
  assert.deepEqual(championPool([]), []);
});
