// Auditoría de la build de la IA: confirma que sea la mejor para el campeón y el draft o
// la corrige. Caso real: Kai'Sa ADC contra Darius, Kayn, Akali, Ezreal y Nautilus, para
// la que la IA propuso Espada del Rey Arruinado, Ángel Guardián 2º, Filo del Infinito sin
// otros objetos de crítico, Guinsoo y Recordatorio Mortal 5º.
import test from 'node:test';
import assert from 'node:assert/strict';
import { auditCoreItems } from '../../src/features/buildV2/v2BuildAudit.js';
import { draftFitContext } from '../../src/features/buildV2/v2DraftProfile.js';
import { stabilizeV2Result } from '../../src/features/buildV2/v2ResultStabilizer.js';

const item = (id, name, fields) => ({ id, name, category: 'Mejorado', type: ['Daño Fisico'], effect_tags: [], situational_role: ['ofensivo'], critical_impact: 0, ...fields });
const coreItems = [
  item('botrk', 'Espada del Rey Arruinado', { effect_tags: ['daño_on_hit', 'daño_vida_actual', 'daño_sostenido'], situational_role: ['core', 'ofensivo'] }),
  item('ga', 'Ángel Guardián', { type: ['Daño Fisico', 'Defensa'], effect_tags: ['revivir', 'defensa_fisica', 'anti_burst'], situational_role: ['defensivo'], armor: 40 }),
  item('ie', 'Filo del Infinito', { effect_tags: ['modificador_critico', 'daño_autoataque'], situational_role: ['core', 'late', 'ofensivo'], critical_impact: 25 }),
  item('guinsoo', 'Espadafuria de Guinsoo', { type: ['Daño Fisico', 'Daño Magico'], effect_tags: ['daño_on_hit', 'daño_sostenido', 'buff_velocidad_ataque'], situational_role: ['core', 'late'] }),
  item('mortal', 'Recordatorio Mortal', { effect_tags: ['penetracion_armadura', 'anti_curacion', 'modificador_critico'], situational_role: ['counter', 'late'], critical_impact: 25 }),
  item('terminus', 'Terminus', { effect_tags: ['daño_on_hit', 'buff_velocidad_ataque', 'penetracion_armadura'], situational_role: ['core', 'ofensivo'] }),
  item('navori', 'Cuchillas Raudas de Navori', { effect_tags: ['modificador_critico'], critical_impact: 25 }),
  item('phantom', 'Bailarín Espectral', { effect_tags: ['modificador_critico', 'velocidad_movimiento'], critical_impact: 25 }),
  item('thornmail', 'Cota de Espinas', { type: ['Defensa'], effect_tags: ['defensa_fisica', 'anti_curacion'], situational_role: ['counter', 'defensivo'], armor: 75 }),
];
const champ = (id, name, roles, traits = [], fields = {}) => ({ id, name, roles, traits, team_roles: [], ...fields });
const snapshot = {
  champions: [
    champ('kaisa', "Kai'Sa", ['Tirador'], ['dependiente_autoataques', 'dependiente_on_hit', 'rango', 'dash'], { damage_type: 'Hybrid', team_roles: ['diver', 'daño_sostenido'] }),
    champ('darius', 'Darius', ['Luchador'], ['melee', 'autocuracion'], { team_roles: ['frontline'] }),
    champ('kayn', 'Kayn', ['Asesino'], ['melee', 'autocuracion'], { team_roles: ['diver', 'pick'], score_burst: 4 }),
    champ('akali', 'Akali', ['Asesino'], ['melee', 'dash'], { team_roles: ['diver'], score_burst: 5 }),
    champ('ezreal', 'Ezreal', ['Tirador'], ['rango']),
    champ('nautilus', 'Nautilus', ['Tanque'], ['cc_duro'], { team_roles: ['frontline', 'iniciador'] }),
  ],
  coreItems,
};
const enemies = { top: 'darius', jungler: 'kayn', mid: 'akali', adc: 'ezreal', support: 'nautilus' };
const fit = (team = enemies) => draftFitContext({ snapshot, championId: 'kaisa', role: 'adc', allies: { adc: 'kaisa' }, enemies: team });
const ai = ['botrk', 'ga', 'ie', 'guinsoo', 'mortal'].map(id => ({ id, reason: `razón de ${id}` }));
const ids = result => result.coreItems.map(entry => entry.id);

