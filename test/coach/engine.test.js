import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCoachReport } from '../../src/features/coach/engine.js';
import { buildCatalog } from '../../src/features/coach/catalog.js';
import { normalizeMatch } from '../../src/features/coach/normalize.js';
import { keystoneFits } from '../../src/features/coach/detectors/build.js';
import { findDeathCeiling, sessionize } from '../../src/features/coach/detectors/performance.js';
import { shrunkRate } from '../../src/features/coach/stats.js';
import { catalog, many, match } from './fixtures.js';

const NOW = new Date('2026-11-16T12:00:00Z');
const report = (matches, extra = {}) => computeCoachReport({ matches, ...catalog, now: NOW, limit: 20, ...extra });
const find = (insights, prefix) => insights.find(card => card.id.startsWith(prefix));
const HEALERS = ['Darius', 'Soraka', 'Aatrox', 'Jinx', 'Kayle'];

test('catálogo: perfiles, amenazas y respuesta de la build', () => {
  const index = buildCatalog(catalog);
  const row = normalizeMatch(match({ enemy_champions: HEALERS, items_used: ['Hidra Titánica', 'Cuchilla Negra', 'Filo Infinito'] }), index);
  assert.equal(row.threats.healing.count, 3);
  assert.equal(row.threats.healing.answered, false);
  const answered = normalizeMatch(match({ enemy_champions: HEALERS, items_used: ['Recordatorio Mortal', 'Hidra Titánica', 'Filo Infinito'] }), index);
  assert.equal(answered.threats.healing.answered, true);
  // Con menos de 3 objetos no se puede afirmar que no respondió.
  const short = normalizeMatch(match({ enemy_champions: HEALERS, items_used: ['Hidra Titánica'] }), index);
  assert.equal(short.threats.healing.answered, null);
  // Con menos de 4 rivales cargados no se evalúan amenazas.
  const partial = normalizeMatch(match({ enemy_champions: ['Soraka', 'Aatrox'] }), index);
  assert.deepEqual(partial.threats, {});
});

test('encogimiento: 2 de 2 no es 100%', () => {
  assert.equal(shrunkRate(2, 2, 0.5, 6), 0.625);
});

test('antiheal: sin respuesta contra curadores se pierde, y el consejo nombra el objeto del catálogo', () => {
  const matches = [
    ...many(6, { enemy_champions: HEALERS, result: 'loss' }),
    ...many(2, { enemy_champions: HEALERS, result: 'win' }, 10),
    ...many(12, { result: 'win' }, 13),
  ];
  const card = find(report(matches).insights, 'threat-healing');
  assert.ok(card, 'debería detectar la falta de antiheal');
  assert.match(card.thesis, /2 o más campeones que se curan/);
  assert.match(card.action, /Recordatorio Mortal/);
  assert.equal(card.tone, 'critical');
});

test('antiheal: no se marca si igual ganás sin responder', () => {
  const matches = [...many(8, { enemy_champions: HEALERS, result: 'win' }), ...many(8, { result: 'loss' }, 10)];
  assert.equal(find(report(matches).insights, 'threat-healing'), undefined);
});

test('techo de muertes: encuentra el corte y propone el objetivo de "partidas que cumplen"', () => {
  const matches = [
    ...many(10, { deaths: 2, result: 'win' }),
    ...many(2, { deaths: 3, result: 'loss' }, 11),
    ...many(9, { deaths: 7, result: 'loss' }, 13),
    ...many(1, { deaths: 8, result: 'win' }, 22),
  ];
  const found = findDeathCeiling(matches.map(row => normalizeMatch(row, buildCatalog(catalog))), 0.5);
  assert.ok(found);
  assert.ok(found.ceiling >= 2 && found.ceiling <= 6, `techo ${found.ceiling}`);
  const card = find(report(matches).insights, 'deaths-ceiling');
  assert.ok(card);
  assert.deepEqual(card.goal.condition, { op: 'lte', value: found.ceiling });
  assert.match(card.action, /En top/);
});

test('matchup: récord, vulnerabilidades del rival, objetos del catálogo y alternativa del pool', () => {
  const matches = [
    ...many(4, { result: 'loss', enemy_champion_name: 'Darius' }),
    ...many(1, { result: 'win', enemy_champion_name: 'Darius' }, 5),
    ...many(8, { result: 'win', enemy_champion_name: 'Lux' }, 6),
    ...many(3, { own_champion_name: 'Jinx', lane: 'top', result: 'win', enemy_champion_name: 'Darius' }, 15),
  ];
  const card = find(report(matches).insights, 'matchup-garen-darius');
  assert.ok(card, 'debería marcar Garen vs Darius');
  assert.match(card.thesis, /1-4/);
  assert.match(card.thesis, /Darius sufre contra/);
  assert.match(card.thesis, /Recordatorio Mortal/);
  assert.match(card.action, /Jinx/);
});

