// Carga de partidas con capturas: esquema de campos, validación de la respuesta del
// modelo y unificación de varias capturas en un solo registro.
// JS plano (sin dependencias ni APIs de Deno) para que lo usen la edge function
// `extract-match-capture` y los tests de Node (test/matchCapture).
//
// Campeones, objetos, runas y hechizos en la pantalla de resultados son solo íconos
// (no hay texto):
// - Campeones: el cliente manda una lámina de referencia con cada retrato numerado
//   (C12) y el modelo responde con el código.
// - Objetos, runas y hechizos del jugador (y los campeones, cuando se reconoce el
//   marcador): los identifica el cliente comparando píxeles en posiciones fijas
//   (src/features/matchCapture/scoreboardLayout.js, iconMatcher.js). Del modelo solo se
//   usan los nombres de runas que lee como texto en la pestaña Runa.
//
// Para agregar un campo: sumarlo a CAPTURE_FIELDS (kind + descripción para el modelo).
// El JSON Schema, el prompt, la validación y la unificación se derivan de esa lista.

export const CONFIDENCE_LEVELS = /** @type {const} */ (['high', 'medium', 'low']);
// En el esquema del modelo un dato faltante se marca con confidence "none" (sin nulls en
// el esquema: no todos los proveedores los aceptan). La validación lo pasa a null.
const MISSING = 'none';
const UNKNOWN = 'unknown';

/** Instrucción para el prompt: cómo marcar un dato que no se ve. */
export const MISSING_VALUE_HINT = 'Si un dato no se ve o no se puede identificar con seguridad: confidence = "none" y value = 0 (números), "" (códigos), "unknown" (opciones) o [] (listas). No inventes ni estimes.';

/** Mayor número = más confianza. */
const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1 };

// Alcanza con 2 por partida: el marcador y la pestaña Estadísticas › Runa.
export const MAX_CAPTURES = 2;
export const MAX_REFERENCE_SHEETS = 3;
export const LANES = ['top', 'jungler', 'mid', 'adc', 'support'];

/** Prefijo de código por tipo de ícono en las láminas de referencia. */
export const CODE_PREFIX = { champion: 'C', item: 'I', rune: 'R', spell: 'S' };

/**
 * @typedef {'code' | 'enum' | 'count' | 'amount' | 'codes' | 'team'} FieldKind
 * - code:   un código de lámina con prefijo `prefix` (el campeón propio).
 * - enum:   una de `options` ("unknown" = faltante).
 * - count:  entero 0..999 (kills, deaths, assists).
 * - amount: entero 0..10.000.000 (oro, segundos).
 * - codes:  lista de códigos con prefijo `prefix` (objetos, runas, hechizos), hasta `max`.
 * - team:   lista de { champion: código C, lane } (aliados / enemigos), hasta `max`.
 *
 * @typedef {{ key: string, kind: FieldKind, description: string, options?: string[], max?: number, prefix?: string }} CaptureField
 */

/** @type {CaptureField[]} */
export const CAPTURE_FIELDS = [
  { key: 'champion', kind: 'code', prefix: CODE_PREFIX.champion, description: 'Campeón del jugador propio (el resaltado): código C de la lámina de campeones que coincide con su retrato.' },
  { key: 'lane', kind: 'enum', options: LANES, description: 'Línea / rol del jugador propio (top = Barón, jungler = jungla, mid = medio, adc = Dragón/tirador, support = soporte). Deducilo del ícono de rol, del orden de la tabla o de la build si no se muestra.' },
  { key: 'result', kind: 'enum', options: ['win', 'loss'], description: 'Arriba al centro dice VICTORIA ("win") o DERROTA ("loss"), entre los puntajes de los equipos.' },
  { key: 'match_type', kind: 'enum', options: ['ranked', 'legendary_ranked', 'casual'], description: 'Modo, arriba a la izquierda: "CLASIFICATORIA" = "ranked"; "CLASIFICATORIA LEGENDARIA" = "legendary_ranked"; "PVP", "NORMAL", "ARAM" u otros = "casual".' },
  { key: 'kills', kind: 'count', description: 'Primer número del "K / D / A" de la fila resaltada (asesinatos).' },
  { key: 'deaths', kind: 'count', description: 'Segundo número del "K / D / A" de la fila resaltada (muertes).' },
  { key: 'assists', kind: 'count', description: 'Tercer número del "K / D / A" de la fila resaltada (asistencias).' },
  { key: 'duration_seconds', kind: 'amount', description: 'Duración en segundos: es el tiempo que aparece arriba a la izquierda junto a "Wild Rift·" (por ejemplo "Wild Rift·12:16" = 736; "18:32" = 1112).' },
  { key: 'gold', kind: 'amount', description: 'Oro de la fila resaltada: el número a la derecha del K/D/A, sin espacios ni puntos de miles (por ejemplo "10 674" = 10674; "9.5k" = 9500).' },
  { key: 'allies', kind: 'team', max: 4, description: 'Los OTROS 4 campeones del equipo del jugador propio (sin incluirlo a él): código C de cada retrato y su línea.' },
  { key: 'enemies', kind: 'team', max: 5, description: 'Los 5 campeones del equipo rival: código C de cada retrato y su línea.' },
];

