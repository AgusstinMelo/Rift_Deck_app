// Consejos de preparación: no necesitan un problema detectado en tus partidas. Cruzan
// lo que más jugás (rivales, main, mejor campeón) con el catálogo para que siempre haya
// algo concreto que aplicar en la próxima partida. Van con prioridad baja: los patrones
// medidos en tu historial siempre salen antes.
import { tr } from '../../../i18n/uiI18n.js';
import { FAMILY, makeInsight } from '../card.js';
import { itemsGoodAgainst, keyOf } from '../catalog.js';
import { fixed, groupBy, pct, shrunkRate, summarize } from '../stats.js';
import { vulnerabilityPlan } from './matchups.js';

/**
 * Cómo jugarle al rival directo que más te toca (a igual cantidad de partidas, el que peor
 * te va), con lo que el catálogo dice de él y los objetos que encajan con tu build. Si el
 * primero no tiene datos en el catálogo, prueba con el siguiente.
 * @param {any} ctx
 * @param {Set<string>} coveredEnemies  Rivales que ya tienen tarjeta de matchup.
 */
export function detectRivalPrep(ctx, coveredEnemies = new Set()) {
  const rivals = [...groupBy(ctx.matches.filter(match => match.enemyKey && match.own), match => match.enemyKey)]
    .filter(([key, rows]) => rows.length >= 3 && !coveredEnemies.has(key))
    .sort((a, b) => b[1].length - a[1].length || summarize(a[1]).wr - summarize(b[1]).wr);
  const cards = [];
  for (const [enemyKey, rows] of rivals) {
    if (cards.length >= 1) break;
    const enemy = rows[0].enemy;
    const enemyProfile = rows[0].enemyProfile;
    // Tu campeón más usado contra ese rival.
    const [championKey, championRows] = [...groupBy(rows, row => row.championKey)].sort((a, b) => b[1].length - a[1].length)[0];
    const own = championRows[0].own;
    const champion = championRows[0].champion;
    const { known, exploitable, lead } = vulnerabilityPlan(own, enemyProfile);
    if (!known.length) continue;
    const habits = ctx.buildHabits.get(championKey);
    const items = itemsGoodAgainst(ctx.catalog, own, enemy, { preferredTypes: habits?.damageTypes || [] });
    const bought = items.filter(item => rows.some(row => row.itemKeys.has(keyOf(item))));
    const stats = summarize(rows);
    // Sin nada que tu kit o tu build aprovechen, no hay consejo concreto: probá con el siguiente rival.
    if (!lead && !items.length) continue;

    const actions = lead ? [tr(`coachEngine.vulnAction.${lead}`, { enemy })] : [];
    if (items.length) {
      actions.push(tr(bought.length ? 'coachEngine.prep.itemsKeep' : 'coachEngine.prep.itemsTry', { items: items.join(tr('coachEngine.or')), enemy }));
    }
    cards.push(makeInsight({
      key: `prep-${enemyKey}`,
      family: FAMILY.PREP,
      tone: 'opportunity',
      title: tr('coachEngine.prep.title', { enemy }),
      thesis: tr('coachEngine.prep.thesis', {
        enemy, games: stats.games, wins: stats.wins, losses: stats.losses,
        list: known.slice(0, 3).map(tag => tr(`coachEngine.vuln.${tag}`)).join(', '),
        tools: exploitable.length
          ? tr('coachEngine.prep.hasTools', { champion })
          : tr('coachEngine.prep.noTools', { champion }),
      }),
      action: actions.join(' '),
      evidence: [
        tr('coachEngine.prep.evidenceRecord', { enemy, wins: stats.wins, losses: stats.losses }),
        tr('coachEngine.prep.evidenceChampion', { champion, games: championRows.length }),
      ],
      confidence: 0.45, sample: stats.games, priority: 34, impact: stats.games,
      entities: [enemy],
    }));
  }
  return cards;
}

