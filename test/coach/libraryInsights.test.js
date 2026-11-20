// Fichas de objeto y runa de la Biblioteca: campeones que los aprovechan, cómo se
// contrarresta un objeto, objetos que potencian una runa y tu rendimiento con ellos.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  championsForItem, championsForRune, inferredItemClasses, itemCountersFor, itemsForRune, personalUsage,
} from '../../src/features/library/entityInsights.js';

const champion = (name, fields) => ({
  id: name, name, traits: [], roles: [], item_scalings: [], damage_type: 'AD', ...fields,
});
const item = (name, fields) => ({
  id: name, name, category: 'Mejorado', active: true, type: ['Daño Fisico'], effect_tags: [], situational_role: [],
  armor: 0, magic_res: 0, life: 0, attack_speed: 0, attack_damage: 0, ability_power: 0, ...fields,
});

const kaisa = champion("Kai'Sa", { roles: ['Tirador'], traits: ['dependiente_autoataques', 'rango'], item_scalings: ['velocidad_ataque', 'on_hit'], damage_type: 'Hybrid' });
const jinx = champion('Jinx', { roles: ['Tirador'], traits: ['dependiente_autoataques', 'rango'], item_scalings: ['velocidad_ataque', 'daño_ataque', 'probabilidad_critico'] });
const lux = champion('Lux', { roles: ['Mago'], traits: ['dependiente_habilidades', 'cc_duro', 'root', 'daño_burst'], item_scalings: ['poder_habilidad', 'aceleracion_habilidad'], damage_type: 'AP' });
const garen = champion('Garen', { roles: ['Luchador'], traits: ['melee', 'dependiente_habilidades'], item_scalings: ['vida', 'armadura', 'resistencia_magica'] });
const champions = [kaisa, jinx, lux, garen];

const witsEnd = item('Al Filo de la Cordura', { attack_speed: 50, magic_res: 45, effect_tags: ['daño_on_hit', 'autocuracion'], fits_classes: ['tirador', 'luchador', 'asesino'] });
const items = [
  witsEnd,
  item('Recordatorio Mortal', { attack_damage: 35, effect_tags: ['anti_curacion', 'penetracion_armadura'], situational_role: ['counter'] }),
  item('Báculo del Vacío', { type: ['Daño Magico'], ability_power: 70, effect_tags: ['penetracion_magica'] }),
  item('Fauces de Malmortius', { attack_damage: 40, magic_res: 40, effect_tags: ['defensa_magica', 'anti_burst'] }),
  item('Eco de Luden', { type: ['Daño Magico'], ability_power: 100, ability_haste: 10, effect_tags: ['daño_burst', 'daño_habilidad'] }),
  item('Botas de Mercurio', { category: 'Nivel Medio', type: ['Movimiento'], magic_res: 25 }),
];

test('campeones que aprovechan un objeto: los de su clase que escalan con sus estadísticas, aunque no usen la resistencia', () => {
  const names = championsForItem(witsEnd, champions).map(entry => entry.name);
  assert.ok(names.includes("Kai'Sa"), 'Kai\'Sa escala con velocidad de ataque y al impacto');
  assert.ok(!names.includes('Lux'), 'una maga no arma Filo de la Cordura');
});

test('botas: clases deducidas de lo que dan y campeones de esas clases que escalan con su otra estadística', () => {
  const mercury = items.at(-1);
  assert.deepEqual([...inferredItemClasses(mercury)].sort(), ['luchador', 'tanque']);
  assert.deepEqual(championsForItem(mercury, champions).map(entry => entry.name), ['Garen'], 'la velocidad de movimiento no cuenta: decide la resistencia');
  const sorcerers = item('Zapatos de Lanzahechizos', { category: 'Mejorado', type: ['Movimiento'], ability_power: 35, flat_magic_penetration: 18, flat_movement: 45 });
  assert.deepEqual([...inferredItemClasses(sorcerers)], ['mago']);
  assert.deepEqual(championsForItem(sorcerers, champions).map(entry => entry.name), ['Lux']);
});

test('cómo se contrarresta un objeto: anticuración contra su curación, penetración contra su resistencia', () => {
  const groups = itemCountersFor(witsEnd, items);
  const byKey = Object.fromEntries(groups.map(group => [group.key, group.items.map(entry => entry.name)]));
  assert.deepEqual(byKey.curacion, ['Recordatorio Mortal']);
  assert.deepEqual(byKey.resistenciaMagica, ['Báculo del Vacío']);
  assert.ok(groups.every(group => !group.items.some(entry => entry.name === 'Botas de Mercurio')), 'solo objetos terminados');
});

test('runa: campeones que la activan con su kit y objetos que la potencian', () => {
  const lethal = { id: 'lt', name: 'Cadencia Letal', branch: 'Clave', fits_classes: ['tirador', 'luchador'], trigger_tags: ['autoataque', 'golpes_consecutivos'], benefit_tags: ['velocidad_ataque'] };
  const fans = championsForRune(lethal, champions).map(entry => entry.name);
  assert.ok(fans.includes("Kai'Sa") && fans.includes('Jinx'));
  assert.ok(!fans.includes('Lux'), 'no es para magos');
  assert.deepEqual(itemsForRune(lethal, items).map(entry => entry.name), ['Al Filo de la Cordura']);

  const electrocute = { id: 'el', name: 'Electrocutar', branch: 'Clave', fits_classes: ['mago', 'asesino'], trigger_tags: ['golpes_multiples', 'impacto_habilidad'], benefit_tags: ['daño_burst'] };
  assert.deepEqual(championsForRune(electrocute, champions).map(entry => entry.name), ['Lux']);
  assert.equal(itemsForRune(electrocute, items)[0].name, 'Eco de Luden');
});

test('tu rendimiento: winrate con y sin, y los campeones con que más lo usaste', () => {
  const row = (champ, result, used) => ({ own_champion_name: champ, result, items_used: used ? ['Al Filo de la Cordura', 'Filo Infinito'] : ['Filo Infinito'] });
  const matches = [row("Kai'Sa", 'win', true), row("Kai'Sa", 'win', true), row('Jinx', 'loss', true), row('Jinx', 'loss', false), row('Jinx', 'win', false)];
  const usage = personalUsage(matches, 'Al filo de la cordura', 'items_used');
  assert.equal(usage.games, 3);
  assert.equal(usage.wins, 2);
  assert.equal(usage.without.games, 2);
  assert.equal(usage.without.wr, 0.5);
  assert.deepEqual(usage.champions.map(entry => [entry.name, entry.games]), [["Kai'Sa", 2], ['Jinx', 1]]);
  assert.equal(personalUsage(matches, 'Cometa Arcano', 'runes_used').games, 0);
});