test('Kai\'Sa al impacto: Filo del Infinito aislado se cambia, el defensivo va al final y el antiheal 3º contra curaciones', () => {
  const result = auditCoreItems({ coreItems: ai, snapshot, fit: fit() });
  assert.deepEqual(ids(result), ['botrk', 'terminus', 'mortal', 'guinsoo', 'ga']);
  assert.match(result.coreItems[1].reason, /Filo del Infinito/);
  assert.equal(result.notes.length, 3);
  assert.ok(result.notes.some(note => /Ángel Guardián al objeto 5/.test(note)));
  assert.ok(result.notes.some(note => /Recordatorio Mortal al objeto 3.*Darius y Kayn/.test(note)));
  // Las razones de la IA de los objetos que solo se movieron se conservan.
  assert.equal(result.coreItems.find(entry => entry.id === 'ga').reason, 'razón de ga');
});

test('sin curadores en el rival, el antiheal no se adelanta', () => {
  const result = auditCoreItems({ coreItems: ai, snapshot, fit: fit({ mid: 'akali', adc: 'ezreal', support: 'nautilus' }) });
  assert.deepEqual(ids(result), ['botrk', 'terminus', 'guinsoo', 'ga', 'mortal']);
});

test('un Filo del Infinito con otros dos objetos de crítico se respeta', () => {
  const crit = ['navori', 'ie', 'phantom', 'mortal', 'ga'].map(id => ({ id, reason: id }));
  const result = auditCoreItems({ coreItems: crit, snapshot, fit: fit({}) });
  assert.deepEqual(ids(result), ['navori', 'phantom', 'ie', 'mortal', 'ga']);
});

test('un carry no arma objetos de tanque: Cota de Espinas se cambia por un objeto de daño que defienda', () => {
  const tank = ['botrk', 'guinsoo', 'thornmail', 'terminus', 'mortal'].map(id => ({ id, reason: id }));
  const result = auditCoreItems({ coreItems: tank, snapshot, fit: fit({}) });
  assert.ok(!ids(result).includes('thornmail'));
  assert.equal(ids(result)[3], 'ga');
});

test('con temática pedida solo valen las reglas firmes de orden', () => {
  const result = auditCoreItems({ coreItems: [{ id: 'ie' }, ...ai.filter(entry => entry.id !== 'ie')], snapshot, fit: fit(), themed: true });
  assert.deepEqual(ids(result), ['botrk', 'ga', 'ie', 'guinsoo', 'mortal']);
  assert.deepEqual(result.notes, []);
});

test('el estabilizador aplica la auditoría y la cuenta en las adaptaciones', () => {
  const runes = [
    { id: 'k', name: 'K', branch: 'Clave', group: 1 },
    ...[1, 2, 3].map(group => ({ id: `p${group}`, name: `P${group}`, branch: 'Precisión', group })),
    { id: 's1', name: 'S1', branch: 'Valor', group: 1 },
  ];
  const result = stabilizeV2Result({
    core_items: ai, keystone: { id: 'k', reason: 'k' }, primary_runes: ['p1', 'p2', 'p3'].map(id => ({ id, reason: id })),
    secondary_rune: { id: 's1', reason: 's' }, spells: [], key_adaptations: ['a', 'b', 'c'], build_plan: {},
  }, { ...snapshot, runes, spells: [] }, { role: 'adc', fit: fit() });
  assert.deepEqual(result.core_items.map(entry => entry.id), ['botrk', 'terminus', 'mortal', 'guinsoo', 'ga']);
  assert.equal(result.key_adaptations.length, 4);
  assert.equal(result.key_adaptations[0], 'a');
  assert.match(result.key_adaptations.at(-1), /Rift Deck/);
});

test('dos defensivos entre los primeros: los dos pasan después del núcleo de daño', () => {
  const early = ['ga', 'botrk', 'thornmail', 'guinsoo', 'terminus'].map(id => ({ id, reason: id }));
  const result = auditCoreItems({ coreItems: early, snapshot, fit: fit({}) });
  const order = ids(result);
  // Cota de Espinas se cambia (objeto de tanque) y ningún defensivo queda entre los tres primeros.
  assert.ok(!order.includes('thornmail'));
  assert.ok(order.slice(0, 3).every(id => !['ga'].includes(id)), order.join(','));
  assert.ok(result.notes.every(note => !/al objeto [123]:/.test(note)), result.notes.join(' | '));
});

