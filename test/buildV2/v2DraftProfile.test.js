// Perfil del draft para Build V2: señales del rival, lo que le falta a tu equipo y qué
// runas y hechizos encajan con tu clase, tu línea y esas señales.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDraftProfile, draftFitContext, fitHints, fitOf } from '../../src/features/buildV2/v2DraftProfile.js';
import { buildV2Prompt } from '../../src/features/buildV2/v2PromptBuilder.js';
import { stabilizeV2Result } from '../../src/features/buildV2/v2ResultStabilizer.js';

const champ = (id, roles, fields = {}) => ({ id, name: id[0].toUpperCase() + id.slice(1), roles, traits: [], team_roles: [], ...fields });
const zed = champ('zed', ['Asesino'], { team_roles: ['diver', 'pick'], score_burst: 5, score_engage: 2 });
const akali = champ('akali', ['Asesino'], { team_roles: ['diver'], score_burst: 4 });
const thresh = champ('thresh', ['Tanque'], { team_roles: ['frontline', 'pick'], score_engage: 4, traits: ['cc_duro'] });
const amumu = champ('amumu', ['Tanque'], { team_roles: ['frontline', 'iniciador'], score_engage: 5, traits: ['cc_duro'] });
const jinx = champ('jinx', ['Tirador'], { team_roles: ['daño_sostenido'], score_peel: 1 });
const lux = champ('lux', ['Mago'], { team_roles: ['poke', 'pick'], score_range: 5, score_peel: 2 });
const ahri = champ('ahri', ['Mago'], { team_roles: ['poke', 'pick'], score_range: 3, score_burst: 4 });
const garen = champ('garen', ['Luchador'], { team_roles: ['frontline', 'split'], score_peel: 2 });
const yuumi = champ('yuumi', ['Soporte'], { team_roles: ['protector'], score_peel: 5 });

test('señales del rival con los campeones que las forman', () => {
  const profile = buildDraftProfile({ champion: jinx, role: 'adc', allies: [], enemies: [zed, akali, thresh, amumu] });
  const by = signal => profile.enemy_signals.find(entry => entry.signal === signal)?.champions;
  assert.deepEqual(by('divers'), ['Zed', 'Akali']);
  assert.deepEqual(by('burst'), ['Zed', 'Akali']);
  assert.deepEqual(by('pick'), ['Zed', 'Thresh']);
  assert.deepEqual(by('engage'), ['Thresh', 'Amumu']);
  assert.deepEqual(by('tanques'), ['Thresh', 'Amumu']);
  // Con un solo poke no hay señal de poke.
  assert.equal(by('poke'), undefined);
  // Sin aliados cargados no se afirma nada de tu equipo.
  assert.deepEqual(profile.ally_gaps, []);
});

test('señales de luchadores, squishies y kiteo', () => {
  const darius = champ('darius', ['Luchador']);
  const sion = champ('sion', ['Luchador', 'Tanque']);
  const ezreal = champ('ezreal', ['Tirador'], { score_mobility: 4 });
  const ashe = champ('ashe', ['Tirador'], { score_range: 5, traits: ['ralentizacion'] });
  const by = (enemies, signal) => buildDraftProfile({ champion: jinx, role: 'adc', allies: [], enemies })
    .enemy_signals.find(entry => entry.signal === signal)?.champions;
  // Los tanques no cuentan como luchadores ni como squishies.
  assert.deepEqual(by([darius, garen, sion], 'luchadores'), ['Darius', 'Garen']);
  assert.deepEqual(by([zed, lux, ezreal, thresh], 'squishies'), ['Zed', 'Lux', 'Ezreal']);
  assert.equal(by([zed, lux, darius], 'squishies'), undefined);
  assert.deepEqual(by([ezreal, ashe, lux], 'kiteo'), ['Ezreal', 'Ashe']);
});

test('lo que le falta a tu equipo, y qué cubre tu campeón', () => {
  const asGaren = buildDraftProfile({ champion: garen, role: 'top', allies: [jinx, lux, ahri], enemies: [] });
  assert.deepEqual(asGaren.selected_covers, ['primera_linea']);
  assert.ok(asGaren.ally_gaps.includes('peel') && asGaren.ally_gaps.includes('engage'));
  const withYuumi = buildDraftProfile({ champion: jinx, role: 'adc', allies: [garen, lux, yuumi], enemies: [] });
  assert.deepEqual(withYuumi.ally_gaps, ['engage']);
  assert.deepEqual(withYuumi.selected_covers, []);
});

const runes = [
  { id: 'guardian', name: 'Guardián', branch: 'Clave', group: 1, fits_classes: ['soporte', 'tanque'], counters: ['burst', 'asesinos', 'divers'] },
  { id: 'lethal', name: 'Cadencia Letal', branch: 'Clave', group: 1, fits_classes: ['tirador', 'luchador'], counters: ['tanques'] },
  { id: 'nimbus', name: 'Orbe de Anulación', branch: 'Valor', group: 2, fits_classes: ['tirador', 'mago'], counters: ['burst', 'asesinos', 'divers'] },
];
const spells = [
  { id: 'flash', name: 'Destello', fits_classes: ['tirador', 'mago'], fits_lanes: ['adc', 'mid'], counters: ['burst', 'divers'] },
  { id: 'barrier', name: 'Barrera', fits_classes: ['tirador', 'mago'], fits_lanes: ['mid', 'adc'], counters: ['burst', 'asesinos', 'divers'] },
  { id: 'tp', name: 'Teleportación', fits_classes: ['luchador'], fits_lanes: ['top'], counters: [] },
];

