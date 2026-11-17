// Identifica, sin IA, lo que en las capturas es solo imagen: los 10 campeones, los
// hechizos y objetos del jugador (marcador) y sus runas (pestaña Runa). Las posiciones
// salen de la disposición fija de la pantalla (scoreboardLayout.js) y cada recorte se
// compara por píxeles contra los íconos del catálogo (iconMatcher.js).
import { bestMatch, buildMask, matchConfidence, searchWindows, SHAPES, toFeature } from './iconMatcher.js';
import { catalogSignature } from './referenceCodes.js';
import { findHighlightBar, runeSlots, scoreboardSlots, sideRuneSlots } from './scoreboardLayout.js';
import { readScoreboardText } from './scoreboardText.js';
import { readDatosScreen } from './datosScreen.js';

const candidateCache = new Map();

function loadImage(src) {
  return new Promise(resolve => {
    if (!src) {
      resolve(null);
      return;
    }
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/** Lee píxeles de una zona de la imagen ya reducida a la grilla de la forma. */
function createSampler(shape) {
  const { size } = SHAPES[shape];
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.imageSmoothingQuality = 'high';
  return (source, sx, sy, sw, sh) => {
    context.clearRect(0, 0, size, size);
    context.drawImage(source, sx, sy, sw, sh, 0, 0, size, size);
    return context.getImageData(0, 0, size, size).data;
  };
}

async function featuresFor(entries, shape) {
  const mask = buildMask(shape);
  const sample = createSampler(shape);
  const icons = await Promise.all(entries.map(entry => loadImage(entry.image_url)));
  return entries
    .map((entry, index) => {
      const icon = icons[index];
      if (!icon) return null;
      return { key: entry.name, vector: toFeature(sample(icon, 0, 0, icon.naturalWidth, icon.naturalHeight), mask).vector };
    })
    .filter(Boolean);
}

/**
 * Características de los íconos del catálogo (en caché por catálogo).
 * @param {{ items: any[], runes: any[], spells: any[] }} catalog
 */
export async function loadIconCandidates(catalog) {
  const key = catalogSignature(catalog);
  if (candidateCache.has(key)) return candidateCache.get(key);
  const runes = catalog.runes || [];
  const [champions, items, keystones, minorRunes, spells] = await Promise.all([
    featuresFor(catalog.champions || [], 'circle'),
    featuresFor(catalog.items || [], 'square'),
    featuresFor(runes.filter(rune => rune.branch === 'Clave'), 'circle'),
    featuresFor(runes.filter(rune => rune.branch !== 'Clave'), 'circle'),
    featuresFor(catalog.spells || [], 'circle'),
  ]);
  const candidates = { champions, items, keystones, minorRunes, spells };
  candidateCache.set(key, candidates);
  return candidates;
}

/** Compara cuadrados ya calculados (en píxeles) contra una lista de candidatos. */
function matchSquares(source, squares, candidates, shape, { shift } = {}) {
  const mask = buildMask(shape);
  const sample = createSampler(shape);
  return squares.map(square => {
    const windows = searchWindows(square, shift === undefined ? undefined : { shift }).map(({ sx, sy, side }) => toFeature(sample(source, sx, sy, side, side), mask));
    const match = bestMatch(windows, candidates);
    return { name: match.key, confidence: matchConfidence(match), score: match.score, empty: match.empty, ranking: match.ranking };
  });
}

function imageDataOf(source) {
  const width = source.naturalWidth || source.width;
  const height = source.naturalHeight || source.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(source, 0, 0);
  const data = context.getImageData(0, 0, width, height);
  canvas.width = 0;
  canvas.height = 0;
  return data;
}

/**
 * Marcador de fin de partida sin IA: busca la barra dorada de la fila del jugador,
 * calcula dónde está cada retrato, hechizo y objeto (scoreboardLayout.js) y los
 * identifica comparando píxeles. Devuelve null si no encuentra el marcador.
 */
export function identifyScoreboard(source, candidates) {
  const image = imageDataOf(source);
  const bar = findHighlightBar(image);
  if (!bar) return null;
  const slots = scoreboardSlots(image.width, image.height, bar);
  // Los 10 campeones de una partida no se repiten.
  const champions = assignUnique(matchSquares(source, [...slots.allies, ...slots.enemies], candidates.champions, 'circle'));
  const allies = champions.slice(0, 5).map((match, row) => ({ ...match, lane: slots.allies[row].lane }));
  const enemies = champions.slice(5).map((match, row) => ({ ...match, lane: slots.enemies[row].lane }));
  // K/D/A, oro y resultado leídos en el celular (sin IA).
  const text = readScoreboardText(image, bar.top + bar.length / 2);
  const spells = matchSquares(source, slots.spells, candidates.spells, 'circle');
  const items = matchSquares(source, slots.items, candidates.items, 'square');
  // Los 10 jugadores para el Coach: campeón, línea, K/D/A, oro, hechizos y objetos. La
  // fila propia reutiliza su lectura completa; las demás usan una búsqueda más acotada
  // (las posiciones están medidas) para que la identificación siga siendo rápida.
  const players = slots.rows.map((row, index) => {
    const champion = champions[index];
    const read = text.players?.find(entry => entry.team === row.team && entry.row === row.row) || null;
    return {
      team: row.team,
      lane: row.lane,
      own: row.own,
      champion: champion?.empty ? null : champion?.name || null,
      championConfidence: champion?.confidence || 'low',
      kills: read?.kills ?? null,
      deaths: read?.deaths ?? null,
      assists: read?.assists ?? null,
      gold: read?.gold ?? null,
      statsConfidence: read?.confidence || 'low',
      spells: row.own ? spells : matchSquares(source, row.spells, candidates.spells, 'circle', { shift: 1 }),
      items: row.own ? items : matchSquares(source, row.items, candidates.items, 'square', { shift: 1 }),
    };
  });
  return {
    text,
    players,
    ownLane: slots.ownLane,
    own: allies[slots.ownRow],
    allies: allies.filter((_, row) => row !== slots.ownRow),
    enemies,
    spells,
    items,
  };
}

/** Parecido promedio mínimo para dar por buena la columna de runas de una captura. */
const RUNES_SCREEN_MIN_SCORE = 0.72;

/**
 * Pestaña de runas sin IA: compara las 5 posiciones de la columna central (la primera,
 * contra las runas clave). Si el parecido promedio es bajo, la captura no es esa
 * pestaña y devuelve null.
 */
export function identifyRunesScreen(source, candidates) {
  const width = source.naturalWidth || source.width;
  const height = source.naturalHeight || source.height;
  const slots = runeSlots(width, height);
  const keystone = matchSquares(source, slots.slice(0, 1), candidates.keystones, 'circle');
  const minor = matchSquares(source, slots.slice(1), candidates.minorRunes, 'circle');
  const runes = assignUnique([...keystone, ...minor]);
  const average = runes.reduce((sum, rune) => sum + (rune.empty ? 0 : rune.score), 0) / runes.length;
  if (average < RUNES_SCREEN_MIN_SCORE) return null;
  return { runes: runes.filter(rune => !rune.empty && rune.name), score: average, source };
}

/**
 * Runas de los 10 jugadores (costados de la pestaña Runa): por jugador, la clave contra
 * las runas clave y el resto contra las secundarias, sin repetir dentro de su página.
 */
export function identifySideRunes(source, candidates) {
  const width = source.naturalWidth || source.width;
  const height = source.naturalHeight || source.height;
  return sideRuneSlots(width, height).map(({ team, lane, slots }) => {
    const keystone = matchSquares(source, slots.slice(0, 1), candidates.keystones, 'circle', { shift: 1 });
    const minor = matchSquares(source, slots.slice(1), candidates.minorRunes, 'circle', { shift: 1 });
    const runes = assignUnique([...keystone, ...minor]).filter(rune => !rune.empty && rune.name);
    return { team, lane, runes: runes.map(rune => ({ name: rune.name, confidence: rune.confidence })) };
  });
}

/**
 * Pestaña de runas en las capturas (la de mejor parecido): tus runas (columna central)
 * y las de los 10 jugadores (costados). null si no está.
 */
export async function identifyRunesTab(images, candidates) {
  const sources = await Promise.all(images.map(image => loadImage(image.previewUrl)));
  let best = null;
  for (const source of sources) {
    if (!source) continue;
    const result = identifyRunesScreen(source, candidates);
    if (result && (!best || result.score > best.score)) best = result;
  }
  if (!best) return null;
  return { runes: best.runes, players: identifySideRunes(best.source, candidates) };
}

/** Busca la pestaña de runas en las capturas y devuelve tus runas (o null). */
export async function identifyRunesIn(images, candidates) {
  return (await identifyRunesTab(images, candidates))?.runes || null;
}

/**
 * Busca el marcador en las capturas y devuelve la mejor lectura local (o null).
 * @param {Array<{ previewUrl: string }>} images
 */
export async function identifyScoreboardIn(images, candidates) {
  const sources = await Promise.all(images.map(image => loadImage(image.previewUrl)));
  let best = null;
  for (const [imageIndex, source] of sources.entries()) {
    if (!source) continue;
    const result = identifyScoreboard(source, candidates);
    if (!result) continue;
    const score = [result.own, ...result.allies, ...result.enemies].reduce((sum, entry) => sum + (entry?.score || 0), 0);
    if (!best || score > best.score) best = { score, result: { ...result, imageIndex } };
  }
  return best?.result || null;
}

/**
 * Pestaña DATOS (Comparación de estadísticas, vista General) en las capturas: daño,
 * daño recibido, curación y escudos, participación y oro de los 10 jugadores, leídos en
 * el celular sin IA (datosScreen.js). Devuelve la mejor lectura y el índice de la
 * captura, o null si ninguna es esa pestaña.
 * @param {Array<{ previewUrl: string }>} images
 */
export async function identifyDatosIn(images) {
  const sources = await Promise.all(images.map(image => loadImage(image.previewUrl)));
  let best = null;
  for (const [imageIndex, source] of sources.entries()) {
    if (!source) continue;
    const result = readDatosScreen(imageDataOf(source));
    if (result && (!best || result.checkedShare > best.checkedShare)) best = { ...result, imageIndex };
  }
  return best;
}

const normalizeName = value => String(value || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();

/**
 * Asigna runas sin repetir: toma los pares (caja, runa) de mayor parecido primero.
 * Las runas de una página no se repiten, así que si dos cajas apuntan a la misma, la de
 * menor parecido pasa a su siguiente candidata.
 */
export function assignUnique(results) {
  const pairs = [];
  results.forEach((result, box) => {
    (result.ranking || []).forEach(option => pairs.push({ box, key: option.key, score: option.score }));
  });
  pairs.sort((a, b) => b.score - a.score);
  const usedBoxes = new Set();
  const usedKeys = new Set();
  const assigned = results.map(result => ({ ...result, name: null, empty: true }));
  for (const pair of pairs) {
    if (usedBoxes.has(pair.box) || usedKeys.has(pair.key) || results[pair.box].empty) continue;
    usedBoxes.add(pair.box);
    usedKeys.add(pair.key);
    const ranking = results[pair.box].ranking;
    const next = ranking.find(option => option.key !== pair.key && !usedKeys.has(option.key));
    const margin = pair.score - (next?.score ?? -1);
    assigned[pair.box] = { ...results[pair.box], name: pair.key, score: pair.score, empty: false, confidence: matchConfidence({ score: pair.score, margin, empty: false }) };
  }
  return assigned;
}

/**
 * Runas a partir de los nombres que el modelo leyó como texto en la pestaña Runa
 * ("CADENCIA LETAL"...). Usa la captura con más nombres reconocidos; devuelve null si
 * no se reconoció ninguno o si alguno no está en el catálogo (en ese caso conviene la
 * comparación de píxeles).
 * @param {Array<{ imageIndex: number, names: string[] }>} runeNames
 */
export function runesFromModelNames(runeNames, candidates) {
  const byName = new Map([...candidates.keystones, ...candidates.minorRunes].map(rune => [normalizeName(rune.key), rune.key]));
  let best = null;
  for (const { names } of runeNames || []) {
    const resolved = names.map(name => byName.get(normalizeName(name)) || null);
    if (!resolved.length || resolved.some(name => !name)) continue;
    if (!best || resolved.length > best.length) best = resolved;
  }
  return best ? [...new Set(best)].map(name => ({ name, confidence: 'high' })) : null;
}
