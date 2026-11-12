// Disposición del marcador de fin de partida de Wild Rift, sin IA.
// La interfaz escala con el ALTO de la pantalla y está centrada en el ancho: todas las
// posiciones se expresan en altos de pantalla (H), en x desde el centro y en y desde el
// centro de la fila. Las filas están ordenadas por línea (top, jungla, mid, ADC,
// soporte): los íconos de línea del medio del marcador lo indican.
// La fila del jugador se reconoce por la barra dorada a su izquierda.
// Medidas tomadas de capturas reales (test/fixtures/captures). Módulo puro (RGBA).

export const ROW_LANES = ['top', 'jungler', 'mid', 'adc', 'support'];

export const LAYOUT = {
  barX: -0.948,          // barra dorada de la fila resaltada (x desde el centro)
  firstRowY: 0.238,      // centro de la primera fila
  rowPitch: 0.1333,      // distancia entre filas
  rowHeight: 0.12,
  portrait: { allyX: -0.785, enemyX: 0.137, dy: -0.004, size: 0.085 },
  spells: [{ dx: -0.5066, dy: -0.023 }, { dx: -0.5066, dy: 0.026 }],
  spellSize: 0.035,
  items: { dx: -0.457, step: 0.0423, dy: 0.026, size: 0.0377, count: 6 },
};

const isGold = (r, g, b) => r > 170 && g > 120 && b < 110 && r - b > 90;

/**
 * Busca la barra dorada de la fila resaltada: la racha vertical de píxeles dorados más
 * larga en el 35% izquierdo de la imagen, cerca de la x esperada.
 * @param {{ width: number, height: number, data: Uint8ClampedArray }} image
 * @returns {{ x: number, top: number, length: number } | null}
 */
export function findHighlightBar({ width, height, data }) {
  const expectedX = width / 2 + LAYOUT.barX * height;
  const fromX = Math.max(0, Math.floor(expectedX - 0.08 * height));
  const toX = Math.min(width - 1, Math.ceil(expectedX + 0.08 * height));
  let best = null;
  for (let x = fromX; x <= toX; x += 1) {
    let run = 0;
    let start = 0;
    for (let y = 0; y < height; y += 1) {
      const index = (y * width + x) * 4;
      if (isGold(data[index], data[index + 1], data[index + 2])) {
        if (!run) start = y;
        run += 1;
        if (!best || run > best.length) best = { x, top: start, length: run };
      } else {
        run = 0;
      }
    }
  }
  // La barra mide casi el alto de una fila; algo mucho más corto no es la barra.
  if (!best || best.length < LAYOUT.rowHeight * height * 0.6 || best.length > LAYOUT.rowHeight * height * 1.4) return null;
  return best;
}

/**
 * Posiciones (cuadrados en píxeles: centro y lado) de los íconos del marcador.
 * @param {number} width
 * @param {number} height
 * @param {{ top: number, length: number }} bar
 */
export function scoreboardSlots(width, height, bar) {
  const cx = width / 2;
  const at = (dx, dy, size, rowY) => ({ x: cx + dx * height, y: rowY + dy * height, size: size * height });
  const rowCenter = row => (LAYOUT.firstRowY + row * LAYOUT.rowPitch) * height;
  const barCenter = bar.top + bar.length / 2;
  const ownRow = Math.max(0, Math.min(4, Math.round((barCenter / height - LAYOUT.firstRowY) / LAYOUT.rowPitch)));
  const ownY = barCenter;
  const { portrait, items } = LAYOUT;

  return {
    ownRow,
    ownLane: ROW_LANES[ownRow],
    allies: ROW_LANES.map((lane, row) => ({ lane, row, ...at(portrait.allyX, portrait.dy, portrait.size, row === ownRow ? ownY : rowCenter(row)) })),
    enemies: ROW_LANES.map((lane, row) => ({ lane, row, ...at(portrait.enemyX, portrait.dy, portrait.size, rowCenter(row)) })),
    spells: LAYOUT.spells.map(spell => at(spell.dx, spell.dy, LAYOUT.spellSize, ownY)),
    items: Array.from({ length: items.count }, (_, index) => at(items.dx + index * items.step, items.dy, items.size, ownY)),
  };
}

// Pestaña "Estadísticas › Runa": columna central con las 5 runas grandes del jugador
// (la clave arriba). Mismo criterio: x desde el centro y todo en altos de pantalla.
export const RUNES_LAYOUT = { x: -0.349, firstY: 0.204, pitch: 0.138, size: 0.105, count: 5 };

/** Posiciones de las 5 runas de la columna central (cuadrados en píxeles). */
export function runeSlots(width, height) {
  const { x, firstY, pitch, size, count } = RUNES_LAYOUT;
  return Array.from({ length: count }, (_, index) => ({
    x: width / 2 + x * height,
    y: (firstY + index * pitch) * height,
    size: size * height,
  }));
}
