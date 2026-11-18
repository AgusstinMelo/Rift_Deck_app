// Composiciones: cómo te va contra equipos de pick, engage o poke, o sin primera línea en
// tu equipo (rol en la pelea y puntajes 0-5 del catálogo). El consejo es siempre sobre lo
// que hace el jugador: el draft no depende de él más que para elegir su campeón.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog } from '../../src/features/coach/catalog.js';
import { normalizeMatches } from '../../src/features/coach/normalize.js';
import { buildHabitsOf } from '../../src/features/coach/detectors/build.js';
import { detectCompPlans } from '../../src/features/coach/detectors/comp.js';
import { summarize } from '../../src/features/coach/stats.js';
import { catalog, many } from './fixtures.js';

const scores = (engage, peel, range) => ({ score_engage: engage, score_peel: peel, score_range: range });
const extra = [
  { id: 'thresh', name: 'Thresh', roles: ['Tanque'], traits: ['cc_duro'], damage_type: 'AP', team_roles: ['frontline', 'protector', 'pick'], ...scores(3, 5, 3) },
  { id: 'blitz', name: 'Blitzcrank', roles: ['Tanque'], traits: ['cc_duro'], damage_type: 'AP', team_roles: ['iniciador', 'pick'], ...scores(3, 3, 2) },
  { id: 'ziggs', name: 'Ziggs', roles: ['Mago'], traits: ['rango'], damage_type: 'AP', team_roles: ['poke'], ...scores(1, 1, 5) },
  { id: 'velkoz', name: "Vel'Koz", roles: ['Mago'], traits: ['rango'], damage_type: 'AP', team_roles: ['poke'], ...scores(1, 1, 5) },
  { id: 'amumu', name: 'Amumu', roles: ['Tanque'], traits: ['cc_duro'], damage_type: 'AP', team_roles: ['frontline', 'iniciador'], ...scores(5, 2, 2) },
  { id: 'leona2', name: 'Rell', roles: ['Tanque'], traits: ['cc_duro'], damage_type: 'AP', team_roles: ['frontline', 'iniciador'], ...scores(4, 4, 2) },
].map(row => ({ traits: [], vulnerabilities: [], strong_against: [], weak_against: [], scaling: 'midgame', ...row }));
const index = buildCatalog({ ...catalog, champions: [...catalog.champions, ...extra] });

function cards(matches) {
  const rows = normalizeMatches(matches, index);
  return detectCompPlans({ matches: rows, base: summarize(rows), catalog: index, buildHabits: buildHabitsOf(rows) });
}
const byId = (list, id) => list.find(card => card.id === id);
const jinx = { own_champion_name: 'Jinx', lane: 'adc', enemy_champion_name: 'Darius', items_used: ['Filo Infinito', 'Hidra Titánica', 'Cuchilla Negra'] };
const CALM = ['Darius', 'Lux', 'Malphite', 'Kayle', 'Garen'];
/** Ningún consejo puede pedir otro campeón ni otra composición. */
const personal = card => assert.doesNotMatch(`${card.title} ${card.action}`, /eleg|elijan|draft|composición distinta|otro campeón|tu equipo debería/i);

test('contra equipos de pick un tirador muere de más → jugar con visión y guardar Flash', () => {
  const list = cards([
    ...many(6, { ...jinx, result: 'loss', deaths: 8, enemy_champions: ['Thresh', 'Blitzcrank', 'Darius', 'Lux', 'Kayle'] }, 1),
    ...many(6, { ...jinx, result: 'win', deaths: 3, enemy_champions: CALM }, 10),
  ]);
  const card = byId(list, 'comp-pick');
  assert.ok(card, 'tarjeta de pick');
  assert.match(card.thesis, /Blitzcrank y Thresh|Thresh y Blitzcrank/);
  assert.match(card.thesis, /8,0 veces por partida, contra 3,0/);
  assert.match(card.action, /Flash/);
  personal(card);
});

