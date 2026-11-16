// Seguimiento de consejos: cada insight con `track` define una métrica medible. Cuando un
// consejo ya se mostró (coach_insight_log), se compara esa métrica en las partidas
// cargadas desde entonces contra las anteriores.
import { tr } from '../../i18n/uiI18n.js';
import { FAMILY, makeInsight } from './card.js';
import { sessionize } from './detectors/performance.js';
import { fixed, pct, summarize } from './stats.js';

const avg = values => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
const share = (rows, predicate) => (rows.length ? rows.filter(predicate).length / rows.length : null);

/**
 * Métrica de cada tipo de seguimiento: valor, partidas consideradas, si es mejor más
 * alto o más bajo, cuánto tiene que moverse para contar como cambio y cómo se muestra.
 */
const MEASURES = {
  deathsOver: {
    rows: rows => rows.filter(row => row.hasKda),
    value: (rows, track) => share(rows, row => row.deaths > track.ceiling),
    better: 'lower', step: 0.1, format: pct, min: 4,
  },
  threatAnswer: {
    rows: (rows, track) => rows.filter(row => row.threats[track.threat] && row.threats[track.threat].answered !== null),
    value: (rows, track) => share(rows, row => row.threats[track.threat].answered),
    better: 'higher', step: 0.15, format: pct, min: 3,
  },
  matchup: {
    rows: (rows, track) => rows.filter(row => row.championKey === track.champion && row.enemyKey === track.enemy),
    value: rows => summarize(rows).wr,
    better: 'higher', step: 0.15, format: pct, min: 2,
  },
  curve: {
    rows: (rows, track) => rows.filter(row => row.own?.scaling === track.scaling && row.duration
      && (track.scaling === 'lategame' ? row.duration <= track.short : row.duration >= track.long)),
    value: rows => summarize(rows).wr,
    better: 'higher', step: 0.15, format: pct, min: 3,
  },
  avgDeaths: {
    rows: rows => rows.filter(row => row.hasKda),
    value: rows => avg(rows.map(row => row.deaths)),
    better: 'lower', step: 0.7, format: value => fixed(value), min: 5,
  },
  killParticipation: {
    rows: rows => rows.filter(row => row.killParticipation !== null),
    value: rows => avg(rows.map(row => row.killParticipation)),
    better: 'higher', step: 0.06, format: pct, min: 5,
  },
  deathShare: {
    rows: rows => rows.filter(row => row.deathShare !== null),
    value: rows => avg(rows.map(row => row.deathShare)),
    better: 'lower', step: 0.05, format: pct, min: 5,
  },
  afterLossStreak: {
    rows: rows => rows,
    value: rows => share(sessionize(rows), entry => entry.lossStreak >= 2),
    better: 'lower', step: 0.08, format: pct, min: 6,
  },
  sessionLength: {
    rows: rows => rows,
    value: (rows, track) => share(sessionize(rows), entry => entry.index >= track.from),
    better: 'lower', step: 0.1, format: pct, min: 6,
  },
  outsideCore: {
    rows: rows => rows.filter(row => row.championKey),
    value: (rows, track) => share(rows, row => !track.core.includes(row.championKey)),
    better: 'lower', step: 0.15, format: pct, min: 5,
  },
  championWr: {
    rows: (rows, track) => rows.filter(row => row.championKey === track.champion),
    value: rows => summarize(rows).wr,
    better: 'higher', step: 0.15, format: pct, min: 3,
  },
};

/** Momento de carga de una partida: `created_at` si existe, si no la fecha de juego. */
const loadedAt = match => new Date(match.raw.created_at || 0).getTime() || match.time;

/** Parámetros de texto de cada tipo de seguimiento. */
function topicVars(track) {
  return {
    ceiling: track.ceiling,
    threat: track.threat ? tr(`coachEngine.threat.${track.threat}.present`) : '',
    answer: track.threat ? tr(`coachEngine.threat.${track.threat}.answer`) : '',
    champion: track.championName || '',
    enemy: track.enemyName || '',
    from: track.from,
  };
}

/**
 * Compara antes y después de cada consejo registrado y devuelve la tarjeta de
 * seguimiento con el cambio más claro (mejora o retroceso).
 * @param {any} ctx
 * @param {{ insight_key: string, track: any, first_seen_at: string }[]} history
 * @param {Map<string, any>} current  Insights calculados ahora, por clave.
 */
export function detectFollowUps(ctx, history, current) {
  const results = [];
  (history || []).forEach(entry => {
    const track = entry.track;
    const measure = track && MEASURES[track.kind];
    if (!measure) return;
    const since = new Date(entry.first_seen_at).getTime();
    if (!Number.isFinite(since)) return;
    const afterRows = measure.rows(ctx.matches.filter(match => loadedAt(match) > since), track);
    const beforeRows = measure.rows(ctx.matches.filter(match => loadedAt(match) <= since), track).slice(0, 25);
    if (afterRows.length < measure.min || beforeRows.length < measure.min) return;
    const before = measure.value(beforeRows, track);
    const after = measure.value(afterRows, track);
    if (before === null || after === null) return;
    const delta = measure.better === 'lower' ? before - after : after - before;
    if (Math.abs(delta) < measure.step) return;
    results.push({ entry, track, measure, before, after, delta, games: afterRows.length, magnitude: Math.abs(delta) / measure.step });
  });

  const best = results.sort((a, b) => b.magnitude - a.magnitude)[0];
  if (!best) return [];
  const improved = best.delta > 0;
  const vars = {
    ...topicVars(best.track),
    games: best.games,
    before: best.measure.format(best.before),
    after: best.measure.format(best.after),
  };
  const stillActive = current.get(best.entry.insight_key);
  return [makeInsight({
    key: `follow-${best.entry.insight_key}`,
    family: FAMILY.FOLLOW_UP,
    tone: improved ? 'positive' : 'warning',
    title: tr(improved ? 'coachEngine.follow.improvedTitle' : 'coachEngine.follow.worseTitle', {
      topic: tr(`coachEngine.follow.topic.${best.track.kind}`, vars),
    }),
    thesis: tr('coachEngine.follow.thesis', {
      ...vars,
      metric: tr(`coachEngine.follow.metric.${best.track.kind}`, vars),
    }),
    action: improved
      ? tr(`coachEngine.follow.next.${best.track.kind}`, vars)
      : (stillActive?.action || tr(`coachEngine.follow.next.${best.track.kind}`, vars)),
    evidence: [
      tr('coachEngine.follow.evidenceBefore', { value: vars.before }),
      tr('coachEngine.follow.evidenceAfter', { value: vars.after, games: best.games }),
    ],
    confidence: Math.min(0.9, 0.4 + best.games / 30 + best.magnitude * 0.05),
    sample: best.games, priority: 90, impact: best.games,
    entities: [best.track.championName, best.track.enemyName],
  })];
}
