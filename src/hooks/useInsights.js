// Punto de entrada del Rift Deck Coach para las páginas. El motor vive en
// src/features/coach (engine.js); acá solo se adapta la forma de entrada que usan
// Estadísticas y el Dashboard.
import { computeCoachReport } from '../features/coach/engine.js';

/**
 * @param {{
 *   matches?: any[], wrItems?: any[], champions?: any[], runes?: any[], builds?: any[], tierlist?: any[],
 *   history?: { insight_key: string, track: any, first_seen_at: string }[],
 *   championNotes?: (champion: any) => string, limit?: number, now?: Date,
 * }} input
 */
export function computeInsightReport({
  matches = [], wrItems = [], champions = [], runes = [], builds = [], tierlist = [], history = [], championNotes = null, limit = 8, now,
} = {}) {
  return computeCoachReport({ matches, champions, items: wrItems, runes, builds, tierlist, history, championNotes, limit, now });
}

export function computeInsights(input) {
  return computeInsightReport(input).insights;
}