const runeRows = [
  { id: 'conq', name: 'Conquistador', branch: 'Clave', group: 1, fits_classes: ['luchador', 'asesino', 'tirador'] },
  { id: 'guardian', name: 'Guardián', branch: 'Clave', group: 1, fits_classes: ['soporte', 'tanque'], counters: ['burst', 'divers'] },
  { id: 'brutal', name: 'Brutalidad', branch: 'Precisión', group: 1, fits_classes: ['tirador', 'luchador', 'asesino'] },
  { id: 'laststand', name: 'Último Bastión', branch: 'Precisión', group: 2, fits_classes: ['luchador', 'tanque', 'asesino'] },
  { id: 'cut', name: 'Corte', branch: 'Precisión', group: 2, fits_classes: ['tirador', 'luchador', 'mago'], counters: ['tanques'] },
  { id: 'coup', name: 'Golpe de Gracia', branch: 'Precisión', group: 2, fits_classes: ['tirador', 'asesino', 'mago'] },
  { id: 'alacrity', name: 'Leyenda: Celeridad', branch: 'Precisión', group: 3, fits_classes: ['tirador', 'luchador'] },
  { id: 'bone', name: 'Coraza Ósea', branch: 'Valor', group: 2, fits_classes: ['tanque', 'luchador', 'soporte'] },
  { id: 'nullify', name: 'Orbe de Anulación', branch: 'Valor', group: 2, fits_classes: ['tirador', 'mago', 'asesino', 'soporte'], counters: ['burst', 'divers'] },
];
const spellRows = [
  { id: 'flash', name: 'Destello', fits_classes: ['tirador', 'luchador', 'tanque'] },
  { id: 'tp', name: 'Teleportación', fits_classes: ['mago', 'luchador', 'tanque'] },
  { id: 'barrier', name: 'Barrera', fits_classes: ['tirador', 'mago'], counters: ['burst', 'divers'] },
  { id: 'heal', name: 'Curación', fits_classes: ['tirador', 'soporte'] },
];
const pieceSnapshot = { ...snapshot, runes: runeRows, spells: spellRows };
const pick = id => ({ id, reason: `IA ${id}` });
const pieceFit = () => draftFitContext({ snapshot: pieceSnapshot, championId: 'kaisa', role: 'adc', allies: { adc: 'kaisa' }, enemies });

test('runas y hechizos: lo que no es para la clase se cambia en el mismo lugar', async () => {
  const { auditRunesAndSpells } = await import('../../src/features/buildV2/v2BuildAudit.js');
  const result = auditRunesAndSpells({
    keystone: pick('guardian'), primaryRunes: [pick('brutal'), pick('laststand'), pick('alacrity')],
    secondaryRune: pick('bone'), spells: [pick('flash'), pick('tp')],
    snapshot: pieceSnapshot, fit: pieceFit(), role: 'adc',
  });
  // Kai'Sa es tiradora: Guardián, Último Bastión, Coraza Ósea y Teleportación no son para ella.
  assert.equal(result.keystone.id, 'conq');
  assert.deepEqual(result.primaryRunes.map(rune => rune.id), ['brutal', 'cut', 'alacrity'].map(id => (id === 'cut' ? result.primaryRunes[1].id : id)));
  assert.ok(['cut', 'coup'].includes(result.primaryRunes[1].id));
  assert.equal(result.secondaryRune.id, 'nullify');
  assert.deepEqual(result.spells.map(spell => spell.id), ['flash', 'barrier']);
  assert.equal(result.notes.length, 4);
  assert.match(result.primaryRunes[1].reason, /Último Bastión/);
  // Lo que ya encaja conserva la razón de la IA.
  assert.equal(result.primaryRunes[0].reason, 'IA brutal');
});