test('matchup: con 2 partidas no hay consejo', () => {
  const matches = [...many(2, { result: 'loss' }), ...many(10, { result: 'win', enemy_champion_name: 'Lux' }, 5)];
  assert.equal(find(report(matches).insights, 'matchup-'), undefined);
});

test('última partida recién cargada: va primero, es nueva y explica qué se salió del patrón', () => {
  const matches = [
    ...many(10, { deaths: 2, result: 'win' }),
    ...many(8, { deaths: 7, result: 'loss' }, 11),
    match({
      id: 'latest', date: '2026-11-16', created_at: '2026-11-16T10:00:00Z', result: 'loss',
      deaths: 9, enemy_champions: HEALERS,
    }),
  ];
  const { insights } = report(matches);
  assert.equal(insights[0].id, 'last-latest');
  assert.equal(insights[0].isNew, true);
  assert.match(insights[0].title, /Garen vs Darius · derrota 5\/9\/5/);
  assert.match(insights[0].thesis, /Moriste 9 veces/);
});

test('seguimiento: compara las partidas cargadas después del consejo con las anteriores', () => {
  const before = [...many(10, { deaths: 2, result: 'win' }), ...many(10, { deaths: 7, result: 'loss' }, 11)];
  const after = Array.from({ length: 6 }, (_, index) => match({
    date: '2026-11-1' + index, created_at: `2026-11-1${index}T12:00:00Z`, deaths: 2, result: 'win',
  }));
  const history = [{ insight_key: 'deaths-ceiling', track: { kind: 'deathsOver', ceiling: 3 }, first_seen_at: '2026-11-05T00:00:00Z' }];
  const { insights } = report([...before, ...after], { history });
  const card = find(insights, 'follow-deaths-ceiling');
  assert.ok(card, 'debería haber seguimiento');
  assert.equal(card.tone, 'positive');
  assert.match(card.thesis, /50% a 0%/);
  // Lo ya mostrado no se marca como nuevo.
  const ceiling = find(insights, 'deaths-ceiling');
  if (ceiling) assert.equal(ceiling.isNew, false);
});

test('sesión: después de 2 derrotas seguidas el rendimiento cae', () => {
  // Cada día: victoria, dos derrotas y, ya en tilt, dos derrotas más. Aparte, días sueltos ganados.
  const matches = [];
  for (let day = 1; day <= 6; day += 1) {
    const date = `2026-10-${String(day).padStart(2, '0')}`;
    ['win', 'loss', 'loss', 'loss', 'loss'].forEach((result, index) => {
      matches.push(match({ date, hour: `1${index}:00`, created_at: `${date}T1${index}:00:00Z`, result }));
    });
    matches.push(match({ date: `2026-09-${String(day).padStart(2, '0')}`, result: 'win' }));
    matches.push(match({ date: `2026-09-${String(day + 10).padStart(2, '0')}`, result: 'win' }));
  }
  const entries = sessionize(buildCatalogMatches(matches));
  assert.ok(entries.some(entry => entry.lossStreak >= 2));
  const card = find(report(matches).insights, 'session-loss-streak');
  assert.ok(card);
  assert.match(card.action, /2 derrotas seguidas/);
});

function buildCatalogMatches(rows) {
  const index = buildCatalog(catalog);
  return rows.map(row => normalizeMatch(row, index));
}

test('runa clave: una de autoataques en un campeón de habilidades no encaja', () => {
  const index = buildCatalog(catalog);
  const garen = index.champion('Garen');
  assert.equal(keystoneFits(garen, index.rune('Ritmo Letal')), false);
  assert.equal(keystoneFits(garen, index.rune('Electrocutar')), true);
  const matches = [...many(4, { runes_used: ['Ritmo Letal'], result: 'loss' }), ...many(6, { runes_used: ['Electrocutar'], result: 'win' }, 5)];
  const card = find(report(matches).insights, 'runes-garen');
  assert.ok(card);
  assert.match(card.action, /Electrocutar/);
});

