// Forma común de una tarjeta del Coach (la que consumen Estadísticas y el Dashboard).
import { tr } from '../../i18n/uiI18n.js';
import { confidenceOf } from './stats.js';

/** Familias de insights: una tarjeta por familia en la selección final. */
export const FAMILY = Object.freeze({
  LAST_MATCH: 'lastMatch',
  FOLLOW_UP: 'followUp',
  DEATHS: 'deaths',
  BUILD: 'build',
  MATCHUP: 'matchup',
  CURVE: 'curve',
  POOL: 'pool',
  SESSION: 'session',
  TREND: 'trend',
  TEAMPLAY: 'teamplay',
  RUNES: 'runes',
  // Tus builds guardadas comparadas entre sí (partidas vinculadas con matches.build_id).
  SAVED_BUILD: 'savedBuild',
  // Preparación: no dependen de un problema detectado, completan el informe.
  PREP: 'prep',
  PLAN: 'plan',
  STRENGTH: 'strength',
});

export function confidenceLabel(value) {
  if (value >= 0.72) return tr('home.confianzaAlta');
  if (value >= 0.45) return tr('home.confianzaMedia');
  return tr('insights.senalInicial');
}

/**
 * @param {{
 *   key: string, family: string, tone?: 'positive'|'warning'|'critical'|'opportunity'|'neutral',
 *   title: string, thesis: string, action: string, evidence?: (string|false|null|undefined)[],
 *   z?: number, sample?: number, corroborated?: boolean, confidence?: number,
 *   priority: number, impact?: number, entities?: string[],
 *   track?: Record<string, any> | null, goal?: Record<string, any> | null,
 * }} input
 */
export function makeInsight({
  key, family, tone = 'neutral', title, thesis, action, evidence = [], z = 0, sample = 0,
  corroborated = false, confidence, priority, impact = 0, entities = [], track = null, goal = null,
}) {
  const certainty = confidence ?? confidenceOf({ z, games: sample, corroborated });
  return {
    id: key,
    family,
    domain: tr(`coachEngine.family.${family}`),
    tone,
    title,
    thesis,
    action,
    evidence: evidence.filter(Boolean).slice(0, 3),
    confidence: certainty,
    confidenceLabel: confidenceLabel(certainty),
    sampleSize: sample,
    // Prioridad editorial + confianza + impacto (partidas afectadas por el patrón).
    score: priority + certainty * 25 + Math.min(impact, 20),
    entities: entities.filter(Boolean),
    track,
    goal,
    isNew: false,
    followUp: null,
  };
}