test('runas: un luchador con Último Bastión no se toca, y con temática nada cambia', async () => {
  const { auditRunesAndSpells } = await import('../../src/features/buildV2/v2BuildAudit.js');
  const fighter = draftFitContext({ snapshot: pieceSnapshot, championId: 'darius', role: 'top', allies: { top: 'darius' }, enemies: {} });
  const input = { keystone: pick('conq'), primaryRunes: [pick('brutal'), pick('laststand'), pick('alacrity')], secondaryRune: pick('bone'), spells: [pick('flash'), pick('tp')], snapshot: pieceSnapshot, role: 'top' };
  assert.deepEqual(auditRunesAndSpells({ ...input, fit: fighter }).notes, []);
  assert.deepEqual(auditRunesAndSpells({ ...input, keystone: pick('guardian'), fit: pieceFit(), themed: true }).notes, []);
});

test('un carry no lleva más de dos defensivos: sobra el que menos aprovecha su kit', () => {
  const sterak = item('sterak', 'Guantelete de Sterak', { type: ['Daño Fisico', 'Defensa'], effect_tags: ['escudo', 'anti_burst'], situational_role: ['defensivo', 'ofensivo'], life: 300 });
  const maw = item('maw', 'Fauces de Malmortius', { effect_tags: ['defensa_magica', 'escudo', 'anti_burst'], situational_role: ['counter', 'defensivo'], magic_res: 40 });
  const statikk = item('statikk', 'Daga de Statikk', { effect_tags: ['daño_on_hit', 'buff_velocidad_ataque'], situational_role: ['core', 'ofensivo'], attack_speed: 30 });
  const kaisa = { ...snapshot.champions[0], item_scalings: ['daño_ataque', 'velocidad_ataque', 'on_hit', 'poder_habilidad'] };
  // Estadísticas como en el catálogo real: Sterak es solo vida; Ángel Guardián y Fauces traen daño.
  const withStats = coreItems.filter(row => row.id !== 'terminus').map(row => (row.id === 'ga' ? { ...row, attack_damage: 45 } : row));
  const local = { ...snapshot, champions: [kaisa, ...snapshot.champions.slice(1)], coreItems: [...withStats, sterak, { ...maw, attack_damage: 55 }, statikk] };
  const localFit = draftFitContext({ snapshot: local, championId: 'kaisa', role: 'adc', allies: { adc: 'kaisa' }, enemies: {} });
  const result = auditCoreItems({ coreItems: ['botrk', 'guinsoo', 'sterak', 'ga', 'maw'].map(id => ({ id, reason: id })), snapshot: local, fit: localFit });
  const order = result.coreItems.map(entry => entry.id);
  assert.ok(!order.includes('sterak'), order.join(','));
  assert.ok(order.includes('statikk'));
  assert.deepEqual(order.slice(3).sort(), ['ga', 'maw']);
});

test('Terminus (daño al impacto con resistencias) no cuenta como defensivo, y mover uno no adelanta otro', () => {
  const terminus = item('terminus2', 'Terminus', { effect_tags: ['daño_on_hit', 'defensa_fisica', 'defensa_magica'], situational_role: ['late', 'defensivo', 'ofensivo'], attack_damage: 35, attack_speed: 35 });
  const maw = item('maw2', 'Fauces de Malmortius', { effect_tags: ['defensa_magica', 'anti_burst'], situational_role: ['counter', 'defensivo'], attack_damage: 55, magic_res: 45 });
  const local = { ...snapshot, coreItems: [...coreItems.map(row => (row.id === 'ga' ? { ...row, attack_damage: 45 } : row)), terminus, maw] };
  const localFit = draftFitContext({ snapshot: local, championId: 'kaisa', role: 'adc', allies: { adc: 'kaisa' }, enemies: {} });
  // Caso real (Kai'Sa contra Yone, Ekko, Kog'Maw, Xayah y Morgana): la build de la IA ya era buena.
  const ai2 = ['botrk', 'guinsoo', 'terminus2', 'maw2', 'ga'].map(id => ({ id, reason: id }));
  const result = auditCoreItems({ coreItems: ai2, snapshot: local, fit: localFit });
  assert.deepEqual(result.coreItems.map(entry => entry.id), ['botrk', 'guinsoo', 'terminus2', 'maw2', 'ga']);
  assert.deepEqual(result.notes, []);
  // Fauces 3º y Ángel Guardián 4º: los dos defensivos pasan detrás de los tres de daño.
  const early = auditCoreItems({ coreItems: ['botrk', 'guinsoo', 'maw2', 'ga', 'terminus2'].map(id => ({ id, reason: id })), snapshot: local, fit: localFit });
  assert.deepEqual(early.coreItems.map(entry => entry.id), ['botrk', 'guinsoo', 'terminus2', 'maw2', 'ga']);
});

