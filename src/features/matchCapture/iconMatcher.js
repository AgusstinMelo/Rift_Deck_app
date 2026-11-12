// Identificación de íconos por comparación de píxeles (sin modelo de IA).
// Objetos, runas y hechizos del juego usan el mismo dibujo que los íconos del catálogo,
// así que se comparan directamente: el recorte de la captura y cada ícono se reducen a
// una grilla chica de color y se mide su correlación (insensible a brillo y contraste).
// Módulo puro (trabaja con arrays de píxeles RGBA): lo usan el navegador y los tests.

// Resolución de la grilla y radio de la máscara por forma, calibrados con capturas
// reales (test/fixtures/captures): los redondos (runas, hechizos) se distinguen mejor
// mirando el centro con más detalle; los objetos, con todo el ícono sin el marco.
export const SHAPES = {
  circle: { size: 32, radius: 0.5 },
  square: { size: 24, inset: 0.78 },
};

/**
 * Máscara de la zona que se compara: el centro del ícono, sin el borde (en el juego los
 * íconos tienen marcos que no están en el catálogo).
 * - circle: runas y hechizos (íconos redondos).
 * - square: objetos.
 */
export function buildMask(shape) {
  const { size, radius, inset } = SHAPES[shape];
  const mask = new Uint8Array(size * size);
  const center = (size - 1) / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x - center) / (size / 2);
      const dy = (y - center) / (size / 2);
      const inside = shape === 'circle'
        ? dx * dx + dy * dy <= radius * radius
        : Math.abs(dx) <= inset && Math.abs(dy) <= inset;
      mask[y * size + x] = inside ? 1 : 0;
    }
  }
  return mask;
}

/**
 * Vector de características: RGB de los píxeles dentro de la máscara, centrado (media 0)
 * y normalizado (norma 1). Con eso el producto punto entre dos vectores es su
 * correlación (Pearson), que no cambia si la captura es más clara u oscura.
 * @param {Uint8ClampedArray | number[]} rgba  píxeles RGBA de SHAPES[shape].size al cuadrado
 * @param {Uint8Array} mask
 * @returns {{ vector: Float32Array, spread: number }} spread = desvío (≈0 en slots vacíos)
 */
export function toFeature(rgba, mask) {
  const values = [];
  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index]) continue;
    values.push(rgba[index * 4], rgba[index * 4 + 1], rgba[index * 4 + 2]);
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  let norm = 0;
  const vector = new Float32Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    vector[index] = values[index] - mean;
    norm += vector[index] * vector[index];
  }
  const spread = Math.sqrt(norm / values.length);
  if (norm > 0) {
    const scale = 1 / Math.sqrt(norm);
    for (let index = 0; index < vector.length; index += 1) vector[index] *= scale;
  }
  return { vector, spread };
}

export function correlation(a, b) {
  let sum = 0;
  for (let index = 0; index < a.length; index += 1) sum += a[index] * b[index];
  return sum;
}

/** Desvío mínimo para considerar que un slot tiene ícono (los vacíos son casi lisos). */
export const EMPTY_SPREAD = 14;

/** Parecido mínimo para aceptar un ícono; por debajo se descarta (y se pide revisar). */
export const MIN_SCORE = 0.5;

/**
 * Elige el candidato más parecido entre varias versiones del recorte (corridas y
 * escaladas, para tolerar cajas imprecisas). La primera versión es la centrada: si es
 * casi lisa, el slot está vacío (las corridas podrían tomar parte del ícono vecino).
 * @param {Array<{ vector: Float32Array, spread: number }>} windows  versiones del recorte (la primera, centrada)
 * @param {Array<{ key: any, vector: Float32Array }>} candidates
 * @returns {{ key: any, score: number, margin: number, empty: boolean, ranking: Array<{ key: any, score: number }> }}
 */
export function bestMatch(windows, candidates) {
  const usable = windows.filter(window => window.spread >= EMPTY_SPREAD);
  if (!windows.length || windows[0].spread < EMPTY_SPREAD || !candidates.length) {
    return { key: null, score: 0, margin: 0, empty: true, ranking: [] };
  }
  const ranking = candidates.map(candidate => {
    let best = -1;
    for (const window of usable) {
      const score = correlation(window.vector, candidate.vector);
      if (score > best) best = score;
    }
    return { key: candidate.key, score: best };
  }).sort((a, b) => b.score - a.score);

  if (ranking[0].score < MIN_SCORE) {
    return { key: null, score: ranking[0].score, margin: 0, empty: true, ranking: ranking.slice(0, 5) };
  }
  return {
    key: ranking[0].key,
    score: ranking[0].score,
    margin: ranking[0].score - (ranking[1]?.score ?? -1),
    empty: false,
    ranking: ranking.slice(0, 5),
  };
}

/**
 * Confianza a partir del parecido y de la diferencia con el segundo candidato.
 * Umbrales calibrados con capturas reales (test/fixtures/captures).
 */
export function matchConfidence({ score, margin, empty }) {
  if (empty) return null;
  if (score >= 0.8 && margin >= 0.08) return 'high';
  if (score >= 0.65 && margin >= 0.03) return 'medium';
  return 'low';
}

/**
 * Variantes de recorte (corridas y escaladas) alrededor de la caja, para tolerar
 * imprecisión. La primera es la centrada sin escalar (ver bestMatch).
 */
export function searchWindows({ x, y, size }, { shift = 3 } = {}) {
  const windows = [{ sx: x - size / 2, sy: y - size / 2, side: size }];
  for (const scale of [0.85, 0.92, 1, 1.08, 1.16]) {
    const side = size * scale;
    for (let dy = -shift; dy <= shift; dy += 1) {
      for (let dx = -shift; dx <= shift; dx += 1) {
        if (scale === 1 && dx === 0 && dy === 0) continue;
        windows.push({ sx: x - side / 2 + dx * 0.05 * size, sy: y - side / 2 + dy * 0.05 * size, side });
      }
    }
  }
  return windows;
}
