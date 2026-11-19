// Cuándo el control rival pide tenacidad: cuenta el control que te llega (iniciadores, pick,
// divers o engage alto), con umbral según quién lo sufre, y una victoria muriendo poco no
// se marca como "te faltó". Caso real: Seraphine support, victoria 1/2/14, a la que el
// Coach le pidió tenacidad porque el rival tenía 3 campeones con algún control duro.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog } from '../../src/features/coach/catalog.js';
import { normalizeMatch } from '../../src/features/coach/normalize.js';
import { computeCoachReport } from '../../src/features/coach/engine.js';
import { champions as baseChampions, items, runes, match } from './fixtures.js';

const ROLES = {
  Leona: { team_roles: ['frontline', 'iniciador'], score_engage: 5 },
  Malphite: { team_roles: ['frontline', 'iniciador'], score_engage: 5 },
  Lux: { team_roles: ['poke', 'pick'], score_engage: 2 },
  Annie: { team_roles: ['daño_burst'], score_engage: 3 },
  // Control duro sin forma de imponerlo: no cuenta.
  Ashe: { team_roles: ['daño_sostenido'], score_engage: 1 },
};
const champions = baseChampions.map(row => ({ ...row, ...ROLES[row.name] }));
const catalog = buildCatalog({ champions, items, runes });
const row = fields => normalizeMatch(match(fields), catalog);
const THREE = ['Leona', 'Lux', 'Annie', 'Jinx', 'Darius'];
const TWO = ['Leona', 'Lux', 'Ashe', 'Jinx', 'Darius'];

test('cuenta el control que te llega, no el que existe', () => {
  const profile = name => catalog.champion(name);
  assert.equal(profile('Leona').ccThreat, true);
  assert.equal(profile('Lux').ccThreat, true);
  assert.equal(profile('Annie').ccThreat, true);
  assert.equal(profile('Ashe').hardCc, true);
  assert.equal(profile('Ashe').ccThreat, false);
});

test('quien entra lo sufre desde 2; el de rango, desde 3', () => {
  const build = ['Hidra Titánica', 'Cuchilla Negra', 'Filo Infinito'];
  assert.ok(row({ own_champion_name: 'Sett', lane: 'top', enemy_champions: TWO, items_used: build }).threats.cc);
  const mage = ['Eco de Luden', 'Orbe del Infinito', 'Reloj de Arena de Zhonya'];
  assert.equal(row({ own_champion_name: 'Seraphine', lane: 'support', enemy_champions: TWO, items_used: mage }).threats.cc, undefined);
  assert.ok(row({ own_champion_name: 'Seraphine', lane: 'support', enemy_champions: THREE, items_used: mage }).threats.cc);
});

test('la encantadora responde limpiando al aliado, no con tenacidad propia', () => {
  const base = ['Relicario de los Solari de Hierro', 'Báculo de Agua Fluyente', 'Presagio de Randuin'];
  const boots = row({ own_champion_name: 'Janna', lane: 'support', enemy_champions: THREE, items_used: [...base, 'Botas de Mercurio'] });
  assert.equal(boots.threats.cc.answered, false);
  const mikael = row({ own_champion_name: 'Janna', lane: 'support', enemy_champions: THREE, items_used: [...base.slice(0, 2), 'Bendición de Mikael'] });
  assert.equal(mikael.threats.cc.answered, true);
});

test('última partida: una victoria muriendo poco no marca el control como falta; una derrota, sí', () => {
  const lastCard = last => {
    const history = [1, 2, 3, 4, 5].map(day => match({ date: `2026-10-0${day}`, created_at: `2026-10-0${day}T12:00:00Z` }));
    const report = computeCoachReport({ matches: [...history, last], champions, items, runes, now: new Date('2026-11-02T12:00:00Z'), limit: 20 });
    return report.insights.find(insight => insight.id === `last-${last.id}`);
  };
  const fields = { own_champion_name: 'Sett', lane: 'top', enemy_champions: THREE, items_used: ['Hidra Titánica', 'Cuchilla Negra', 'Filo Infinito'], date: '2026-11-02', created_at: '2026-11-02T10:00:00Z' };
  const won = lastCard(match({ ...fields, result: 'win', kills: 4, deaths: 1, assists: 9 }));
  assert.doesNotMatch(won?.thesis || '', /control duro/);
  const lost = lastCard(match({ ...fields, result: 'loss', kills: 1, deaths: 3, assists: 2 }));
  assert.match(lost.thesis, /control duro/);
});