test('ningún consejo pide jugar más para validar, registrar datos o usar la app', () => {
  const matches = [
    ...many(6, { enemy_champions: HEALERS, result: 'loss', deaths: 8 }),
    ...many(10, { deaths: 2, result: 'win' }, 7),
    ...many(4, { result: 'loss', deaths: 6 }, 17),
  ];
  const { insights } = report(matches);
  assert.ok(insights.length > 0);
  for (const card of insights) {
    assert.doesNotMatch(card.action, /registr|valid|vincul|compar[áa] (?:este|tus|las)|\d+ partidas más/i, card.id);
  }
});

test('sin partidas no hay insights; con pocas, sin rival ni patrón, una tarjeta de referencia', () => {
  assert.deepEqual(report([]).insights, []);
  const { insights } = report(many(4, { result: 'win', enemy_champion_name: '' }));
  assert.equal(insights.length, 1);
  assert.equal(insights[0].id, 'warm-up');
});

test('con un historial normal sin problemas marcados igual hay al menos 4 consejos (preparación, plan y fortaleza)', () => {
  const notes = row => `Notas de ${row?.name}`;
  const matches = [
    ...many(8, { result: 'win', enemy_champion_name: 'Darius' }),
    ...many(6, { result: 'loss', enemy_champion_name: 'Darius' }, 9),
    ...many(5, { result: 'win', enemy_champion_name: 'Zed' }, 15),
    ...many(3, { result: 'loss', enemy_champion_name: 'Zed' }, 20),
    ...many(6, { result: 'win', own_champion_name: 'Jinx', lane: 'adc', enemy_champion_name: 'Kayle' }, 23),
  ];
  const { insights } = report(matches, { championNotes: notes });
  assert.ok(insights.length >= 4, insights.map(card => card.id).join(', '));
  const plan = find(insights, 'plan-garen');
  assert.ok(plan);
  assert.equal(plan.action, 'Notas de Garen');
  assert.ok(find(insights, 'prep-darius'));
  assert.ok(find(insights, 'strength-jinx'));
});

// Kai'Sa armada de ataque contra 3+ de daño físico: el catálogo la marca híbrida, pero
// el consejo tiene que respetar su build de daño y su rol de carry.
const PHYSICAL = ['Darius', 'Jinx', 'Zed', 'Aatrox', 'Lux'];
const kaisa = fields => ({
  own_champion_name: "Kai'Sa", lane: 'adc', enemy_champion_name: 'Jinx', enemy_champions: PHYSICAL,
  items_used: ['Hidra Titánica', 'Filo Infinito', 'Cuchilla Negra'], ...fields,
});

test('carry: nunca sugiere objetos de tanque y respeta el tipo de daño que arma el jugador', async () => {
  const { buildHabitsOf, threatAdvice } = await import('../../src/features/coach/detectors/build.js');
  const index = buildCatalog(catalog);
  const rows = many(6, kaisa({ result: 'loss' })).map(row => normalizeMatch(row, index));
  assert.equal(rows[0].own.buildClass, 'carry');
  const action = threatAdvice({ catalog: index, buildHabits: buildHabitsOf(rows) }, 'physical', { name: "Kai'Sa", own: rows[0].own });
  assert.doesNotMatch(action, /Corazón de Hielo|Cota de Espinas/);
  assert.doesNotMatch(action, /Báculo/, "no sugiere objetos de AP a una Kai'Sa armada de ataque");
  assert.match(action, /Ángel Guardián|Danza de la Muerte/);
  assert.match(action, /Como carry/);
});

test('carry: Ángel Guardián cuenta como respuesta al daño físico', () => {
  const index = buildCatalog(catalog);
  const row = normalizeMatch(match(kaisa({ items_used: ['Hidra Titánica', 'Filo Infinito', 'Ángel Guardián'] })), index);
  assert.equal(row.threats.physical.answered, true);
});

test('carry: 59% sin defensa contra 80% en 5 partidas con defensa no alcanza para aconsejar', () => {
  const matches = [
    ...many(10, kaisa({ result: 'win' })),
    ...many(7, kaisa({ result: 'loss' }), 11),
    ...many(4, kaisa({ result: 'win', items_used: ['Hidra Titánica', 'Filo Infinito', 'Ángel Guardián'] }), 18),
    ...many(1, kaisa({ result: 'loss', items_used: ['Hidra Titánica', 'Filo Infinito', 'Ángel Guardián'] }), 22),
    ...many(10, { result: 'win', own_champion_name: "Kai'Sa", lane: 'adc' }, 23),
  ];
  assert.equal(find(report(matches).insights, 'threat-physical'), undefined);
});