test('resistencia del lado equivocado: contra un equipo físico, Al Filo de la Cordura se cambia por defensa con armadura', () => {
  const witsEnd = item('wits', 'Al Filo de la Cordura', { effect_tags: ['daño_on_hit', 'defensa_magica'], situational_role: ['defensivo', 'ofensivo'], attack_speed: 50, magic_res: 45 });
  const dance = item('dance', 'Danza de la Muerte', { type: ['Daño Fisico', 'Defensa'], effect_tags: ['reduccion_daño', 'anti_burst', 'defensa_fisica'], situational_role: ['defensivo'], attack_damage: 50, armor: 45 });
  const ad = (id, name) => ({ id, name, roles: ['Luchador'], traits: ['melee'], damage_type: 'AD', team_roles: [] });
  const local = {
    ...snapshot,
    champions: [...snapshot.champions, ad('irelia', 'Irelia'), ad('yi', 'Maestro Yi'), ad('samira', 'Samira'), ad('braum', 'Braum')],
    coreItems: [...coreItems.map(row => (row.id === 'ga' ? { ...row, attack_damage: 45 } : row)), witsEnd, dance],
  };
  const physical = draftFitContext({ snapshot: local, championId: 'kaisa', role: 'adc', allies: { adc: 'kaisa' }, enemies: { top: 'irelia', jungler: 'yi', adc: 'samira', support: 'braum' } });
  const result = auditCoreItems({ coreItems: ['botrk', 'guinsoo', 'terminus', 'wits', 'ga'].map(id => ({ id, reason: id })), snapshot: local, fit: physical });
  assert.deepEqual(result.coreItems.map(entry => entry.id), ['botrk', 'guinsoo', 'terminus', 'dance', 'ga']);
  assert.match(result.notes[0], /pega casi todo físico/);
  // Con daño mezclado no se toca.
  const mixed = draftFitContext({ snapshot: local, championId: 'kaisa', role: 'adc', allies: { adc: 'kaisa' }, enemies: { top: 'irelia', mid: 'akali', support: 'nautilus' } });
  assert.deepEqual(auditCoreItems({ coreItems: ['botrk', 'guinsoo', 'terminus', 'wits', 'ga'].map(id => ({ id, reason: id })), snapshot: local, fit: mixed }).notes, []);
});

test('kit_fit reconoce todos los valores de item_scalings de la lista cerrada', async () => {
  const { CHAMPION_ITEM_SCALINGS } = await import('../../src/features/coach/taxonomy.js');
  const { itemAnnotations } = await import('../../src/features/buildV2/v2BuildAudit.js');
  // Un objeto "con todo": cada valor de la lista tiene que sumar.
  const everything = item('all', 'Todo', {
    attack_damage: 1, attack_speed: 1, ability_power: 1, ability_haste: 1, life: 1, armor: 1, magic_res: 1,
    percentage_armor_penetration: 1, flat_armor_penetration: 1, percentage_magic_penetration: 1, flat_magic_penetration: 1,
    physic_vamp: 1, magic_vamp: 1, percentage_movement: 1, critical_impact: 1, critical_damage: 1, mana: 1, mana_reg: 1,
    healing_and_shield: 1, life_reg: 1, effect_tags: ['daño_on_hit'],
  });
  // Vida, armadura y resistencia mágica restan si el campeón no escala con ellas: se sacan
  // salvo para el valor que se está probando.
  const bulk = { vida: 'life', armadura: 'armor', resistencia_magica: 'magic_res' };
  for (const scaling of CHAMPION_ITEM_SCALINGS) {
    const row = { ...everything };
    Object.entries(bulk).forEach(([key, field]) => { if (key !== scaling) row[field] = 0; });
    assert.equal(itemAnnotations(row, { scalings: new Set([scaling]) }).kit_fit, 1, scaling);
  }
});
