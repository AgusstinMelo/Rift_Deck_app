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
    { id: 'armor-pen', name: 'Penetración', category: 'Mejorado', type: ['Daño Físico'], stats: ['Penetración de armadura'], description: 'Atraviesa armadura.', effect_tags: ['penetracion_armadura'], image_url: 'https://example.test/item.jpg' },
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
  assert.match(prompt, /exactamente el slot 3/);
});