const FIELD_KEYS = CAPTURE_FIELDS.map(field => field.key);

const KIND_LIMITS = {
  count: { min: 0, max: 999 },
  amount: { min: 0, max: 10_000_000 },
};

const LANE_OR_UNKNOWN = [...LANES, UNKNOWN];

function valueSchema(field) {
  switch (field.kind) {
    case 'code': return { type: 'string' };
    case 'enum': return { type: 'string', enum: [...field.options, UNKNOWN] };
    case 'count':
    case 'amount': return { type: 'integer' };
    case 'codes': return { type: 'array', items: { type: 'string' } };
    case 'team': return {
      type: 'array',
      items: {
        type: 'object',
        properties: { champion: { type: 'string' }, lane: { type: 'string', enum: LANE_OR_UNKNOWN } },
        required: ['champion', 'lane'],
        additionalProperties: false,
      },
    };
    default: throw new Error(`Tipo de campo desconocido: ${field.kind}`);
  }
}

/**
 * JSON Schema que se le pasa al modelo: una entrada por captura, cada campo con
 * { value, confidence }. Sin nulls, anyOf ni restricciones numéricas (no todos los
 * proveedores los admiten): un dato faltante va con confidence "none" y los rangos y
 * formatos de código se controlan en validateCaptureResponse.
 */
export function buildModelJsonSchema() {
  const fieldProperties = Object.fromEntries(CAPTURE_FIELDS.map(field => [field.key, {
    type: 'object',
    properties: {
      value: valueSchema(field),
      confidence: { type: 'string', enum: [...CONFIDENCE_LEVELS, MISSING] },
    },
    required: ['value', 'confidence'],
    additionalProperties: false,
  }]));

  return {
    type: 'object',
    properties: {
      captures: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            image_index: { type: 'integer' },
            screen: { type: 'string', enum: SCREENS },
            rune_names: { type: 'array', items: { type: 'string' } },
            fields: {
              type: 'object',
              properties: fieldProperties,
              required: FIELD_KEYS,
              additionalProperties: false,
            },
          },
          required: ['image_index', 'screen', 'rune_names', 'fields'],
          additionalProperties: false,
        },
      },
    },
    required: ['captures'],
    additionalProperties: false,
  };
}

// Pantallas reconocidas: marcador de fin de partida y pestaña Estadísticas › Runa.
export const SCREENS = ['scoreboard', 'runes', 'other'];

/** Máximo de nombres de runas por captura (la columna de la pestaña Runa tiene 5). */
export const MAX_RUNE_NAMES = 6;

/** Instrucciones de campos para el prompt (se arman desde CAPTURE_FIELDS). */
export function describeFieldsForPrompt() {
  return CAPTURE_FIELDS.map(field => `- ${field.key}: ${field.description}`).join('\n');
}

// ── Validación ──────────────────────────────────────────────────────────────

const isPlainObject = value => typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeCode = value => (typeof value === 'string' ? value.trim().toUpperCase() : value);
const isCode = (value, prefix) => typeof value === 'string' && new RegExp(`^${prefix}\\d{1,3}$`).test(normalizeCode(value));

