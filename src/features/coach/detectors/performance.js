// Detectores de rendimiento: techo de muertes, curva de poder, tendencia reciente,
// juego en equipo (participación en kills) y manejo de la sesión.
import { tr } from '../../../i18n/uiI18n.js';
import { FAMILY, makeInsight } from '../card.js';
import { fixed, pct, shrunkRate, summarize, twoProportionZ } from '../stats.js';

const laneLabel = lane => (lane ? tr(`lanes.${lane}`) : '');

/** Línea más jugada de un grupo de partidas. */
export function mainLaneOf(rows) {
  const counts = new Map();
  rows.forEach(row => row.lane && counts.set(row.lane, (counts.get(row.lane) || 0) + 1));
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

/** Perfil del campeón más jugado de un grupo de partidas (opcionalmente, en una línea). */
export function mainOwnOf(rows, lane = null) {
  const counts = new Map();
  rows.forEach(row => {
    if (!row.own || (lane && row.lane !== lane)) return;
    const entry = counts.get(row.championKey) || { own: row.own, games: 0 };
    entry.games += 1;
    counts.set(row.championKey, entry);
  });
  return [...counts.values()].sort((a, b) => b.games - a.games)[0]?.own || null;
}

/**
 * Consejo para no morir según la línea (texto genérico si no se conoce). En support, el
 * encantador tiene el suyo: no inicia, protege.
 */
export const survivalTip = (lane, own = null) => {
  if (lane === 'support' && own?.supportStyle === 'enchanter') return tr('coachEngine.laneSurvival.supportEnchanter');
  return tr(`coachEngine.laneSurvival.${['top', 'jungler', 'mid', 'adc', 'support'].includes(lane) ? lane : 'any'}`);
};

/**
 * Busca la cantidad de muertes a partir de la cual el jugador deja de ganar:
 * el corte con la diferencia de winrate más sólida (encogida y con z).
 * @returns {{ ceiling: number, low: any, high: any, z: number, gap: number } | null}
 */
export function findDeathCeiling(matches, baseWr) {
  const rows = matches.filter(match => match.hasKda);
  if (rows.length < 12) return null;
  let best = null;
  for (let ceiling = 2; ceiling <= 9; ceiling += 1) {
    const lowRows = rows.filter(row => row.deaths <= ceiling);
    const highRows = rows.filter(row => row.deaths > ceiling);
    if (lowRows.length < 5 || highRows.length < 5) continue;
    const low = summarize(lowRows);
    const high = summarize(highRows);
    const gap = shrunkRate(low.wins, low.games, baseWr) - shrunkRate(high.wins, high.games, baseWr);
    const z = twoProportionZ(low.wins, low.games, high.wins, high.games);
    if (!best || z > best.z) best = { ceiling, low, high, lowRows, highRows, z, gap };
  }
  return best && best.gap >= 0.18 && best.z >= 1.5 ? best : null;
}

export function detectDeathCeiling(ctx) {
  const found = findDeathCeiling(ctx.matches, ctx.base.wr);
  if (!found) return [];
  const { ceiling, low, high, highRows, z } = found;
  const wins = summarize(ctx.matches.filter(match => match.won));
  const losses = summarize(ctx.matches.filter(match => !match.won));
  const lane = mainLaneOf(highRows);
  return [makeInsight({
    key: 'deaths-ceiling',
    family: FAMILY.DEATHS,
    tone: 'critical',
    title: tr('coachEngine.deaths.title', { next: ceiling + 1 }),
    thesis: tr('coachEngine.deaths.thesis', {
      ceiling, next: ceiling + 1,
      wrLow: pct(low.wr), gamesLow: low.games, wrHigh: pct(high.wr), gamesHigh: high.games,
      winDeaths: fixed(wins.avgDeaths), lossDeaths: fixed(losses.avgDeaths),
    }),
    action: tr('coachEngine.deaths.action', { ceiling, tip: survivalTip(lane, mainOwnOf(highRows, lane)) }),
    evidence: [
      tr('coachEngine.deaths.evidenceLow', { ceiling, wr: pct(low.wr), games: low.games }),
      tr('coachEngine.deaths.evidenceHigh', { next: ceiling + 1, wr: pct(high.wr), games: high.games }),
      lane && tr('coachEngine.deaths.evidenceLane', { lane: laneLabel(lane) }),
    ],
    z, sample: low.games + high.games, priority: 82, impact: high.losses,
    track: { kind: 'deathsOver', ceiling },
    goal: { metric: 'partidas_muertes', condition: { op: 'lte', value: ceiling }, target: 10, name: tr('coachEngine.goalName.deaths', { ceiling }) },
  })];
}

/**
 * Curva de poder: los campeones de late pierden las partidas cortas, o los de early
 * pierden las largas. Agrupa por la curva del catálogo (scaling) para tener volumen.
 */
export function detectPowerCurve(ctx) {
  const SHORT = 15;
  const LONG = 20;
  const cards = [];
  [
    { scaling: 'lategame', weak: row => row.duration <= SHORT, strong: row => row.duration > SHORT },
    { scaling: 'earlygame', weak: row => row.duration >= LONG, strong: row => row.duration < LONG },
  ].forEach(({ scaling, weak, strong }) => {
    const rows = ctx.matches.filter(match => match.own?.scaling === scaling && match.duration);
    const weakRows = rows.filter(weak);
    const strongRows = rows.filter(strong);
    if (weakRows.length < 4 || strongRows.length < 4) return;
    const weakStats = summarize(weakRows);
    const strongStats = summarize(strongRows);
    const prior = summarize(rows).wr;
    const gap = shrunkRate(strongStats.wins, strongStats.games, prior) - shrunkRate(weakStats.wins, weakStats.games, prior);
    const z = twoProportionZ(strongStats.wins, strongStats.games, weakStats.wins, weakStats.games);
    if (gap < 0.15 || z < 1.2) return;
    const champions = [...new Set(rows.map(row => row.champion))].slice(0, 3).join(', ');
    const late = scaling === 'lategame';
    cards.push(makeInsight({
      key: `curve-${scaling}`,
      family: FAMILY.CURVE,
      tone: 'warning',
      title: tr(late ? 'coachEngine.curve.lateTitle' : 'coachEngine.curve.earlyTitle'),
      thesis: tr(late ? 'coachEngine.curve.lateThesis' : 'coachEngine.curve.earlyThesis', {
        champions, short: SHORT, long: LONG,
        wrWeak: pct(weakStats.wr), gamesWeak: weakStats.games, wrStrong: pct(strongStats.wr), gamesStrong: strongStats.games,
      }),
      action: tr(late ? 'coachEngine.curve.lateAction' : 'coachEngine.curve.earlyAction'),
      evidence: [
        tr(late ? 'coachEngine.curve.evidenceShort' : 'coachEngine.curve.evidenceLong', { short: SHORT, long: LONG, wr: pct(weakStats.wr), games: weakStats.games }),
        tr('coachEngine.curve.evidenceRest', { wr: pct(strongStats.wr), games: strongStats.games }),
      ],
      z, sample: rows.length, corroborated: true, priority: 74, impact: weakStats.losses,
      entities: [champions],
      track: { kind: 'curve', scaling, short: SHORT, long: LONG },
    }));
  });
  return cards;
}

/** Tendencia reciente: últimas 8 partidas contra las 20 anteriores. */
export function detectRecentTrend(ctx) {
  const { matches } = ctx;
  if (matches.length < 20) return [];
  const recentRows = matches.slice(0, 8);
  const previousRows = matches.slice(8, 28);
  const recent = summarize(recentRows);
  const previous = summarize(previousRows);
  if (recent.kdaGames < 6 || previous.kdaGames < 10) return [];
  const deathDelta = recent.avgDeaths - previous.avgDeaths;
  const lane = mainLaneOf(recentRows);
  if (deathDelta >= 1.3) {
    return [makeInsight({
      key: 'trend-deaths-up',
      family: FAMILY.TREND,
      tone: 'warning',
      title: tr('coachEngine.trend.deathsUpTitle'),
      thesis: tr('coachEngine.trend.deathsUpThesis', {
        games: recent.games, recent: fixed(recent.avgDeaths), previous: fixed(previous.avgDeaths),
        wrRecent: pct(recent.wr), wrPrevious: pct(previous.wr),
      }),
      action: tr('coachEngine.trend.deathsUpAction', { tip: survivalTip(lane, mainOwnOf(recentRows, lane)) }),
      evidence: [
        tr('coachEngine.trend.evidenceRecent', { games: recent.games, deaths: fixed(recent.avgDeaths), wr: pct(recent.wr) }),
        tr('coachEngine.trend.evidencePrevious', { games: previous.games, deaths: fixed(previous.avgDeaths), wr: pct(previous.wr) }),
      ],
      sample: recent.games + previous.games, z: deathDelta, priority: 70, impact: recent.losses,
      track: { kind: 'avgDeaths' },
    })];
  }
  if (deathDelta <= -1.3 && recent.wr >= previous.wr) {
    return [makeInsight({
      key: 'trend-deaths-down',
      family: FAMILY.TREND,
      tone: 'positive',
      title: tr('coachEngine.trend.deathsDownTitle'),
      thesis: tr('coachEngine.trend.deathsDownThesis', {
        games: recent.games, recent: fixed(recent.avgDeaths), previous: fixed(previous.avgDeaths),
        wrRecent: pct(recent.wr), wrPrevious: pct(previous.wr),
      }),
      action: tr('coachEngine.trend.deathsDownAction'),
      evidence: [
        tr('coachEngine.trend.evidenceRecent', { games: recent.games, deaths: fixed(recent.avgDeaths), wr: pct(recent.wr) }),
        tr('coachEngine.trend.evidencePrevious', { games: previous.games, deaths: fixed(previous.avgDeaths), wr: pct(previous.wr) }),
      ],
      sample: recent.games + previous.games, z: -deathDelta, priority: 50,
    })];
  }
  return [];
}

/** Participación esperada en kills por línea (Wild Rift): junglas, mids y supports, más. */
const EXPECTED_KP = { jungler: 0.6, support: 0.6, mid: 0.55, adc: 0.5, top: 0.45 };

/** Juego en equipo: participación en kills y parte de las muertes del equipo. */
export function detectTeamplay(ctx) {
  const rows = ctx.matches.filter(match => match.killParticipation !== null);
  if (rows.length < 8) return [];
  const avg = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const kp = avg(rows.map(row => row.killParticipation));
  const winRows = rows.filter(row => row.won);
  const lossRows = rows.filter(row => !row.won);
  const kpWin = winRows.length >= 3 ? avg(winRows.map(row => row.killParticipation)) : null;
  const kpLoss = lossRows.length >= 3 ? avg(lossRows.map(row => row.killParticipation)) : null;
  const shareRows = rows.filter(row => row.deathShare !== null);
  const deathShare = shareRows.length >= 8 ? avg(shareRows.map(row => row.deathShare)) : null;
  const lane = mainLaneOf(rows);
  const expected = EXPECTED_KP[lane] ?? 0.5;
  const isolated = kp <= expected - 0.1;
  // Un tanque o un support de engage entra primero: es normal que se lleve más muertes del equipo.
  const own = mainOwnOf(rows, lane);
  const frontline = own?.isTank || (own?.buildClass === 'support' && own.supportStyle === 'engage');
  const feeding = deathShare !== null && deathShare >= (frontline ? 0.36 : 0.3);
  if (!isolated && !feeding) return [];
  return [makeInsight({
    key: feeding ? 'teamplay-death-share' : 'teamplay-low-kp',
    family: FAMILY.TEAMPLAY,
    tone: 'warning',
    title: tr(feeding ? 'coachEngine.teamplay.feedingTitle' : 'coachEngine.teamplay.isolatedTitle'),
    thesis: tr(feeding ? 'coachEngine.teamplay.feedingThesis' : 'coachEngine.teamplay.isolatedThesis', {
      kp: pct(kp), expected: pct(expected), lane: laneLabel(lane), games: rows.length,
      share: deathShare !== null ? pct(deathShare) : '—',
      split: kpWin !== null && kpLoss !== null ? tr('coachEngine.teamplay.split', { win: pct(kpWin), loss: pct(kpLoss) }) : '',
    }),
    action: tr(feeding ? 'coachEngine.teamplay.feedingAction' : `coachEngine.teamplay.isolatedAction.${lane in EXPECTED_KP ? lane : 'any'}`),
    evidence: [
      tr('coachEngine.teamplay.evidenceKp', { kp: pct(kp), expected: pct(expected) }),
      deathShare !== null && tr('coachEngine.teamplay.evidenceShare', { share: pct(deathShare) }),
      tr('coachEngine.teamplay.evidenceGames', { games: rows.length }),
    ],
    sample: rows.length, z: feeding ? (deathShare - 0.2) * 10 : (expected - kp) * 10, priority: 72, impact: lossRows.length,
    track: feeding ? { kind: 'deathShare' } : { kind: 'killParticipation' },
  })];
}

/**
 * Sesiones: partidas del mismo día (y, si hay hora, con menos de 2 h entre una y otra).
 * Devuelve cada partida con cuántas derrotas seguidas traía y su número en la sesión.
 */
export function sessionize(matches) {
  const ordered = matches.filter(match => match.day).slice().sort((a, b) => a.time - b.time);
  const result = [];
  let streak = 0;
  let index = 0;
  ordered.forEach((match, position) => {
    const previous = ordered[position - 1];
    const sameSession = previous && previous.day === match.day
      && (!match.hasHour || !previous.hasHour || match.time - previous.time <= 2 * 3600 * 1000);
    if (!sameSession) {
      streak = 0;
      index = 0;
    }
    index += 1;
    result.push({ match, lossStreak: streak, index });
    streak = match.won ? 0 : streak + 1;
  });
  return result;
}

/** Tilt: rendimiento después de 2 derrotas seguidas o pasadas N partidas en la sesión. */
export function detectSession(ctx) {
  const sessions = sessionize(ctx.matches);
  if (sessions.length < 15) return [];
  const candidates = [];

  const afterLosses = sessions.filter(entry => entry.lossStreak >= 2).map(entry => entry.match);
  const rest = sessions.filter(entry => entry.lossStreak < 2).map(entry => entry.match);
  if (afterLosses.length >= 5) {
    const tilt = summarize(afterLosses);
    const normal = summarize(rest);
    const gap = shrunkRate(normal.wins, normal.games, ctx.base.wr) - shrunkRate(tilt.wins, tilt.games, ctx.base.wr);
    const z = twoProportionZ(normal.wins, normal.games, tilt.wins, tilt.games);
    if (gap >= 0.15 && z >= 1.2) {
      candidates.push(makeInsight({
        key: 'session-loss-streak',
        family: FAMILY.SESSION,
        tone: 'critical',
        title: tr('coachEngine.session.streakTitle'),
        thesis: tr('coachEngine.session.streakThesis', { wr: pct(tilt.wr), games: tilt.games, wrRest: pct(normal.wr) }),
        action: tr('coachEngine.session.streakAction'),
        evidence: [
          tr('coachEngine.session.evidenceStreak', { wr: pct(tilt.wr), games: tilt.games }),
          tr('coachEngine.session.evidenceRest', { wr: pct(normal.wr), games: normal.games }),
        ],
        z, sample: sessions.length, priority: 76, impact: tilt.losses,
        track: { kind: 'afterLossStreak' },
      }));
    }
  }

  // Cansancio: desde qué partida de la sesión el winrate cae.
  for (const from of [4, 5, 6]) {
    const late = sessions.filter(entry => entry.index >= from).map(entry => entry.match);
    const early = sessions.filter(entry => entry.index < from).map(entry => entry.match);
    if (late.length < 6 || early.length < 10) continue;
    const lateStats = summarize(late);
    const earlyStats = summarize(early);
    const gap = shrunkRate(earlyStats.wins, earlyStats.games, ctx.base.wr) - shrunkRate(lateStats.wins, lateStats.games, ctx.base.wr);
    const z = twoProportionZ(earlyStats.wins, earlyStats.games, lateStats.wins, lateStats.games);
    if (gap < 0.15 || z < 1.2) continue;
    candidates.push(makeInsight({
      key: 'session-length',
      family: FAMILY.SESSION,
      tone: 'warning',
      title: tr('coachEngine.session.lengthTitle', { from }),
      thesis: tr('coachEngine.session.lengthThesis', { from, wr: pct(lateStats.wr), games: lateStats.games, wrEarly: pct(earlyStats.wr) }),
      action: tr('coachEngine.session.lengthAction', { max: from - 1 }),
      evidence: [
        tr('coachEngine.session.evidenceEarly', { max: from - 1, wr: pct(earlyStats.wr), games: earlyStats.games }),
        tr('coachEngine.session.evidenceLate', { from, wr: pct(lateStats.wr), games: lateStats.games }),
      ],
      z, sample: sessions.length, priority: 68, impact: lateStats.losses,
      track: { kind: 'sessionLength', from },
    }));
    break;
  }
  return candidates;
}