test('pistas: runas y hechizos de tu clase y línea que responden al rival', () => {
  const profile = buildDraftProfile({ champion: jinx, role: 'adc', allies: [], enemies: [zed, akali, thresh, amumu] });
  const hints = fitHints({ runes, spells }, { champion: jinx, role: 'adc', profile });
  // Guardián responde a divers pero no es de tirador; Cadencia Letal responde a tanques.
  assert.deepEqual(hints.runes.map(entry => entry.id), ['nimbus', 'lethal']);
  assert.deepEqual(hints.spells.map(entry => entry.id), ['barrier', 'flash']);
  assert.deepEqual(fitOf(spells[2], { classes: new Set(['tirador']), lane: 'adc', signals: new Set() }), { fitsClass: false, fitsLane: false, answers: [] });
});

test('el prompt lleva el perfil de pelea, draft_profile y ANSWER_HINTS', () => {
  const snapshot = {
    patchVersion: '7.3f',
    champions: [jinx, zed, akali, thresh],
    coreItems: [{ id: 'ie', name: 'Filo', category: 'Mejorado', type: ['Daño Físico'] }],
    movementItems: [{ id: 'boots', name: 'Botas', type: ['Movimiento'] }],
    runes,
    spells,
  };
  const prompt = buildV2Prompt({ snapshot, championId: 'jinx', role: 'adc', allies: { adc: 'jinx' }, enemies: { mid: 'zed', jungler: 'akali', support: 'thresh' } });
  assert.match(prompt, /"team_roles":\["diver","pick"\]/);
  assert.match(prompt, /"score_burst":5/);
  assert.match(prompt, /"draft_profile":\{"selected_team_roles":\["daño_sostenido"\],"enemy_signals":\[\{"signal":"divers","champions":\["Zed","Akali"\]\}/);
  assert.match(prompt, /ANSWER_HINTS\s+\{"runes":\[\{"id":"nimbus"/);
  assert.match(prompt, /fits_classes/);
  assert.match(prompt, /nunca recomiendes otro pick ni cambios en el draft/);
});

test('el estabilizador completa con la runa clave y el hechizo que encajan con tu clase y el rival', () => {
  const snapshot = {
    champions: [jinx, zed, akali, thresh, amumu],
    coreItems: [],
    runes: [...runes, { id: 'r1', name: 'R1', branch: 'Valor', group: 1 }, { id: 'r3', name: 'R3', branch: 'Valor', group: 3 }, { id: 's', name: 'S', branch: 'Precisión', group: 1 }],
    spells,
  };
  const fit = draftFitContext({ snapshot, championId: 'jinx', role: 'adc', allies: { adc: 'jinx' }, enemies: { mid: 'zed', jungler: 'akali', support: 'thresh', top: 'amumu' } });
  // La IA no eligió runa clave ni hechizos válidos.
  const result = stabilizeV2Result({ core_items: [], keystone: { id: 'nope' }, primary_runes: [], spells: [] }, snapshot, { role: 'adc', fit });
  assert.equal(result.keystone.id, 'lethal');
  assert.deepEqual(result.spells.map(spell => spell.id), ['barrier', 'flash']);
});

test('señales por tipo de daño: una pieza con counters solo daño_magico solo aparece contra daño mágico', () => {
  const orb = { id: 'orb', name: 'Escudo antimagia', branch: 'Valor', group: 2, fits_classes: ['tirador'], counters: ['daño_magico'] };
  const ap = (id, name) => champ(id, ['Mago'], { name, damage_type: 'AP' });
  const ad = (id, name) => champ(id, ['Luchador'], { name, damage_type: 'AD' });
  const hybrid = (id, name) => champ(id, ['Luchador'], { name, damage_type: 'Hybrid' });
  // Irelia, Yi, Samira, Braum y Morgana: 1 de mágico → sin señal.
  const physical = buildDraftProfile({ champion: jinx, role: 'adc', enemies: [ad('irelia', 'Irelia'), ad('yi', 'Yi'), ad('samira', 'Samira'), ad('braum', 'Braum'), ap('morgana', 'Morgana')] });
  assert.ok(!physical.enemy_signals.some(entry => entry.signal === 'daño_magico'));
  assert.deepEqual(physical.enemy_signals.find(entry => entry.signal === 'daño_fisico').champions, ['Irelia', 'Yi', 'Samira', 'Braum']);
  assert.deepEqual(fitHints({ runes: [orb], spells: [] }, { champion: jinx, role: 'adc', profile: physical }).runes, []);
  // Ekko, Morgana y Yone (híbrido): 2,5 de mágico → señal, y el Orbe aparece en las pistas.
  const magic = buildDraftProfile({ champion: jinx, role: 'adc', enemies: [ap('ekko', 'Ekko'), ap('morgana', 'Morgana'), hybrid('yone', 'Yone')] });
  assert.deepEqual(magic.enemy_signals.find(entry => entry.signal === 'daño_magico').champions, ['Ekko', 'Morgana', 'Yone']);
  assert.deepEqual(fitHints({ runes: [orb], spells: [] }, { champion: jinx, role: 'adc', profile: magic }).runes, [{ id: 'orb', answers: ['dano_magico'] }]);
});
