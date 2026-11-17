// Recomendación de pool semanal: "esta semana jugá X e Y". Cruza tu rendimiento con cada
// campeón en tu línea principal, tu forma reciente con él y la tierlist del parche (tier,
// tendencia y banrate). Los lunes es el insight del día del Dashboard; el resto de la
// semana queda como un consejo más.
import { tr } from '../../../i18n/uiI18n.js';
import { FAMILY, makeInsight } from '../card.js';
import { keyOf } from '../catalog.js';
import { groupBy, pct, shrunkRate, summarize } from '../stats.js';
import { mainLaneOf } from './performance.js';

/** Peso del tier del parche en el puntaje (el rendimiento propio pesa más). */
const TIER_BONUS = { 's+': 0.08, s: 0.05, a: 0.02, b: 0, c: -0.03, d: -0.06 };
const MIN_GAMES = 3;
/** Desde este banrate (%) conviene tener plan B. */
const HIGH_BAN = 25;

/** Lunes de la semana de `date` (YYYY-MM-DD, hora local): identifica la semana. */
export function weekKeyOf(date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

/** Entrada de la tierlist de un campeón en una línea. */
function tierEntry(tierlist, champion, lane) {
  const key = keyOf(champion);
  return (tierlist || []).find(entry => entry.lane === lane && keyOf(entry.champion_name) === key) || null;
}

/** Puntaje de un campeón para la semana: rendimiento propio, forma reciente y meta. */
function scoreCandidate(ctx, rows, lane) {
  const stats = summarize(rows);
  const shrunk = shrunkRate(stats.wins, stats.games, ctx.base.wr);
  const recent = summarize(rows.slice(0, 8));
  // La forma reciente corrige un poco (las partidas viejas pesan menos), sin dominar.
  const form = Math.max(-0.06, Math.min(0.06, (recent.wr - stats.wr) * 0.3));
  const meta = tierEntry(ctx.tierlist, rows[0].champion, lane);
  const tier = meta?.tier ? String(meta.tier).toLowerCase() : null;
  const rising = meta && Number(meta.previous_position_in_lane) > Number(meta.position_in_lane);
  const score = shrunk + form + (tier ? TIER_BONUS[tier] ?? 0 : 0) + (rising ? 0.01 : 0);
  return { name: rows[0].champion, key: rows[0].championKey, stats, shrunk, score, meta, tier, rising };
}

export function detectWeeklyPicks(ctx) {
  const recentLane = mainLaneOf(ctx.matches.slice(0, 30));
  if (!recentLane) return [];
  const laneRows = ctx.matches.filter(match => match.lane === recentLane && match.championKey);
  if (laneRows.length < 6) return [];

  const candidates = [...groupBy(laneRows, match => match.championKey)]
    .map(([, rows]) => rows)
    .filter(rows => rows.length >= MIN_GAMES)
    .map(rows => scoreCandidate(ctx, rows, recentLane));
  // Nunca recomendar un campeón que te hace perder.
  const picks = candidates
    .filter(candidate => candidate.shrunk >= ctx.base.wr - 0.02 && candidate.stats.wr >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
  if (!picks.length) return [];

  // Uno de tus más jugados que te resta: para normales hasta encontrarle la vuelta.
  const avoid = candidates
    .filter(candidate => !picks.includes(candidate) && candidate.stats.games >= 5
      && candidate.shrunk <= ctx.base.wr - 0.08)
    .sort((a, b) => b.stats.games - a.stats.games)[0] || null;

  const lane = tr(`lanes.${recentLane}`);
  const metaPhrase = pick => {
    if (!pick.meta?.tier) return '';
    return tr(pick.rising ? 'coachEngine.weekly.tierRising' : 'coachEngine.weekly.tier', { tier: pick.meta.tier });
  };
  const describe = pick => tr('coachEngine.weekly.pickLine', {
    champion: pick.name, wr: pct(pick.stats.wr), games: pick.stats.games, meta: metaPhrase(pick),
  });
  const [first, second] = picks;
  const banned = picks.find(pick => Number(pick.meta?.banrate) >= HIGH_BAN);

  const actions = [second
    ? tr('coachEngine.weekly.actionTwo', { first: first.name, second: second.name })
    : tr('coachEngine.weekly.actionOne', { first: first.name, lane })];
  if (banned) {
    actions.push(tr('coachEngine.weekly.banNote', { champion: banned.name, ban: `${Math.round(Number(banned.meta.banrate))}%` }));
  }
  if (avoid) {
    actions.push(tr('coachEngine.weekly.avoid', { champion: avoid.name, wr: pct(avoid.stats.wr), games: avoid.stats.games }));
  }

  const monday = ctx.now.getDay() === 1;
  return [makeInsight({
    // Una tarjeta por semana: el lunes aparece como nueva.
    key: `weekly-picks-${weekKeyOf(ctx.now)}`,
    family: FAMILY.WEEKLY_PICKS,
    tone: 'opportunity',
    title: second
      ? tr('coachEngine.weekly.titleTwo', { first: first.name, second: second.name })
      : tr('coachEngine.weekly.titleOne', { first: first.name }),
    thesis: tr('coachEngine.weekly.thesis', { lane, picks: picks.map(describe).join(tr('coachEngine.weekly.joiner')) }),
    action: actions.join(' '),
    evidence: [
      ...picks.map(pick => tr('coachEngine.weekly.evidence', {
        champion: pick.name, wr: pct(pick.stats.wr), games: pick.stats.games,
        tier: pick.meta?.tier ? ` · ${tr('coachEngine.weekly.tierShort', { tier: pick.meta.tier })}` : '',
      })),
      avoid && tr('coachEngine.weekly.evidence', { champion: avoid.name, wr: pct(avoid.stats.wr), games: avoid.stats.games, tier: '' }),
    ],
    confidence: 0.55, sample: picks.reduce((sum, pick) => sum + pick.stats.games, 0),
    // Lunes: primero en el Dashboard (por encima de la última partida). Resto de la semana: preparación.
    priority: monday ? 130 : 33,
    impact: picks.length * 3,
    entities: picks.map(pick => pick.name),
  })];
}
