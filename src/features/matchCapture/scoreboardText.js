// Lectura del texto del marcador sin IA: K/D/A y oro de la fila del jugador, y si fue
// victoria o derrota. El marcador de Wild Rift tiene posiciones fijas (ver
// scoreboardLayout.js) y siempre la misma tipografía, así que alcanza con:
//  1. recortar la zona del texto,
//  2. separar texto y fondo con un umbral automático (Otsu),
//  3. cortar los caracteres por columnas vacías,
//  4. comparar la forma de cada uno con plantillas de dígitos y "/" (GLYPH_TEMPLATES,
//     sacadas de capturas reales).
// Módulo puro (trabaja con píxeles RGBA): lo usan el navegador y los tests.
import { GLYPH_TEMPLATES } from './scoreboardGlyphs.js';

export const GLYPH_W = 8;
export const GLYPH_H = 12;
/** Ancho típico de un dígito respecto del alto del texto (para separar dígitos pegados). */
export const DIGIT_ASPECT = 0.62;

// Zonas de texto de la fila (x desde el centro y alto, en altos de pantalla; y desde
// el centro de la fila). La primera línea de la fila tiene el K/D/A y el oro.
export const TEXT_REGIONS = {
  kda: { x0: -0.486, x1: -0.345, dy: -0.0255, h: 0.034 },
  gold: { x0: -0.28, x1: -0.185, dy: -0.0255, h: 0.034 },
};

// Título "VICTORIA" / "DERROTA", arriba al centro.
export const RESULT_REGION = { x0: -0.13, x1: 0.13, y0: 0.035, y1: 0.105 };

/** Brillo de cada píxel: el canal más alto (el texto es blanco, celeste o rojo). */
function brightness(image, x0, y0, w, h) {
  const values = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const index = ((y0 + y) * image.width + (x0 + x)) * 4;
      values[y * w + x] = Math.max(image.data[index], image.data[index + 1], image.data[index + 2]);
    }
  }
  return values;
}

/** Umbral de Otsu: separa los dos grupos de brillo (fondo y texto). */
export function otsuThreshold(values) {
  const histogram = new Array(256).fill(0);
  for (const value of values) histogram[Math.min(255, Math.max(0, Math.round(value)))] += 1;
  const total = values.length;
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * histogram[i];
  let sumBackground = 0;
  let weightBackground = 0;
  let best = 0;
  let threshold = 128;
  for (let i = 0; i < 256; i += 1) {
    weightBackground += histogram[i];
    if (!weightBackground) continue;
    const weightForeground = total - weightBackground;
    if (!weightForeground) break;
    sumBackground += i * histogram[i];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const between = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
    if (between > best) {
      best = between;
      threshold = i;
    }
  }
  return threshold;
}

/**
 * Prepara una zona de texto: binariza (Otsu), encuentra la banda del texto y los
 * bloques de columnas con tinta. Devuelve los bloques y una función que arma el
 * carácter (grilla GLYPH_W × GLYPH_H + proporción) de cualquier tramo de columnas.
 * @param {{ width: number, height: number, data: Uint8ClampedArray }} image
 * @param {{ x: number, y: number, w: number, h: number }} rect  en píxeles
 */
