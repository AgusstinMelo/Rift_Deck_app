// Luces de la tarjeta compartible según los colores del splash del campeón.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PALETTE, paletteFromPixels } from '../../src/features/share/artPalette.js';

/** Píxeles RGBA: [[r, g, b], cantidad], ... */
const pixels = (...groups) => groups.flatMap(([rgb, count]) => Array.from({ length: count }, () => [...rgb, 255])).flat();
const hueOf = ([r, g, b]) => {
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  const hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return (hue * 60 + 360) % 360;
};
const near = (actual, expected, tolerance = 20) => {
  const gap = Math.abs(actual - expected) % 360;
  assert.ok(Math.min(gap, 360 - gap) <= tolerance, `tono ${actual.toFixed(0)}, se esperaba ~${expected}`);
};

const DARK = [[12, 14, 24], 600];

test('dos colores fuertes: el que más pesa arriba y el otro abajo (Kai\'Sa: violeta y celeste)', () => {
  const palette = paletteFromPixels(pixels(DARK, [[170, 40, 220], 300], [[40, 160, 230], 150]));
  near(hueOf(palette.primary), 282);
  near(hueOf(palette.secondary), 202);
});

test('las sombras y los grises no definen el color', () => {
  const palette = paletteFromPixels(pixels([[20, 20, 30], 2000], [[128, 128, 128], 2000], [[230, 60, 40], 200], [[40, 90, 230], 120]));
  near(hueOf(palette.primary), 6);
  near(hueOf(palette.secondary), 222);
});

test('un solo color (Brand: fuego): el segundo es el mismo corrido hacia el rojo', () => {
  const palette = paletteFromPixels(pixels(DARK, [[240, 120, 30], 400]));
  near(hueOf(palette.primary), 26);
  near(hueOf(palette.secondary), 356);
});

test('el amarillo no va en la luz de abajo: se ve verde oliva sobre el azul noche', () => {
  const palette = paletteFromPixels(pixels(DARK, [[240, 120, 30], 400], [[235, 215, 40], 300]));
  near(hueOf(palette.primary), 26);
  const secondary = hueOf(palette.secondary);
  assert.ok(secondary < 46 || secondary > 95, `tono de abajo ${secondary.toFixed(0)}`);
});

test('un arte casi sin color usa las luces por defecto (dorado y violeta)', () => {
  assert.equal(paletteFromPixels(pixels([[30, 30, 34], 1000], [[140, 138, 136], 1000])), DEFAULT_PALETTE);
  assert.equal(paletteFromPixels([]), DEFAULT_PALETTE);
});
