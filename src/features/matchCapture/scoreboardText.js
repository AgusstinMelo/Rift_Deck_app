// Lectura del texto del marcador sin IA: K/D/A y oro de la fila del jugador, y si fue
// victoria o derrota. El marcador de Wild Rift tiene posiciones fijas (ver
// scoreboardLayout.js) y siempre la misma tipografía, así que alcanza con:
//  1. recortar la zona del texto,
//  2. separar texto y fondo con un umbral automático (Otsu),
//  3. cortar los caracteres por columnas vacías,
//  4. comparar la forma de cada uno con plantillas de dígitos y "/" (GLYPH_TEMPLATES,
//     sacadas de capturas reales).
// Módulo puro (trabaja con píxeles RGBA): lo usan el navegador y los tests.
import { DURATION_TEMPLATES, GLYPH_TEMPLATES } from './scoreboardGlyphs.js';
import { LAYOUT } from './scoreboardLayout.js';

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

// Arriba del marcador (y en altos de pantalla desde arriba; x desde el centro):
// - modo ("CLASIFICATORIA", "PVP"...) a la izquierda y, debajo, la duración
//   ("Wild Rift·12:16", formato mm:ss),
// - puntaje de cada equipo (asesinatos totales) a los lados de VICTORIA / DERROTA.
export const TOP_REGIONS = {
  mode: { x0: -0.9, x1: -0.45, y: 0.049, h: 0.05 },
  // Desde el final de "Wild Rift" hasta después de los segundos: incluye el "·".
  duration: { x0: -0.84, x1: -0.69, y: 0.0885, h: 0.034 },
  blueScore: { x0: -0.26, x1: -0.16, y: 0.072, h: 0.05 },
  redScore: { x0: 0.16, x1: 0.26, y: 0.072, h: 0.05 },
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

/** Alto (en píxeles) al que se amplía una zona de texto antes de leerla. */
export const TARGET_ZONE_HEIGHT = 40;

/**
 * Amplía el brillo de una zona con interpolación bilineal. En capturas chicas los
 * dígitos miden 7-9 px y se pegan o se deforman al binarizar; ampliados, la separación
 * entre caracteres y sus formas son mucho más estables.
 */
function upscale(values, w, h, factor) {
  if (factor <= 1) return { values, w, h };
  const W = Math.round(w * factor);
  const H = Math.round(h * factor);
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y += 1) {
    const sy = Math.min(h - 1, Math.max(0, (y + 0.5) / factor - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(h - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < W; x += 1) {
      const sx = Math.min(w - 1, Math.max(0, (x + 0.5) / factor - 0.5));
      const x0 = Math.floor(sx);
      const x1 = Math.min(w - 1, x0 + 1);
      const fx = sx - x0;
      const top = values[y0 * w + x0] * (1 - fx) + values[y0 * w + x1] * fx;
      const bottom = values[y1 * w + x0] * (1 - fx) + values[y1 * w + x1] * fx;
      out[y * W + x] = top * (1 - fy) + bottom * fy;
    }
  }
  return { values: out, w: W, h: H };
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
  const empty = { blocks: [], columnInk: [], textHeight: 0, scale: 1, makeGlyph: () => null };
  const x0 = Math.max(0, Math.round(rect.x));
  const y0 = Math.max(0, Math.round(rect.y));
  const rawW = Math.min(image.width - x0, Math.round(rect.w));
  const rawH = Math.min(image.height - y0, Math.round(rect.h));
  if (rawW < 4 || rawH < 4) return empty;
  const factor = Math.min(4, Math.max(1, TARGET_ZONE_HEIGHT / rawH));
  const { values, w, h } = upscale(brightness(image, x0, y0, rawW, rawH), rawW, rawH, factor);
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

  // scale: cuánto se amplió la zona (las posiciones de los bloques están ampliadas).
  return { blocks, columnInk, textHeight, scale: factor, makeGlyph };
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

const isNoise = (glyph, textHeight, minHeight = 0.45) => !glyph || glyph.height < textHeight * minHeight;

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
  // Cada carácter puede tener una plantilla o varias variantes (se usa la más parecida).
  const costOf = template => distance(glyph.cells, template.cells) / glyph.cells.length + 4 * (glyph.aspect - template.aspect) ** 2;
  const ranked = Object.entries(templates).map(([char, template]) => ({
    char,
    cost: Array.isArray(template) ? Math.min(...template.map(costOf)) : costOf(template),
  })).sort((a, b) => a.cost - b.cost);
  return { char: ranked[0].char, score: 1 - ranked[0].cost, margin: (ranked[1]?.cost ?? 1) - ranked[0].cost };
}

/**
 * Lee un bloque de columnas con tinta. Si es ancho (dígitos pegados) prueba dividirlo
 * en 1 a 4 caracteres y se queda con la división que mejor coincide con las plantillas.
 * @returns {Array<{ char: string, score: number, margin: number }> | null}
 */
function readBlock(block, segment, templates, minHeight) {
  const { columnInk, textHeight, makeGlyph } = segment;
  const width = block.right - block.left + 1;
  const maxParts = Math.max(1, Math.min(4, Math.floor(width / (textHeight * 0.25))));
  let best = null;
  for (let parts = 1; parts <= maxParts; parts += 1) {
    if (parts > 1 && width < textHeight * DIGIT_ASPECT * 1.2) break;
    const pieces = parts === 1 ? [block] : splitBlock(block, parts, columnInk, textHeight);
    if (!pieces) continue;
    const glyphs = pieces.map(piece => makeGlyph(piece.left, piece.right));
    if (glyphs.some(glyph => isNoise(glyph, textHeight, minHeight))) {
      if (parts === 1 && glyphs.every(glyph => isNoise(glyph, textHeight, minHeight))) break; // ruido
      continue;
    }
    const results = glyphs.map(glyph => classifyGlyph(glyph, templates));
    const cost = results.reduce((sum, result) => sum + (1 - result.score), 0) / results.length;
    if (!best || cost < best.cost - 0.002) best = { cost, results };
  }
  return best ? best.results : null;
}

/**
 * Lee una zona como texto ("4/0/6", "10674"). Devuelve también el margen del carácter
 * más dudoso.
 */
export function readText(image, rect, templates = GLYPH_TEMPLATES, { minHeight = 0.45 } = {}) {
  const segment = segmentBlocks(image, rect);
  const results = segment.blocks.flatMap(block => readBlock(block, segment, templates, minHeight) || []);
  return {
    text: results.map(result => result.char).join(''),
    minMargin: results.length ? Math.min(...results.map(result => result.margin)) : 0,
  };
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

/** Alto mínimo de captura (px) para dar por segura una lectura local. */
export const MIN_SURE_HEIGHT = 480;

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

/** Rectángulo en píxeles de una zona de la franja superior. */
function topRect(width, height, region) {
  return {
    x: width / 2 + region.x0 * height,
    y: (region.y - region.h / 2) * height,
    w: (region.x1 - region.x0) * height,
    h: region.h * height,
  };
}

/** "12", "16" → 736 segundos; null si no es un mm:ss válido. */
export function parseDuration(minutes, seconds) {
  const m = Number(minutes);
  const s = Number(seconds);
  if (!Number.isInteger(m) || !Number.isInteger(s) || s > 59 || m < 1 || m > 90) return null;
  return m * 60 + s;
}

/**
 * Duración de la partida, de "Wild Rift·12:16" (debajo del modo). Los separadores se
 * reconocen por su altura, sin depender de las letras: el punto medio "·" es muy bajo
 * (marca dónde empieza el tiempo) y los ":" son de altura intermedia. Los dígitos se
 * comparan con las plantillas de la tipografía del texto chico (DURATION_TEMPLATES).
 * @returns {{ seconds: number | null, minMargin: number, raw: string }}
 */
export function readDuration(image, templates = DURATION_TEMPLATES) {
  const segment = segmentBlocks(image, topRect(image.width, image.height, TOP_REGIONS.duration));
  const tokens = [];
  for (const block of segment.blocks) {
    const glyph = segment.makeGlyph(block.left, block.right);
    if (!glyph) continue;
    const relativeHeight = glyph.height / segment.textHeight;
    if (relativeHeight < 0.4) {
      tokens.push({ char: '·', margin: 1 });
    } else if (relativeHeight < 0.85 && glyph.aspect < 0.7) {
      tokens.push({ char: ':', margin: 1 });
    } else {
      tokens.push(...(readBlock(block, segment, templates, 0.85) || []));
    }
  }
  const raw = tokens.map(token => token.char).join('');
  const start = raw.lastIndexOf('·') + 1;
  const time = raw.slice(start);
  // Con ":" detectado, mm:ss; si el ":" se perdió, los 2 últimos dígitos son los segundos.
  const match = /^(\d{1,2}):(\d{2})$/.exec(time) || /^(\d{1,2})(\d{2})$/.exec(time);
  const timeTokens = tokens.slice(start).filter(token => token.char !== ':');
  return {
    seconds: match ? parseDuration(match[1], match[2]) : null,
    minMargin: timeTokens.length ? Math.min(...timeTokens.map(token => token.margin)) : 0,
    raw,
  };
}

/**
 * Modo de juego por el ANCHO del título (no hace falta leer letra por letra):
 * "CLASIFICATORIA" ≈ 0,27 altos de pantalla y "PVP" ≈ 0,07. Un título mucho más largo
 * ("CLASIFICATORIA LEGENDARIA") es la legendaria.
 * @returns {{ value: 'ranked' | 'legendary_ranked' | 'casual', confidence: 'high' | 'medium' } | null}
 */
export function readMode(image) {
  const { blocks, scale } = segmentBlocks(image, topRect(image.width, image.height, TOP_REGIONS.mode));
  if (!blocks.length) return null;
  const width = (blocks[blocks.length - 1].right - blocks[0].left + 1) / scale / image.height;
  if (width >= 0.4) return { value: 'legendary_ranked', confidence: 'medium' };
  if (width >= 0.2) return { value: 'ranked', confidence: 'high' };
  if (width <= 0.14) return { value: 'casual', confidence: 'high' };
  return null;
}

/** Número entero de una zona (puntajes), o null. */
function readNumber(image, rect) {
  const read = readText(image, rect);
  return /^\d{1,3}$/.test(read.text) ? { value: Number(read.text), minMargin: read.minMargin } : null;
}

/**
 * Lee K/D/A, oro, resultado, modo y duración del marcador, sin IA.
 * Control cruzado del K/D/A: la suma de los asesinatos de tu equipo tiene que dar su
 * puntaje (arriba, en azul) y la suma de sus muertes, el puntaje rival (en rojo). Si
 * cierra, asesinatos y muertes quedan con confianza alta aunque algún carácter haya
 * sido dudoso; si no cierra, quedan para revisar.
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
  const mode = readMode(image);
  const duration = readDuration(image);
  // Capturas muy chicas: los dígitos miden pocos píxeles; se lee igual pero todo queda
  // para revisar.
  const lowRes = height < MIN_SURE_HEIGHT;
  const sure = read => !lowRes && read.minMargin >= SURE_MARGIN;

  // Control con los puntajes: K/D/A de las 5 filas de tu equipo.
  const blue = readNumber(image, topRect(width, height, TOP_REGIONS.blueScore));
  const red = readNumber(image, topRect(width, height, TOP_REGIONS.redScore));
  const rowCenters = Array.from({ length: 5 }, (_, row) => (LAYOUT.firstRowY + row * LAYOUT.rowPitch) * height);
  const ownRow = rowCenters.reduce((best, y, row) => (Math.abs(y - rowY) < Math.abs(rowCenters[best] - rowY) ? row : best), 0);
  const allyKdas = rowCenters.map((y, row) => (row === ownRow ? kda : parseKda(readText(image, textRect(width, height, y, TEXT_REGIONS.kda)).text)));
  let teamCheck = null;
  if (blue && red && allyKdas.every(Boolean)) {
    const kills = allyKdas.reduce((sum, row) => sum + row.kills, 0);
    const deaths = allyKdas.reduce((sum, row) => sum + row.deaths, 0);
    teamCheck = kills === blue.value && deaths === red.value;
  }
  const kdaConfidence = lowRes ? 'medium' : teamCheck === true ? 'high' : teamCheck === false ? 'medium' : (sure(kdaRead) ? 'high' : 'medium');
  // Si el control no cierra, la imagen se está leyendo mal: el oro también se revisa.
  const goldSure = sure(goldRead) && teamCheck !== false;

  return {
    kills: kda ? { value: kda.kills, confidence: kdaConfidence } : null,
    deaths: kda ? { value: kda.deaths, confidence: kdaConfidence } : null,
    assists: kda ? { value: kda.assists, confidence: teamCheck === false ? 'medium' : (sure(kdaRead) ? 'high' : 'medium') } : null,
    gold: gold !== null ? { value: gold, confidence: goldSure ? 'high' : 'medium' } : null,
    result: result ? { value: result, confidence: 'high' } : null,
    match_type: mode,
    // La duración leída en el celular es un respaldo (texto muy chico): siempre queda
    // para revisar y no pisa lo que lea el modelo.
    duration_seconds: duration.seconds !== null ? { value: duration.seconds, confidence: 'medium' } : null,
    teamCheck,
    raw: { kda: kdaRead.text, gold: goldRead.text, duration: duration.raw, blue: blue?.value ?? null, red: red?.value ?? null },
  };
}