export function segmentBlocks(image, rect) {
  const empty = { blocks: [], columnInk: [], textHeight: 0, makeGlyph: () => null };
  const x0 = Math.max(0, Math.round(rect.x));
  const y0 = Math.max(0, Math.round(rect.y));
  const w = Math.min(image.width - x0, Math.round(rect.w));
  const h = Math.min(image.height - y0, Math.round(rect.h));
  if (w < 4 || h < 4) return empty;
  const values = brightness(image, x0, y0, w, h);
  const threshold = otsuThreshold(values);
  const ink = new Uint8Array(w * h);
  for (let i = 0; i < values.length; i += 1) ink[i] = values[i] > threshold ? 1 : 0;

  // Banda del texto: el tramo continuo más largo de filas con bastante tinta. Así no
  // la agrandan el fondo (por ejemplo, el degradé dorado de la fila resaltada) ni
  // bordes de otras líneas, que dejan algunas filas sueltas con brillo.
  const rowInk = Array.from({ length: h }, (_, y) => ink.slice(y * w, y * w + w).reduce((a, b) => a + b, 0));
  const maxRow = Math.max(...rowInk);
  if (!maxRow) return empty;
  let top = 0;
  let bottom = -1;
  for (let y = 0, start = -1; y <= h; y += 1) {
    const dense = y < h && rowInk[y] >= maxRow * 0.2;
    if (dense && start < 0) start = y;
    if (!dense && start >= 0) {
      if (y - 1 - start > bottom - top) {
        top = start;
        bottom = y - 1;
      }
      start = -1;
    }
  }
  if (bottom < top) return empty;
  const textHeight = bottom - top + 1;

  const columnInk = Array.from({ length: w }, (_, x) => {
    let count = 0;
    for (let y = top; y <= bottom; y += 1) count += ink[y * w + x];
    return count;
  });

  const blocks = [];
  for (let x = 0, start = -1; x <= w; x += 1) {
    const has = x < w && columnInk[x] > 0;
    if (has && start < 0) start = x;
    if (!has && start >= 0) {
      blocks.push({ left: start, right: x - 1 });
      start = -1;
    }
  }

  const makeGlyph = (left, right) => {
    let gTop = bottom;
    let gBottom = top;
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        if (ink[y * w + x]) {
          if (y < gTop) gTop = y;
          if (y > gBottom) gBottom = y;
        }
      }
    }
    if (gBottom < gTop) return null;
    const gw = right - left + 1;
    const gh = gBottom - gTop + 1;
    const cells = new Float32Array(GLYPH_W * GLYPH_H);
    for (let cy = 0; cy < GLYPH_H; cy += 1) {
      for (let cx = 0; cx < GLYPH_W; cx += 1) {
        const ys = gTop + Math.floor((cy * gh) / GLYPH_H);
        const ye = gTop + Math.max(Math.floor(((cy + 1) * gh) / GLYPH_H), Math.floor((cy * gh) / GLYPH_H) + 1);
        const xs = left + Math.floor((cx * gw) / GLYPH_W);
        const xe = left + Math.max(Math.floor(((cx + 1) * gw) / GLYPH_W), Math.floor((cx * gw) / GLYPH_W) + 1);
        let sum = 0;
        let count = 0;
        for (let y = ys; y < ye; y += 1) {
          for (let x = xs; x < xe; x += 1) {
            sum += ink[y * w + x];
            count += 1;
          }
        }
        cells[cy * GLYPH_W + cx] = count ? sum / count : 0;
      }
    }
    return { left, right, height: gh, aspect: gw / gh, cells, textHeight };
  };

  return { blocks, columnInk, textHeight, makeGlyph };
}

/** Cortes de un bloque en `parts` caracteres, por la columna con menos tinta cerca de cada corte esperado. */
function splitBlock(block, parts, columnInk, textHeight) {
  const width = block.right - block.left + 1;
  const pieces = [];
  let left = block.left;
  for (let part = 1; part < parts; part += 1) {
    const expected = block.left + (width * part) / parts;
    const reach = Math.max(1, textHeight * DIGIT_ASPECT * 0.3);
    const from = Math.max(left + 1, Math.round(expected - reach));
    const to = Math.min(block.right - 1, Math.round(expected + reach));
    let cut = Math.min(Math.max(Math.round(expected), from), to);
    for (let x = from; x <= to; x += 1) if (columnInk[x] < columnInk[cut]) cut = x;
    pieces.push({ left, right: cut - 1 });
    left = cut + 1;
  }
  pieces.push({ left, right: block.right });
  return pieces.every(piece => piece.right >= piece.left) ? pieces : null;
}

const isNoise = (glyph, textHeight) => !glyph || glyph.height < textHeight * 0.45;

/**
 * Caracteres de una zona separando dígitos pegados por ancho (sin plantillas). Se usa
 * para armar las plantillas con capturas etiquetadas.
 */
export function segmentGlyphs(image, rect) {
  const { blocks, columnInk, textHeight, makeGlyph } = segmentBlocks(image, rect);
  const glyphs = [];
  for (const block of blocks) {
    const width = block.right - block.left + 1;
    const parts = Math.max(1, Math.round(width / (textHeight * DIGIT_ASPECT)));
    const pieces = (width >= textHeight * DIGIT_ASPECT * 1.35 && parts > 1 && splitBlock(block, parts, columnInk, textHeight)) || [block];
    for (const piece of pieces) {
      const glyph = makeGlyph(piece.left, piece.right);
      if (!isNoise(glyph, textHeight)) glyphs.push(glyph);
    }
  }
  return glyphs;
}

function distance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += (a[i] - b[i]) ** 2;
  return sum;
}

/**
 * Clasifica un carácter contra las plantillas: forma (grilla) y proporción.
 * @returns {{ char: string, score: number, margin: number }}  score/margin: más es mejor
 */
export function classifyGlyph(glyph, templates = GLYPH_TEMPLATES) {
  const ranked = Object.entries(templates).map(([char, template]) => ({
    char,
    cost: distance(glyph.cells, template.cells) / glyph.cells.length + 4 * (glyph.aspect - template.aspect) ** 2,
  })).sort((a, b) => a.cost - b.cost);
  return { char: ranked[0].char, score: 1 - ranked[0].cost, margin: (ranked[1]?.cost ?? 1) - ranked[0].cost };
}

