// Registro de filtros de objetivos. Cada filtro declara su esquema de valor,
// cómo se evalúa sobre una partida y su etiqueta. Agregar un filtro nuevo
// consiste en registrar su definición aquí y habilitarlo en las métricas.
import { z } from 'zod';
import { MATCH_TYPES } from '../../../constants/matchTypes.js';
import { patchMatchesSelection } from '../../../utils/patches.js';
import { GOAL_LIMITS, LANES } from '../model/goalConstants.js';
import { championMatchesAny, championOf, laneOf, matchTypeOf, patchOf } from '../engine/matchFacts.js';

/** Resultado de evaluar un filtro sobre una partida. */
export const FILTER_RESULT = Object.freeze({
  MATCH: 'match',
  MISMATCH: 'mismatch',
  MISSING: 'missing',
});

const championSchema = z.object({
  id: z.string().trim().max(100).nullable().optional(),
  name: z.string().trim().min(1).max(80),
}).strict();

/**
 * @typedef {Object} FilterDefinition
 * @property {string} key
 * @property {string} label
 * @property {import('zod').ZodTypeAny} schema
 * @property {(match: any, value: any) => string} evaluate
 */

/** @type {Record<string, FilterDefinition>} */
const FILTERS = {
  types: {
    key: 'types',
    label: 'Tipo de partida',
    schema: z.array(z.enum(/** @type {[string, ...string[]]} */ (MATCH_TYPES.map(type => type.value))))
      .min(1, 'Elegí al menos un tipo de partida.'),
    evaluate: (match, value) =>
      value.includes(matchTypeOf(match)) ? FILTER_RESULT.MATCH : FILTER_RESULT.MISMATCH,
  },
  lanes: {
    key: 'lanes',
    label: 'Línea',
    schema: z.array(z.enum(/** @type {[string, ...string[]]} */ ([...LANES])))
      .min(1, 'Elegí al menos una línea.'),
    evaluate: (match, value) => {
      const lane = laneOf(match);
      if (!lane) return FILTER_RESULT.MISSING;
      return value.includes(lane) ? FILTER_RESULT.MATCH : FILTER_RESULT.MISMATCH;
    },
  },
  champions: {
    key: 'champions',
    label: 'Campeones',
    schema: z.array(championSchema)
      .min(1, 'Elegí al menos un campeón.')
      .max(GOAL_LIMITS.MAX_CHAMPIONS, `Podés elegir hasta ${GOAL_LIMITS.MAX_CHAMPIONS} campeones.`),
    evaluate: (match, value) => {
      const champion = championOf(match);
      if (!champion) return FILTER_RESULT.MISSING;
      return championMatchesAny(champion, value) ? FILTER_RESULT.MATCH : FILTER_RESULT.MISMATCH;
    },
  },
  patches: {
    key: 'patches',
    label: 'Parche',
    schema: z.array(z.string().trim().min(1).max(20)).min(1, 'Elegí al menos un parche.'),
    evaluate: (match, value) => {
      const patch = patchOf(match);
      if (!patch) return FILTER_RESULT.MISSING;
      return value.some(selection => patchMatchesSelection(patch, selection))
        ? FILTER_RESULT.MATCH
        : FILTER_RESULT.MISMATCH;
    },
  },
};

export function getFilter(key) {
  const filter = FILTERS[key];
  if (!filter) throw new Error(`Filtro desconocido: ${key}`);
  return filter;
}

export function listFilterKeys() {
  return Object.keys(FILTERS);
}

/** Esquema zod estricto para los filtros admitidos por una métrica. */
export function filtersSchemaFor(allowedKeys, requiredKeys = []) {
  const shape = Object.fromEntries(allowedKeys.map(key => {
    const schema = getFilter(key).schema;
    return [key, requiredKeys.includes(key) ? schema : schema.optional()];
  }));
  return z.object(shape).strict();
}

/** Quita filtros vacíos (listas sin elementos) para no persistir ruido. */
export function compactFilters(filters = {}) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => Array.isArray(value) ? value.length > 0 : value != null),
  );
}
