import test from 'node:test';
import assert from 'node:assert/strict';
import { buildV2Prompt } from '../../src/features/buildV2/v2PromptBuilder.js';

const champion = (id, name) => ({
  id,
  name,
  roles: ['Top'],
  damage_type: ['Físico'],
  traits: ['Tanque'],
  item_scalings: ['Daño de ataque'],
  vulnerabilities: ['Daño porcentual'],
  image_url_card: 'https://example.test/imagen-muy-pesada.jpg',
  patch_id: 72,
});

const snapshot = {
  patchVersion: '7.2d',
  champions: [
    champion('sion', 'Sion'),
    champion('ally', 'Aliado'),
    champion('enemy', 'Enemigo'),
  ],
  coreItems: [
    { id: 'armor-pen', name: 'Penetración', category: 'Mejorado', type: ['Daño Físico'], percentage_armor_penetration: 30, armor: 0, description: 'Atraviesa armadura.', effect_tags: ['penetracion_armadura'], image_url: 'https://example.test/item.jpg' },
    { id: 'health', name: 'Vida', category: 'Mejorado', type: ['Defensa'], stats: ['Vida'], description: 'Aporta vida.' },
  ],
  movementItems: [{ id: 'boots', name: 'Botas', type: ['Movimiento'], description: 'Movimiento.' }],
  runes: [
    { id: 'key', name: 'Clave', branch: 'Clave', group: 1, description: 'Clave.' },
    { id: 'r1', name: 'Runa 1', branch: 'Valor', group: 1, description: 'Uno.' },
    { id: 'r2', name: 'Runa 2', branch: 'Valor', group: 2, description: 'Dos.' },
    { id: 'r3', name: 'Runa 3', branch: 'Valor', group: 3, description: 'Tres.' },
    { id: 'secondary', name: 'Secundaria', branch: 'Precisión', group: 1, description: 'Secundaria.' },
  ],
  spells: [
    { id: 'flash', name: 'Destello', description: 'Movilidad.' },
    { id: 'barrier', name: 'Barrera', description: 'Escudo.' },
  ],
};

const input = {
  snapshot,
  championId: 'sion',
  role: 'top',
  allies: { top: 'sion', jungler: 'ally' },
  enemies: { top: 'enemy' },
  buildPreference: 'penetración de armadura',
};

test('la temática solicitada domina y recibe pistas del catálogo', () => {
  const prompt = buildV2Prompt(input);
  assert.match(prompt, /requested_theme.*penetración de armadura/s);
  assert.match(prompt, /THEME_ITEM_HINTS\s+\[\{\x22id\x22:\x22armor-pen\x22,\x22matched_goals\x22:\[\x22armor_penetration\x22\]\}\]/);
  assert.doesNotMatch(prompt, /\x22key\x22:\x22armor\x22/);
  assert.match(prompt, /No impongas una cantidad fija/);
});

test('interpreta velocidad ap como dos objetivos complementarios', () => {
  const prompt = buildV2Prompt({ ...input, buildPreference: 'velocidad ap' });
  assert.match(prompt, /\x22key\x22:\x22attack_speed\x22/);
  assert.match(prompt, /\x22key\x22:\x22ability_power\x22/);
  assert.match(prompt, /distribuí la build para representar la combinación/);
});

test('el prompt compacto omite imágenes y metadatos del parche', () => {
  const prompt = buildV2Prompt(input);
  assert.equal(prompt.includes('imagen-muy-pesada.jpg'), false);
  assert.equal(prompt.includes('item.jpg'), false);
  assert.equal(prompt.includes('patch_id'), false);
  assert.equal(prompt.includes('ITEM_EFFECT_INDEX'), false);
  assert.match(prompt, /percentage_armor_penetration/);
  assert.equal(prompt.includes('\x22armor\x22'), false);
});