/**
 * Lee una zona como texto ("4/0/6", "10674"). Los bloques anchos (dígitos pegados) se
 * prueban dividir en 1 a 4 caracteres y se queda la división que mejor coincide con las
 * plantillas. Devuelve también el margen del carácter más dudoso.
 */
export function readText(image, rect, templates = GLYPH_TEMPLATES) {
  const { blocks, columnInk, textHeight, makeGlyph } = segmentBlocks(image, rect);
  const chars = [];
  const margins = [];
  for (const block of blocks) {
    const width = block.right - block.left + 1;
    const maxParts = Math.max(1, Math.min(4, Math.floor(width / (textHeight * 0.25))));
    let best = null;
    for (let parts = 1; parts <= maxParts; parts += 1) {
      if (parts > 1 && width < textHeight * DIGIT_ASPECT * 1.2) break;
      const pieces = parts === 1 ? [block] : splitBlock(block, parts, columnInk, textHeight);
      if (!pieces) continue;
      const glyphs = pieces.map(piece => makeGlyph(piece.left, piece.right));
      if (glyphs.some(glyph => isNoise(glyph, textHeight))) {
        if (parts === 1 && glyphs.every(glyph => isNoise(glyph, textHeight))) break; // ruido
        continue;
      }
      const results = glyphs.map(glyph => classifyGlyph(glyph, templates));
      const cost = results.reduce((sum, result) => sum + (1 - result.score), 0) / results.length;
      if (!best || cost < best.cost - 0.002) best = { cost, results };
    }
    if (!best) continue;
    for (const result of best.results) {
      chars.push(result.char);
      margins.push(result.margin);
    }
  }
  return { text: chars.join(''), minMargin: margins.length ? Math.min(...margins) : 0 };
}

/** Rectángulo en píxeles de una zona de texto de la fila centrada en rowY. */
export function textRect(width, height, rowY, region) {
  return {
    x: width / 2 + region.x0 * height,
    y: rowY + (region.dy - region.h / 2) * height,
    w: (region.x1 - region.x0) * height,
    h: region.h * height,
  };
}

/** "4/0/6" → { kills: 4, deaths: 0, assists: 6 } o null si no tiene esa forma. */
export function parseKda(text) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{1,2})$/.exec(text);
  return match ? { kills: Number(match[1]), deaths: Number(match[2]), assists: Number(match[3]) } : null;
}

/** "10674" → 10674 (3 a 6 dígitos) o null. */
export function parseGold(text) {
  return /^\d{3,6}$/.test(text) ? Number(text) : null;
}

/** Margen mínimo entre el mejor carácter y el segundo para considerar segura la lectura. */
export const SURE_MARGIN = 0.04;

/**
 * Victoria o derrota por el color del título: "VICTORIA" es azul y "DERROTA", rojo.
 * @returns {'win' | 'loss' | null}
 */
export function readResult(image) {
  const { width, height, data } = image;
  const x0 = Math.round(width / 2 + RESULT_REGION.x0 * height);
  const x1 = Math.round(width / 2 + RESULT_REGION.x1 * height);
  const y0 = Math.round(RESULT_REGION.y0 * height);
  const y1 = Math.round(RESULT_REGION.y1 * height);
  let blue = 0;
  let red = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      if (Math.max(r, g, b) < 120) continue; // solo el texto (brillante), no el fondo
      if (b > r + 40 && b > 140) blue += 1;
      else if (r > b + 40 && r > 140) red += 1;
    }
  }
  const total = blue + red;
  if (total < (x1 - x0) * (y1 - y0) * 0.01) return null;
  if (blue > red * 2) return 'win';
  if (red > blue * 2) return 'loss';
  return null;
}

/**
 * Lee K/D/A, oro y resultado del marcador para la fila del jugador.
 * @param {{ width: number, height: number, data: Uint8ClampedArray }} image
 * @param {number} rowY  centro vertical de la fila del jugador (barra dorada)
 */
export function readScoreboardText(image, rowY) {
  const { width, height } = image;
  const kdaRead = readText(image, textRect(width, height, rowY, TEXT_REGIONS.kda));
  const goldRead = readText(image, textRect(width, height, rowY, TEXT_REGIONS.gold));
  const kda = parseKda(kdaRead.text);
  const gold = parseGold(goldRead.text);
  const result = readResult(image);
  const confidence = read => (read.minMargin >= SURE_MARGIN ? 'high' : 'medium');
  return {
    kills: kda ? { value: kda.kills, confidence: confidence(kdaRead) } : null,
    deaths: kda ? { value: kda.deaths, confidence: confidence(kdaRead) } : null,
    assists: kda ? { value: kda.assists, confidence: confidence(kdaRead) } : null,
    gold: gold !== null ? { value: gold, confidence: confidence(goldRead) } : null,
    result: result ? { value: result, confidence: 'high' } : null,
    raw: { kda: kdaRead.text, gold: goldRead.text },
  };
}