/**
 * Plan de juego con tu main: su curva, tus números con él y la nota estratégica del
 * catálogo (traducida al idioma activo con `ctx.championNotes`).
 */
export function detectChampionPlan(ctx) {
  const groups = [...groupBy(ctx.matches.filter(match => match.own), match => match.championKey)]
    .sort((a, b) => b[1].length - a[1].length || summarize(a[1]).wr - summarize(b[1]).wr);
  const [championKey, rows] = groups[0] || [];
  if (!rows || rows.length < 5) return [];
  const row = ctx.catalog.champions.get(rows[0].champion, rows[0].raw.own_champion_id);
  const notes = String(ctx.championNotes ? ctx.championNotes(row) : row?.strategic_notes || '').trim();
  if (!notes) return [];
  const own = rows[0].own;
  const stats = summarize(rows);
  const scaling = ['earlygame', 'midgame', 'lategame'].includes(own.scaling) ? own.scaling : null;
  return [makeInsight({
    key: `plan-${championKey}`,
    family: FAMILY.PLAN,
    tone: 'neutral',
    title: tr('coachEngine.plan.title', { champion: own.name }),
    thesis: tr('coachEngine.plan.thesis', {
      champion: own.name, games: stats.games, wr: pct(stats.wr), deaths: fixed(stats.avgDeaths),
      scaling: scaling ? tr(`coachEngine.plan.scaling.${scaling}`) : '',
    }),
    action: notes,
    evidence: [
      tr('coachEngine.plan.evidenceGames', { games: stats.games, wr: pct(stats.wr) }),
      stats.avgDeaths !== null && tr('coachEngine.plan.evidenceDeaths', { deaths: fixed(stats.avgDeaths) }),
    ],
    confidence: 0.5, sample: stats.games, priority: 30, impact: stats.games / 2,
    entities: [own.name],
  })];
}

/** Tu fortaleza: el campeón con el que rendís claramente por encima de tu promedio. */
export function detectStrength(ctx) {
  const best = [...groupBy(ctx.matches.filter(match => match.championKey), match => match.championKey)]
    .map(([key, rows]) => ({ key, rows, stats: summarize(rows) }))
    .filter(entry => entry.stats.games >= 5)
    .map(entry => ({ ...entry, shrunk: shrunkRate(entry.stats.wins, entry.stats.games, ctx.base.wr) }))
    .filter(entry => entry.shrunk >= ctx.base.wr + 0.06)
    .sort((a, b) => b.shrunk - a.shrunk)[0];
  if (!best) return [];
  const champion = best.rows[0].champion;
  const lanes = [...groupBy(best.rows, row => row.lane)].sort((a, b) => b[1].length - a[1].length);
  const lane = lanes[0]?.[0];
  return [makeInsight({
    key: `strength-${best.key}`,
    family: FAMILY.STRENGTH,
    tone: 'positive',
    title: tr('coachEngine.strength.title', { champion }),
    thesis: tr('coachEngine.strength.thesis', {
      champion, wr: pct(best.stats.wr), games: best.stats.games, base: pct(ctx.base.wr),
      deaths: best.stats.avgDeaths !== null && ctx.base.avgDeaths !== null && best.stats.avgDeaths < ctx.base.avgDeaths - 0.5
        ? tr('coachEngine.strength.deaths', { deaths: fixed(best.stats.avgDeaths), base: fixed(ctx.base.avgDeaths) })
        : '',
    }),
    action: tr('coachEngine.strength.action', { champion, lane: lane ? tr(`lanes.${lane}`) : '' }),
    evidence: [
      tr('coachEngine.strength.evidence', { champion, wr: pct(best.stats.wr), games: best.stats.games }),
      tr('coachEngine.pool.evidenceBase', { wr: pct(ctx.base.wr) }),
    ],
    confidence: 0.5, sample: best.stats.games, priority: 28, impact: best.stats.games / 2,
    entities: [champion],
  })];
}