test('el segundo intento incluye errores y sólo las selecciones previas', () => {
  const prompt = buildV2Prompt({
    ...input,
    correction: {
      errors: ['core_items repetidos'],
      previousResult: {
        build_theme: 'Penetración',
        core_items: [{ id: 'armor-pen', reason: 'Texto largo innecesario' }],
        spells: [{ id: 'flash', reason: 'Texto largo innecesario' }],
      },
    },
  });
  assert.match(prompt, /SEGUNDO Y ÚLTIMO INTENTO/);
  assert.match(prompt, /core_items repetidos/);
  assert.equal(prompt.includes('Texto largo innecesario'), false);
});

test('prohíbe comprar Filo del Infinito antes del tercer slot', () => {
  const prompt = buildV2Prompt({ ...input, buildPreference: 'críticos' });
  assert.match(prompt, /Filo del Infinito/);
  assert.match(prompt, /nunca va en los slots 1 o 2/);
});

test('acepta composiciones parciales sin inventar espacios vacíos', () => {
  const prompt = buildV2Prompt({
    ...input,
    allies: { top: 'sion', jungler: '', mid: 'ally', adc: '', support: '' },
    enemies: { top: '', jungler: '', mid: 'enemy', adc: '', support: '' },
  });
  assert.match(prompt, /\x22draft_coverage\x22:\{\x22allies_provided\x22:2,\x22enemies_provided\x22:1\}/);
  assert.equal(prompt.includes('\x22champion\x22:{}'), false);
  assert.match(prompt, /tratá los espacios faltantes como desconocidos/);
});

test('genera contexto válido sin ninguna composición enemiga', () => {
  const prompt = buildV2Prompt({
    ...input,
    allies: { top: 'sion', jungler: '', mid: '', adc: '', support: '' },
    enemies: { top: '', jungler: '', mid: '', adc: '', support: '' },
  });
  assert.match(prompt, /\x22enemies\x22:\[\]/);
  assert.match(prompt, /\x22enemies_provided\x22:0/);
  assert.match(prompt, /basá la build en el campeón, el rol/);
});

test('good_against y avoid_against solo nombran a los rivales del draft', () => {
  const withLists = {
    ...snapshot,
    coreItems: snapshot.coreItems.map(item => ({ ...item, good_against: ['Enemigo', 'Darius', 'Jinx'], avoid_against: ['Zed'] })),
  };
  const prompt = buildV2Prompt({ ...input, snapshot: withLists });
  assert.match(prompt, /\["Enemigo"\]/);
  assert.doesNotMatch(prompt, /"Darius"|"Zed"/);
});

test('el defensivo de un carry no es obligatorio: depende de las señales del draft', () => {
  const prompt = buildV2Prompt(input);
  assert.match(prompt, /un objeto defensivo nunca es obligatorio/i);
  assert.match(prompt, /la mejor build puede ser full daño/);
  assert.doesNotMatch(prompt, /y ese defensivo va en el slot 4 o 5/);
});

test('cada objeto llega con answers, kit_fit y path calculados para la partida', () => {
  const champ = { ...snapshot.champions[0], item_scalings: ['penetracion_armadura_porcentual'] };
  const prompt = buildV2Prompt({ ...input, snapshot: { ...snapshot, champions: [champ, ...snapshot.champions.slice(1)] } });
  // Sin señales del rival en este draft, answers y path quedan vacíos y no se envían.
  assert.match(prompt, /"CORE_ITEMS":\{"fields":\["id","name","kit_fit",/);
  assert.match(prompt, /\["armor-pen","Penetración",1,/);
  assert.match(prompt, /Decidí sobre estas columnas/);
});

test('con temática "tanque" la temática manda sobre las reglas de clase', () => {
  const prompt = buildV2Prompt({ ...input, buildPreference: 'Kai\'Sa full tanque' });
  assert.match(prompt, /\x22key\x22:\x22tank\x22/);
  assert.match(prompt, /la temática manda sobre las reglas de clase/);
  assert.match(prompt, /con ella, los que mejor cumplen la temática/);
});
