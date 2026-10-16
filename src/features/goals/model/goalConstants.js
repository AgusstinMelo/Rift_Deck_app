// Constantes y tipos del módulo de objetivos personales.

/** Ciclo de vida persistido en la base. */
export const LIFECYCLE = Object.freeze({
  ACTIVE: 'activo',
  CANCELLED: 'cancelado',
  ARCHIVED: 'archivado',
});

/** Resultado derivado: nunca se persiste. */
export const OUTCOME = Object.freeze({
  SCHEDULED: 'programado',
  IN_PROGRESS: 'en_curso',
  ACHIEVED: 'alcanzado',
  NOT_ACHIEVED: 'no_alcanzado',
  INCONCLUSIVE: 'no_concluyente',
});

export const METRIC_KIND = Object.freeze({
  CUMULATIVE: 'acumulativa',
  PERFORMANCE: 'rendimiento',
});

export const OPERATOR = Object.freeze({
  GTE: 'gte',
  LTE: 'lte',
});

/** Familia de una métrica: agrupa la elección de objetivos en la UI. */
export const METRIC_FAMILY = Object.freeze({
  CUMULATIVE: 'acumulativos',
  AVERAGE: 'promedios',
  PERCENTAGE: 'porcentajes',
  RECORD: 'mejor_partida',
  MANUAL: 'manual',
});

/** Tipo de cálculo de una métrica: cómo se combinan los valores de cada partida. */
export const AGGREGATION = Object.freeze({
  TOTAL: 'total',
  AVERAGE: 'promedio',
  BEST: 'mejor_partida',
  PERCENTAGE: 'porcentaje',
});

export const PERIOD_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  OPEN: 'open',
  CLOSED: 'closed',
});

/** Motivos por los que una partida (o check-in) no cuenta para un objetivo. */
export const EXCLUSION_REASON = Object.freeze({
  NO_DATE: 'sin_fecha',
  FILTER_MISMATCH: 'no_cumple_filtro',
  MISSING_FILTER_DATA: 'dato_de_filtro_faltante',
  MISSING_RESULT: 'sin_resultado',
  MISSING_DEATHS: 'sin_muertes',
  MISSING_CHAMPION: 'sin_campeon',
  MISSING_KDA: 'sin_kda',
  MISSING_KILLS: 'sin_asesinatos',
  MISSING_ASSISTS: 'sin_asistencias',
  MISSING_GOLD: 'sin_oro',
  MISSING_DURATION: 'sin_duracion',
});

export const LANES = Object.freeze(['top', 'jungler', 'mid', 'adc', 'support']);

/** Límites generales de la configuración. */
export const GOAL_LIMITS = Object.freeze({
  NAME_MAX: 80,
  DESCRIPTION_MAX: 500,
  UNIT_MAX: 40,
  NOTE_MAX: 500,
  MAX_PERIOD_DAYS: 366,
  MIN_SAMPLE_MAX: 500,
  MAX_CHAMPIONS: 20,
  CHECKIN_MAX: 100000,
});

/**
 * @typedef {Object} GoalDefinition
 * @property {string} [id]
 * @property {string} name
 * @property {string|null} [description]
 * @property {string} metric
 * @property {string} [operator]    OPERATOR; si falta se usa el de la métrica.
 * @property {number} target
 * @property {number|null} min_sample
 * @property {string|null} [unit]
 * @property {Record<string, any>} filters
 * @property {string} period_start  ISO timestamptz
 * @property {string} period_end    ISO timestamptz
 * @property {string} timezone      IANA
 * @property {string} lifecycle
 */

/**
 * @typedef {Object} Exclusion
 * @property {string} id
 * @property {string} reason
 * @property {string} [field]
 */

/**
 * @typedef {Object} Contribution
 * @property {string} id
 * @property {string} date   YYYY-MM-DD
 * @property {number} value
 */

/**
 * @typedef {Object} GoalEvaluation
 * @property {string} outcome
 * @property {boolean} provisional
 * @property {boolean|null} meetsToday   Solo en rendimiento con período abierto.
 * @property {number|null} value
 * @property {number} target
 * @property {number|null} difference   value - target
 * @property {number} sampleSize
 * @property {number|null} minSample
 * @property {string[]} includedIds
 * @property {Exclusion[]} excluded
 * @property {Record<string, number>} exclusionCounts
 * @property {Contribution[]} contributions
 * @property {number} outOfPeriodCount
 * @property {string} periodStatus
 * @property {{ startDate: string, endDate: string }} period
 * @property {string} kind
 * @property {string} operator
 */
