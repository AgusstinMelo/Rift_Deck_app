// Colores de las luces de la tarjeta compartible según el campeón: los dos tonos que más
// pesan en su splash (Kai'Sa: violeta y celeste; Brand: naranja y rojo). Se leen los
// píxeles del arte reducido en un canvas y se agrupan por tono; cuentan más los colores
// saturados y luminosos, así el fondo oscuro o gris del splash no gana.

/** Luces por defecto (dorado arriba y violeta abajo), como la tarjeta original. */
export const DEFAULT_PALETTE = { primary: [212, 175, 55], secondary: [124, 58, 237] };

const BINS = 24; // 15° de tono por grupo
/** Distancia mínima entre los dos tonos (en grupos): 45°. Si no, serían casi el mismo color. */
const MIN_HUE_GAP = 3;
/** El segundo tono tiene que pesar al menos esto respecto del primero; si no, se deriva del primero. */
const MIN_SECONDARY_SHARE = 0.12;

function rgbToHsv(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return [hue, max ? delta / max : 0, max / 255];
}

function hslToRgb(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - chroma / 2;
  const [r, g, b] = hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x]
    : hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return [r, g, b].map(value => Math.round((value + m) * 255));
}

/**
 * Color de luz a partir de un tono: saturado y de luminosidad media, para que brille
 * sobre el fondo azul noche sin importar si en el splash era oscuro o pálido.
 */
const glowColor = hue => hslToRgb(hue, 0.78, 0.58);

/** Amarillo a verde lima: sobre el azul noche, en una luz grande, se ve sucio. */
const isMuddyBelow = hue => hue >= 46 && hue <= 95;

/** Tono promedio (circular) de un grupo y sus vecinos, ponderado por peso. */
function hueAround(bins, index) {
  let x = 0;
  let y = 0;
  for (let offset = -1; offset <= 1; offset += 1) {
    const bin = bins[(index + offset + BINS) % BINS];
    x += bin.x;
    y += bin.y;
  }
  const hue = (Math.atan2(y, x) * 180) / Math.PI;
  return hue < 0 ? hue + 360 : hue;
}

/**
 * Las dos luces de un arte a partir de sus píxeles RGBA (los de un canvas).
 * @param {Uint8ClampedArray | number[]} data
 * @returns {{ primary: number[], secondary: number[] }} Colores [r, g, b]; DEFAULT_PALETTE si el arte es casi gris.
 */
export function paletteFromPixels(data) {
  const bins = Array.from({ length: BINS }, () => ({ weight: 0, x: 0, y: 0 }));
  for (let index = 0; index + 3 < data.length; index += 4) {
    if (data[index + 3] < 128) continue;
    const [hue, saturation, value] = rgbToHsv(data[index], data[index + 1], data[index + 2]);
    // Sombras y grises no definen el color del campeón.
    if (value < 0.22 || saturation < 0.25) continue;
    const weight = saturation * saturation * value;
    const bin = bins[Math.floor(hue / (360 / BINS)) % BINS];
    const radians = (hue * Math.PI) / 180;
    bin.weight += weight;
    bin.x += Math.cos(radians) * weight;
    bin.y += Math.sin(radians) * weight;
  }
  // Peso de cada grupo sumando a sus vecinos: un color que cae en el borde de dos grupos no se parte.
  const smoothed = bins.map((_, index) => [-1, 0, 1].reduce((sum, offset) => sum + bins[(index + offset + BINS) % BINS].weight, 0));
  const total = bins.reduce((sum, bin) => sum + bin.weight, 0);
  const pixels = data.length / 4;
  // Casi sin color (un splash en grises): quedan las luces por defecto. Jinx, con mucho
  // cielo apagado, da 0,019: el corte va bastante más abajo.
  if (!pixels || total / pixels < 0.006) return DEFAULT_PALETTE;

  const first = smoothed.indexOf(Math.max(...smoothed));
  const distance = index => {
    const gap = Math.abs(index - first) % BINS;
    return Math.min(gap, BINS - gap);
  };
  const candidates = smoothed
    .map((weight, index) => ({ weight, index, hue: hueAround(bins, index) }))
    // La luz de abajo es grande: en amarillo o verde lima, mezclada con el azul noche, queda
    // verde oliva. Esos tonos no van abajo (sí arriba, si dominan: ahí se leen dorados).
    .filter(({ index, hue }) => distance(index) >= MIN_HUE_GAP && !isMuddyBelow(hue))
    .sort((a, b) => b.weight - a.weight);
  const primaryHue = hueAround(bins, first);
  const second = candidates[0];
  // Un splash de un solo color (Brand: todo fuego): el segundo es el mismo color corrido
  // 30° hacia el rojo o el violeta (naranja → rojo, celeste → azul).
  const derived = (primaryHue + 330) % 360;
  const secondaryHue = second && second.weight >= smoothed[first] * MIN_SECONDARY_SHARE
    ? second.hue
    : isMuddyBelow(derived) ? 35 : derived;
  return { primary: glowColor(primaryHue), secondary: glowColor(secondaryHue) };
}

const cache = new Map();

/**
 * Luces de un arte por URL (memorizado). La imagen se pide con CORS para poder leer sus
 * píxeles; si el servidor no lo permite o falla, quedan las luces por defecto.
 * @param {string} url
 * @returns {Promise<{ primary: number[], secondary: number[] }>}
 */
export function loadArtPalette(url) {
  if (!url) return Promise.resolve(DEFAULT_PALETTE);
  if (!cache.has(url)) {
    cache.set(url, new Promise(resolve => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        try {
          const width = 96;
          const height = Math.max(1, Math.round((image.naturalHeight / image.naturalWidth) * width)) || 56;
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          context.drawImage(image, 0, 0, width, height);
          resolve(paletteFromPixels(context.getImageData(0, 0, width, height).data));
        } catch {
          resolve(DEFAULT_PALETTE);
        }
      };
      image.onerror = () => resolve(DEFAULT_PALETTE);
      image.src = url;
    }));
  }
  return cache.get(url);
}

/** rgba() de un color [r, g, b] con transparencia. */
export const rgba = ([r, g, b], alpha) => `rgba(${r}, ${g}, ${b}, ${alpha})`;