test('con la misma cantidad de muertes contra pick no hay tarjeta', () => {
  const list = cards([
    ...many(6, { ...jinx, deaths: 4, enemy_champions: ['Thresh', 'Blitzcrank', 'Darius', 'Lux', 'Kayle'] }, 1),
    ...many(6, { ...jinx, deaths: 4, enemy_champions: CALM }, 10),
  ]);
  assert.equal(byId(list, 'comp-pick'), undefined);
});

test('contra engage fuerte: al carry le toca posicionarse; al tanque no se le marca', () => {
  const engage = ['Amumu', 'Rell', 'Darius', 'Lux', 'Kayle'];
  const carry = cards([
    ...many(6, { ...jinx, result: 'loss', deaths: 9, enemy_champions: engage }, 1),
    ...many(6, { ...jinx, deaths: 3, enemy_champions: CALM }, 10),
  ]);
  const card = byId(carry, 'comp-engage');
  assert.ok(card);
  assert.match(card.action, /fuera del alcance de su entrada/);
  personal(card);
  const malphite = { own_champion_name: 'Malphite', lane: 'top', items_used: ['Corazón Helado', 'Presagio de Randuin', 'Cota de Espinas'] };
  const tank = cards([
    ...many(6, { ...malphite, result: 'loss', deaths: 9, enemy_champions: engage }, 1),
    ...many(6, { ...malphite, deaths: 3, enemy_champions: CALM }, 10),
  ]);
  assert.equal(byId(tank, 'comp-engage'), undefined);
});

test('contra poke, un luchador cuerpo a cuerpo pierde más → entrar rápido o retirarse', () => {
  const garen = { own_champion_name: 'Garen', lane: 'top' };
  const list = cards([
    ...many(7, { ...garen, result: 'loss', enemy_champions: ['Ziggs', "Vel'Koz", 'Darius', 'Lux', 'Kayle'] }, 1),
    ...many(7, { ...garen, result: 'win', enemy_champions: CALM }, 10),
  ]);
  const card = byId(list, 'comp-poke');
  assert.ok(card);
  assert.match(card.thesis, /ganás el 0%, contra el 100%/);
  assert.match(card.action, /entrá rápido/);
  personal(card);
  // A un tirador no se le marca poke.
  const ranged = cards([
    ...many(7, { ...jinx, result: 'loss', enemy_champions: ['Ziggs', "Vel'Koz", 'Darius', 'Lux', 'Kayle'] }, 1),
    ...many(7, { ...jinx, result: 'win', enemy_champions: CALM }, 10),
  ]);
  assert.equal(byId(ranged, 'comp-poke'), undefined);
});

test('sin primera línea en tu equipo, el carry juega detrás y suma un objeto de daño que defienda', () => {
  const list = cards([
    ...many(6, { ...jinx, result: 'loss', ally_champions: ['Lux', 'Ahri', 'Soraka', 'Kayle'], enemy_champions: CALM }, 1),
    ...many(6, { ...jinx, result: 'win', ally_champions: ['Amumu', 'Lux', 'Soraka', 'Kayle'], enemy_champions: CALM }, 10),
  ]);
  const card = byId(list, 'comp-noFrontline');
  assert.ok(card);
  assert.match(card.action, /jugá detrás de la oleada/);
  assert.match(card.action, /Ángel Guardián|Danza de la Muerte/);
  assert.doesNotMatch(card.action, /Corazón|Cota|Randuin/, 'nunca objetos de tanque a un carry');
  personal(card);
  // Si tu campeón es la primera línea, a tu equipo no le falta.
  const amumu = { own_champion_name: 'Amumu', lane: 'jungler' };
  const tank = cards([
    ...many(6, { ...amumu, result: 'loss', ally_champions: ['Lux', 'Ahri', 'Soraka', 'Kayle'], enemy_champions: CALM }, 1),
    ...many(6, { ...amumu, result: 'win', ally_champions: ['Rell', 'Lux', 'Soraka', 'Kayle'], enemy_champions: CALM }, 10),
  ]);
  assert.equal(byId(tank, 'comp-noFrontline'), undefined);
});