function validateValue(field, value) {
  switch (field.kind) {
    case 'code':
      return isCode(value, field.prefix) ? null : `debe ser un código ${field.prefix}<número>`;
    case 'enum':
      return field.options.includes(value) ? null : `debe ser uno de: ${field.options.join(', ')}`;
    case 'count':
    case 'amount': {
      const { min, max } = KIND_LIMITS[field.kind];
      if (!Number.isInteger(value)) return 'debe ser un entero';
      return value < min || value > max ? `fuera de rango (${min}-${max})` : null;
    }
    case 'codes':
      if (!Array.isArray(value) || !value.every(code => isCode(code, field.prefix))) return `debe ser una lista de códigos ${field.prefix}<número>`;
      return value.length > field.max ? `tiene más de ${field.max} elementos` : null;
    case 'team':
      if (!Array.isArray(value)) return 'debe ser una lista';
      if (value.length > field.max) return `tiene más de ${field.max} elementos`;
      return value.every(member => isPlainObject(member) && isCode(member.champion, CODE_PREFIX.champion) && LANE_OR_UNKNOWN.includes(member.lane))
        ? null
        : 'cada elemento debe tener un código C y una línea válida';
    default:
      return 'tipo desconocido';
  }
}

function isMissing(field, entry) {
  if (entry.confidence === MISSING || entry.value === null) return true;
  if (field.kind === 'enum') return entry.value === UNKNOWN;
  if (field.kind === 'code') return typeof entry.value === 'string' && entry.value.trim() === '';
  if (field.kind === 'codes' || field.kind === 'team') return Array.isArray(entry.value) && entry.value.length === 0;
  return false;
}

function normalizeValue(field, value) {
  if (field.kind === 'code') return normalizeCode(value);
  if (field.kind === 'codes') return value.map(normalizeCode);
  if (field.kind === 'team') return value.map(member => ({ champion: normalizeCode(member.champion), lane: member.lane === UNKNOWN ? null : member.lane }));
  return value;
}

/**
 * Valida la respuesta del modelo contra el esquema (estructura, tipos y rangos), de
 * forma TOLERANTE: lo inválido se descarta y lo demás se conserva, para que un detalle
 * (una captura de más, un campo mal formado) no tire abajo toda la lectura.
 * - Capturas con image_index fuera de rango o repetido: se descartan.
 * - Campos ausentes o con valores inválidos: quedan como faltantes ({ value: null }).
 * - Pantalla desconocida: se trata como pantalla de resultados.
 * Solo falla si la respuesta no tiene la forma básica o no queda ninguna captura usable.
 * Normaliza: códigos en mayúsculas, faltantes a { value: null, confidence: null } y las
 * líneas "unknown" de los equipos a null.
 * @param {unknown} payload
 * @param {{ imageCount: number }} options
 * @returns {{ ok: true, warnings: string[], captures: Array<{ imageIndex: number, screen: string | null, isResultScreen: boolean, runeNames: string[], fields: Record<string, { value: any, confidence: string | null }> }> } | { ok: false, errors: string[] }}
 */
export function validateCaptureResponse(payload, { imageCount }) {
  if (!isPlainObject(payload) || !Array.isArray(payload.captures)) {
    return { ok: false, errors: ['La respuesta no tiene la lista "captures".'] };
  }

  const warnings = [];
  const seenIndexes = new Set();
  const captures = [];

  payload.captures.forEach((capture, position) => {
    const where = `captures[${position}]`;
    if (!isPlainObject(capture)) {
      warnings.push(`${where} no es un objeto: se descarta.`);
      return;
    }
    const imageIndex = capture.image_index;
    if (!Number.isInteger(imageIndex) || imageIndex < 0 || imageIndex >= imageCount || seenIndexes.has(imageIndex)) {
      warnings.push(`${where}.image_index inválido o repetido: se descarta.`);
      return;
    }
    seenIndexes.add(imageIndex);

    const screen = SCREENS.includes(capture.screen) ? capture.screen : null;
    if (!screen) warnings.push(`${where}.screen desconocida.`);
    const rawFields = isPlainObject(capture.fields) ? capture.fields : {};

    const fields = {};
    for (const field of CAPTURE_FIELDS) {
      const entry = rawFields[field.key];
      const missing = { value: null, confidence: null };
      if (!isPlainObject(entry) || !('value' in entry)) {
        warnings.push(`${where}.fields.${field.key} ausente.`);
        fields[field.key] = missing;
        continue;
      }
      const confidence = CONFIDENCE_LEVELS.includes(entry.confidence) ? entry.confidence : (entry.confidence === MISSING ? MISSING : 'low');
      if (isMissing(field, { ...entry, confidence })) {
        fields[field.key] = missing;
        continue;
      }
      const valueError = validateValue(field, entry.value);
      if (valueError) {
        warnings.push(`${where}.fields.${field.key}.value ${valueError}: se descarta.`);
        fields[field.key] = missing;
        continue;
      }
      fields[field.key] = { value: normalizeValue(field, entry.value), confidence };
    }

    captures.push({
      imageIndex,
      screen,
      isResultScreen: screen !== 'other',
      // Nombres de runas leídos como texto (pestaña Runa); los inválidos se descartan.
      runeNames: (Array.isArray(capture.rune_names) ? capture.rune_names : [])
        .filter(name => typeof name === 'string' && name.trim() && name.length <= 60)
        .map(name => name.trim())
        .slice(0, MAX_RUNE_NAMES),
      fields,
    });
  });

  if (!captures.length) return { ok: false, errors: ['Ninguna captura usable.', ...warnings] };
  return { ok: true, warnings, captures: captures.sort((a, b) => a.imageIndex - b.imageIndex) };
}

