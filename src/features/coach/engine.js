// Rift Deck Coach: estudia las partidas del jugador cruzadas con el catálogo (campeones,
// objetos, runas) y devuelve consejos de juego priorizados. Funciones puras: sin React
// ni base de datos. El historial de consejos ya mostrados (coach_insight_log) permite
// marcar novedades y hacer seguimiento.
import { tr } from '../../i18n/uiI18n.js';
import { FAMILY, makeInsight } from './card.js';
import { buildCatalog } from './catalog.js';
import { buildHabitsOf, detectRuneFit, detectSavedBuilds, detectThreatGaps } from './detectors/build.js';
import { detectLastMatch } from './detectors/lastMatch.js';
import { detectMatchups, detectPool } from './detectors/matchups.js';
import {
  detectDeathCeiling, detectPowerCurve, detectRecentTrend, detectSession, detectTeamplay, mainLaneOf, mainOwnOf, survivalTip,
} from './detectors/performance.js';
import { detectFollowUps } from './followUp.js';
import { detectChampionPlan, detectRivalPrep, detectStrength } from './detectors/profile.js';
import { normalizeMatches } from './normalize.js';
import { fixed, pct, summarize } from './stats.js';

/** Cuántas tarjetas de una misma familia pueden salir (las de build cubren amenazas distintas). */
const FAMILY_CAP = { [FAMILY.BUILD]: 2, [FAMILY.PREP]: 2 };
/**
 * No cuentan para la diversidad por entidad: la última partida y el seguimiento hablan de
 * algo puntual, y el plan y la fortaleza son, por definición, sobre tu campeón principal.
 */
const ENTITY_EXEMPT = new Set([FAMILY.LAST_MATCH, FAMILY.FOLLOW_UP, FAMILY.PLAN, FAMILY.STRENGTH]);
const ENTITY_CAP = 3;

function selectEditorially(candidates, limit) {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const selected = [];
  const familyCount = new Map();
  const entityCount = new Map();
  for (const card of sorted) {
    if ((familyCount.get(card.family) || 0) >= (FAMILY_CAP[card.family] ?? 1)) continue;
    const counted = !ENTITY_EXEMPT.has(card.family);
    if (counted && card.entities.some(entity => (entityCount.get(entity) || 0) >= ENTITY_CAP)) continue;
    selected.push(card);
    familyCount.set(card.family, (familyCount.get(card.family) || 0) + 1);
    if (counted) card.entities.forEach(entity => entityCount.set(entity, (entityCount.get(entity) || 0) + 1));
    if (selected.length >= limit) break;
  }
  return selected;
}

/** Sin patrones sólidos todavía: referencia del jugador y el foco más básico de su línea. */
function warmUpCard(ctx) {
  const lane = mainLaneOf(ctx.matches);
  return makeInsight({
    key: 'warm-up',
    family: FAMILY.TREND,
    tone: 'neutral',
    title: tr('coachEngine.warmUp.title'),
    thesis: tr('coachEngine.warmUp.thesis', {
      games: ctx.matches.length, wr: pct(ctx.base.wr), deaths: fixed(ctx.base.avgDeaths),
    }),
    action: survivalTip(lane, mainOwnOf(ctx.matches, lane)),
    evidence: [tr('coachEngine.warmUp.evidence', { games: ctx.matches.length })],
    confidence: 0.2, sample: ctx.matches.length, priority: 10,
  });
}

/**
 * @param {{
 *   matches?: any[], champions?: any[], items?: any[], runes?: any[], builds?: any[],
 *   history?: { insight_key: string, track: any, first_seen_at: string }[],
 *   championNotes?: (champion: any) => string, now?: Date, limit?: number,
 * }} input  `championNotes`: nota estratégica del campeón en el idioma activo.
 *   `builds`: builds guardadas del jugador (para comparar las vinculadas a sus partidas).
 */
export function computeCoachReport({
  matches = [], champions = [], items = [], runes = [], builds = [], history = [], championNotes = null, now = new Date(), limit = 8,
} = {}) {
  const catalog = buildCatalog({ champions, items, runes });
  const rows = normalizeMatches(matches, catalog);
  const coverage = {
    matches: rows.length,
    withComposition: rows.filter(row => row.compKnown).length,
    withBuild: rows.filter(row => row.buildKnown).length,
    withKda: rows.filter(row => row.hasKda).length,
    withTeamKills: rows.filter(row => row.killParticipation !== null).length,
  };
  if (!rows.length) return { insights: [], coverage, generatedAt: now.toISOString() };

  const ctx = { matches: rows, base: summarize(rows), catalog, buildHabits: buildHabitsOf(rows), builds, championNotes, now };
  const candidates = [
    ...detectLastMatch(ctx),
    ...detectDeathCeiling(ctx),
    ...detectThreatGaps(ctx),
    ...detectMatchups(ctx),
    ...detectPowerCurve(ctx),
    ...detectPool(ctx),
    ...detectSession(ctx),
    ...detectRecentTrend(ctx),
    ...detectTeamplay(ctx),
    ...detectRuneFit(ctx),
    ...detectSavedBuilds(ctx),
  ];
  // Preparación (prioridad baja): rivales frecuentes que no tengan ya tarjeta de matchup,
  // plan con el main y fortaleza.
  const coveredEnemies = new Set(candidates.filter(card => card.track?.kind === 'matchup').map(card => card.track.enemy));
  candidates.push(...detectRivalPrep(ctx, coveredEnemies), ...detectChampionPlan(ctx), ...detectStrength(ctx));
  const byKey = new Map(candidates.map(card => [card.id, card]));
  candidates.push(...detectFollowUps(ctx, history, byKey));

  const seen = new Set((history || []).map(entry => entry.insight_key));
  candidates.forEach(card => {
    card.isNew = card.family !== FAMILY.FOLLOW_UP && !seen.has(card.id);
  });

  const insights = selectEditorially(candidates, Math.max(1, Number(limit) || 8));
  if (!insights.length) insights.push(warmUpCard(ctx));
  return { insights, coverage, generatedAt: now.toISOString() };
}
