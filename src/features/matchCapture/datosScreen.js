// Pestaña "Estadísticas › Comparación de estadísticas" (DATOS, vista General), sin IA.
// Por jugador, de izquierda a derecha: daño infligido (y % del equipo), daño recibido,
// curación y escudos (y %), participación en peleas (%) y oro (y %). Filas por línea:
// top, jungla, mid, ADC, soporte; aliados a la izquierda y enemigos a la derecha.
// Igual que el marcador, la interfaz escala con el alto y está centrada en el ancho:
// posiciones en altos de pantalla, x desde el centro. Medido con capturas reales
// (test/fixtures/captures/*-datos.jpg). Módulo puro (RGBA): lo usan el navegador y Node.
import { DATOS_TEMPLATES } from './scoreboardGlyphs.js';
import { MIN_SURE_HEIGHT, SURE_MARGIN, readWords } from './scoreboardText.js';
import { ROW_LANES } from './scoreboardLayout.js';

export const DATOS_LAYOUT = {
  firstRowY: 0.2529, // línea de números de la primera fila
  rowPitch: 0.1256,
  textHeight: 0.021,
  enemyShift: 0.956, // los enemigos son los aliados corridos a la derecha
  cells: {
    damage: { x0: -0.8, x1: -0.665, percent: true },
    taken: { x0: -0.645, x1: -0.5, percent: false },
    healing: { x0: -0.49, x1: -0.36, percent: true },
    participation: { x0: -0.335, x1: -0.26, percentOnly: true },
    gold: { x0: -0.178, x1: -0.035, percent: true },
  },
};

const NUMBER = /^\d{1,6}$/;
const PERCENT = /^(\d{1,3})%$/;

/** "22306" + "23%" → { value: 22306, percent: 23 }; con forma rara, null. */
export function parseCell(words, { percent = false, percentOnly = false } = {}) {
  const texts = words.map(word => word.text);
  if (percentOnly) {
    const match = texts.length === 1 && PERCENT.exec(texts[0]);
    return match && Number(match[1]) <= 100 ? { value: Number(match[1]) } : null;
  }
  if (percent) {
    const match = texts.length === 2 && NUMBER.test(texts[0]) && PERCENT.exec(texts[1]);
    return match && Number(match[1]) <= 100 ? { value: Number(texts[0]), percent: Number(match[1]) } : null;
  }
  return texts.length === 1 && NUMBER.test(texts[0]) ? { value: Number(texts[0]) } : null;
}

/** Rectángulo de una celda (en píxeles). */
function cellRect(width, height, rowY, cell, shift) {
  return {
    x: width / 2 + (cell.x0 + shift) * height,
    y: rowY - (DATOS_LAYOUT.textHeight / 2) * height,
    w: (cell.x1 - cell.x0) * height,
    h: DATOS_LAYOUT.textHeight * height,
  };
}

/** Lee las celdas de las 10 filas: { team, lane, cells: { damage: { value, percent, margin } ... } }. */
export function readDatosCells(image) {
  const { width, height } = image;
  return ['ally', 'enemy'].flatMap(team => ROW_LANES.map((lane, row) => {
    const rowY = (DATOS_LAYOUT.firstRowY + row * DATOS_LAYOUT.rowPitch) * height;
    const shift = team === 'enemy' ? DATOS_LAYOUT.enemyShift : 0;
    const cells = Object.fromEntries(Object.entries(DATOS_LAYOUT.cells).map(([key, cell]) => {
      const words = readWords(image, cellRect(width, height, rowY, cell, shift), DATOS_TEMPLATES);
      const parsed = parseCell(words, cell);
      const margin = words.length ? Math.min(...words.map(word => word.minMargin)) : 0;
      return [key, parsed ? { ...parsed, margin } : null];
    }));
    return { team, lane, row, cells };
  }));
}

/**
 * Control con los porcentajes, por equipo y columna (daño, curación, oro): el % de cada
 * fila tiene que coincidir con su número sobre el total del equipo (±1,5 por redondeo).
 * Devuelve, por fila y columna, si cierra (true), no cierra (false) o no se puede saber.
 */
export function checkPercents(rows) {
  const checks = new Map();
  for (const team of ['ally', 'enemy']) {
    const teamRows = rows.filter(row => row.team === team);
    for (const key of ['damage', 'healing', 'gold']) {
      const cells = teamRows.map(row => row.cells[key]);
      if (cells.some(cell => !cell)) continue;
      const total = cells.reduce((sum, cell) => sum + cell.value, 0);
      teamRows.forEach((row, index) => {
        const cell = cells[index];
        const expected = total ? (cell.value / total) * 100 : 0;
        checks.set(`${team}:${row.row}:${key}`, Math.abs(expected - cell.percent) <= 1.5);
      });
    }
  }
  return checks;
}

/** Proporción mínima de celdas leídas para dar por buena la pestaña DATOS. */
const MIN_READ_SHARE = 0.7;

/**
 * Pestaña DATOS de una captura: por jugador, daño infligido, daño recibido, curación y
 * escudos, participación (%) y oro, con su confianza. null si la captura no es esta
 * pestaña (se lee menos del 70% de las celdas).
 * @param {{ width: number, height: number, data: Uint8ClampedArray }} image
 */
export function readDatosScreen(image) {
  const rows = readDatosCells(image);
  const all = rows.flatMap(row => Object.values(row.cells));
  if (all.filter(Boolean).length / all.length < MIN_READ_SHARE) return null;
  const checks = checkPercents(rows);
  const lowRes = image.height < MIN_SURE_HEIGHT;
  const confidenceOf = (row, key) => {
    const cell = row.cells[key];
    if (!cell) return null;
    const check = checks.get(`${row.team}:${row.row}:${key}`);
    if (check === false || lowRes) return 'medium';
    if (check === true) return 'high';
    return cell.margin >= SURE_MARGIN ? 'high' : 'medium';
  };
  const players = rows.map(row => {
    const field = key => (row.cells[key] ? { value: row.cells[key].value, confidence: confidenceOf(row, key) } : null);
    return {
      team: row.team,
      lane: row.lane,
      damage_dealt: field('damage'),
      damage_taken: field('taken'),
      healing_shielding: field('healing'),
      teamfight_participation: field('participation'),
      gold: field('gold'),
    };
  });
  const checked = [...checks.values()];
  return { players, checkedShare: checked.length ? checked.filter(Boolean).length / checked.length : 0 };
}