// ── Unificación ─────────────────────────────────────────────────────────────

const normalizeText = value =>
  String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();

/** Clave para comparar valores entre capturas (listas: sin importar el orden). */
function compareKey(field, value) {
  if (field.kind === 'codes') return [...value].sort().join('|');
  if (field.kind === 'team') return value.map(member => member.champion).sort().join('|');
  return typeof value === 'string' ? normalizeText(value) : value;
}

/**
 * @typedef {{
 *   value: any,
 *   confidence: 'high' | 'medium' | 'low' | null,
 *   needsReview: boolean,
 *   conflict: boolean,
 *   candidates: Array<{ value: any, confidence: string, imageIndex: number }>,
 * }} MergedField
 */

/**
 * Unifica varias capturas en un registro. Por campo:
 * - Se ignoran los valores faltantes.
 * - Gana el de mayor confianza (empate: la captura que vino primero).
 * - Si hay valores distintos entre capturas, se marca conflict y needsReview
 *   (las listas se comparan sin importar el orden).
 * - needsReview también si la confianza final es media/baja o si falta el valor.
 * @param {Array<{ imageIndex: number, isResultScreen?: boolean, fields: Record<string, { value: any, confidence: string | null }> }>} captures
 * @returns {{ fields: Record<string, MergedField>, ignoredImages: number[] }}
 */
export function mergeCaptures(captures) {
  // Las capturas que el modelo marcó como "no es pantalla de resultados" solo se usan
  // si ninguna lo es (mejor algo que nada; quedan para revisión por la confianza).
  const resultScreens = captures.filter(capture => capture.isResultScreen !== false);
  const usable = resultScreens.length ? resultScreens : captures;
  const ignoredImages = captures.filter(capture => !usable.includes(capture)).map(capture => capture.imageIndex);

  const fields = {};
  for (const field of CAPTURE_FIELDS) {
    const candidates = usable
      .map(capture => ({ ...capture.fields[field.key], imageIndex: capture.imageIndex }))
      .filter(candidate => candidate.value !== null && candidate.value !== undefined)
      .map(candidate => ({ value: candidate.value, confidence: candidate.confidence || 'low', imageIndex: candidate.imageIndex }));

    if (!candidates.length) {
      fields[field.key] = { value: null, confidence: null, needsReview: true, conflict: false, candidates: [] };
      continue;
    }

    const best = candidates.reduce((winner, candidate) =>
      CONFIDENCE_RANK[candidate.confidence] > CONFIDENCE_RANK[winner.confidence] ? candidate : winner);
    const conflict = new Set(candidates.map(candidate => compareKey(field, candidate.value))).size > 1;

    fields[field.key] = {
      value: best.value,
      confidence: best.confidence,
      needsReview: conflict || best.confidence !== 'high',
      conflict,
      candidates,
    };
  }

  // Nombres de runas leídos en cada captura (los usa el cliente; no se unifican).
  const runeNames = usable
    .filter(capture => capture.runeNames?.length)
    .map(capture => ({ imageIndex: capture.imageIndex, names: capture.runeNames }));
  return { fields, ignoredImages, runeNames };
}
