import test from 'node:test';
import assert from 'node:assert/strict';
import { artKey, championArtId, splashUrl } from '../../src/features/share/championArt.js';

// Muestra de champion.json de Data Dragon: nombre en inglés → id.
const IDS = new Map([
  ["Kai'Sa", 'Kaisa'], ['Wukong', 'MonkeyKing'], ['Dr. Mundo', 'DrMundo'], ['Jarvan IV', 'JarvanIV'], ['Ahri', 'Ahri'],
].flatMap(([name, id]) => [[artKey(name), id], [artKey(id), id]]));

test('arte: el nombre del catálogo encuentra el id de Data Dragon', () => {
  assert.equal(championArtId(IDS, { name: "Kai'Sa" }), 'Kaisa');
  assert.equal(championArtId(IDS, { name: 'Wukong' }), 'MonkeyKing');
  assert.equal(championArtId(IDS, { name: 'Dr. Mundo' }), 'DrMundo');
  assert.equal(championArtId(IDS, { name: 'Jarvan IV' }), 'JarvanIV');
});

test('arte: nombres en español con alias y campeones exclusivos de Wild Rift', () => {
  assert.equal(championArtId(IDS, { name: 'Maestro Yi' }), 'MasterYi');
  assert.equal(championArtId(IDS, { name: 'Bardo' }), 'Bard');
  assert.equal(championArtId(IDS, { name: 'Nunu y Willump' }), 'Nunu');
  // Norra no existe en LoL: sin splash, la tarjeta usa el arte del catálogo.
  assert.equal(championArtId(IDS, { name: 'Norra' }), null);
  assert.equal(championArtId(IDS, null), null);
});

test('arte: URL del splash base', () => {
  assert.equal(splashUrl('Kaisa'), 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Kaisa_0.jpg');
});
