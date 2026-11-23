// Revisión de la última partida cargada: qué se salió de tu patrón (muertes, build contra
// la composición rival, matchup, participación) y, con los 10 jugadores, tu daño, el daño
// que recibiste, tus peleas y el oro contra tu rival; y qué hacer la próxima vez.
import { tr } from '../../../i18n/uiI18n.js';
import { FAMILY, makeInsight } from '../card.js';
import { fixed, pct, summarize } from '../stats.js';
import { threatAdvice } from './build.js';
import { reviewBuild } from './buildReview.js';
import { vulnerabilityPlan } from './matchups.js';
import { lastMatchNumbers } from './matchNumbers.js';
import { findDeathCeiling, survivalTip } from './performance.js';

const THREAT_WEIGHT = { healing: 3, burst: 2.8, magic: 2.6, physical: 2.6, cc: 2.2, tanks: 2.2, shields: 1.6 };
const RECENT_MS = 36 * 3600 * 1000;
/** Amenazas que se responden para sobrevivir: si ganaste muriendo poco, no faltó la respuesta. */
const SURVIVAL_THREATS = ['cc', 'burst', 'magic', 'physical'];

/** Momento en que se cargó la partida (o se jugó, si no hay fecha de carga). */
const loadedAt = match => new Date(match.raw.created_at || 0).getTime() || match.time;

export function detectLastMatch(ctx) {
  const match = ctx.matches[0];
  if (!match || ctx.matches.length < 3) return [];
  const flags = [];
  const praise = [];
  // Ganaste muriendo poco: las amenazas que se responden para sobrevivir no te castigaron.
  let survived = false;

  // Muertes: contra tu techo (si existe) o contra lo que promediás en tus victorias.
  if (match.hasKda) {
    const ceiling = findDeathCeiling(ctx.matches, ctx.base.wr)?.ceiling;
    const wins = summarize(ctx.matches.filter(row => row.won && row !== match));
    const limit = ceiling ?? (wins.kdaGames >= 5 ? Math.round(wins.avgDeaths + 1.5) : null);
    survived = match.won && match.deaths <= (limit !== null ? Math.max(2, limit - 2) : 3);
    if (limit !== null && match.deaths > limit) {
      flags.push({
        weight: 3 + (match.deaths - limit) * 0.3,
        topic: 'muertes',
        text: ceiling !== undefined
          ? tr('coachEngine.last.deathsCeiling', { deaths: match.deaths, ceiling })
          : tr('coachEngine.last.deathsWins', { deaths: match.deaths, avg: fixed(wins.avgDeaths) }),
        action: survivalTip(match.lane, match.own),
      });
    } else if (limit !== null && match.deaths <= Math.max(1, limit - 2)) {
      const suffix = match.deaths === 0 ? 'None' : match.deaths === 1 ? 'One' : '';
      praise.push({ weight: match.deaths === 0 ? 2.8 : 2.4, text: tr(`coachEngine.last.praiseDeaths${suffix}`, { deaths: match.deaths }) });
    }
  }

  // Temática de la build contra las dos composiciones: corrección (se perdió y la build no
  // tenía con qué), alternativa (funcionó, pero había otra opción con argumentos) o elogio.
  // Si la revisión habló de la build, las amenazas de defensa quedan dentro de ella.
  const review = reviewBuild(ctx, match);
  if (review?.verdict === 'shift') flags.push({ weight: 3.2, text: review.text, action: review.action });
  else if (review?.verdict === 'alternative') flags.push({ weight: 2.9, text: review.text, action: review.action, soft: true });
  else if (review?.verdict === 'good' && review.text) praise.push({ weight: 2.5, text: review.text });
  const coveredByReview = review?.text ? ['burst', 'physical', 'magic'] : [];

  // Build contra la composición rival.
  Object.entries(match.threats).forEach(([id, threat]) => {
    if (coveredByReview.includes(id)) return;
    // Defensa (control, burst, daño de un tipo) en una victoria con pocas muertes: no hizo
    // falta. El antiheal o la penetración no dependen de cuánto moriste: esos sí se marcan.
    if (threat.answered === false && survived && SURVIVAL_THREATS.includes(id)) return;
    if (threat.answered === false) {
      flags.push({
        weight: THREAT_WEIGHT[id] ?? 2,
        text: tr('coachEngine.last.threat', { threat: tr(`coachEngine.threat.${id}.present`), answer: tr(`coachEngine.threat.${id}.answer`) }),
        action: threatAdvice(ctx, id, { name: match.champion, own: match.own }),
      });
    } else if (threat.answered) {
      praise.push({ weight: 1.5, text: tr('coachEngine.last.praiseThreat', { answer: tr(`coachEngine.threat.${id}.answer`), threat: tr(`coachEngine.threat.${id}.present`) }) });
    }
  });

  // Matchup directo: historial y plan contra el rival.
  if (match.enemy && match.champion && !match.won) {
    const versus = summarize(ctx.matches.filter(row => row.championKey === match.championKey && row.enemyKey === match.enemyKey));
    const { known, exploitable } = vulnerabilityPlan(match.own, match.enemyProfile);
    const lead = exploitable[0] || known[0];
    if (versus.games >= 3 && versus.wr < 0.5) {
      flags.push({
        weight: 1.8,
        text: tr('coachEngine.last.matchupRecord', { enemy: match.enemy, champion: match.champion, wins: versus.wins, losses: versus.losses }),
        action: lead ? tr(`coachEngine.vulnAction.${lead}`, { enemy: match.enemy }) : tr('coachEngine.matchup.fallbackAction', { enemy: match.enemy }),
      });
    } else if (lead) {
      flags.push({
        weight: 1,
        text: tr('coachEngine.last.enemyWeakness', { enemy: match.enemy, weakness: tr(`coachEngine.vuln.${lead}`) }),
        action: tr(`coachEngine.vulnAction.${lead}`, { enemy: match.enemy }),
      });
    }
  }

  // Los números de la partida (con los 10 jugadores): daño, daño recibido, peleas y oro.
  const numbers = lastMatchNumbers(ctx, match);
  flags.push(...numbers.flags);
  praise.push(...numbers.praise);

  // Participación en kills (si se cargaron las kills de equipo y el juego no dio la de peleas).
  if (!numbers.fights && match.killParticipation !== null && match.killParticipation < 0.4) {
    flags.push({
      weight: 1.6,
      text: tr('coachEngine.last.lowKp', { kp: pct(match.killParticipation) }),
      action: tr(`coachEngine.teamplay.isolatedAction.${['top', 'jungler', 'mid', 'adc', 'support'].includes(match.lane) ? match.lane : 'any'}`),
    });
  }

  flags.sort((a, b) => b.weight - a.weight);
  praise.sort((a, b) => b.weight - a.weight);
  const praiseList = praise.slice(0, 2).map(entry => entry.text).join(tr('coachEngine.and'));
  if (!flags.length && !(match.won && praise.length)) return [];

  const recent = ctx.now.getTime() - loadedAt(match) <= RECENT_MS;
  const kda = match.hasKda ? `${match.kills}/${match.deaths}/${match.assists}` : '';
  const title = tr(match.enemy ? 'coachEngine.last.title' : 'coachEngine.last.titleNoEnemy', {
    champion: match.champion || '—',
    enemy: match.enemy,
    result: tr(match.won ? 'coachEngine.last.win' : 'coachEngine.last.loss'),
    kda,
  });

  if (!flags.length) {
    return [makeInsight({
      key: `last-${match.id}`,
      family: FAMILY.LAST_MATCH,
      tone: 'positive',
      title,
      thesis: tr('coachEngine.last.cleanThesis', { list: praiseList }),
      action: [review?.tip, tr('coachEngine.last.cleanAction')].filter(Boolean).join(' '),
      evidence: [kda && tr('coachEngine.last.evidenceKda', { kda }), ...numbers.evidence, match.duration && tr('coachEngine.last.evidenceDuration', { minutes: Math.round(match.duration) })],
      confidence: 0.6, sample: 1, priority: recent ? 96 : 40,
      entities: [match.champion],
    })];
  }

  // Una alternativa no es un error: si solo hay alternativas en una victoria, la tarjeta
  // arranca por lo que salió bien.
  const onlyOptions = match.won && flags.slice(0, 2).every(flag => flag.soft);
  const opener = !match.won ? ''
    : onlyOptions ? (praise.length ? `${tr('coachEngine.last.cleanThesis', { list: praiseList })} ` : '')
      : tr('coachEngine.last.wonBut');
  return [makeInsight({
    key: `last-${match.id}`,
    family: FAMILY.LAST_MATCH,
    tone: onlyOptions ? 'positive' : match.won ? 'opportunity' : 'warning',
    title,
    thesis: `${opener}${flags.slice(0, 2).map(flag => flag.text).join(' ')}`,
    // Las dos correcciones principales, si son distintas.
    action: [...new Set(flags.slice(0, 2).map(flag => flag.action))].join(' '),
    evidence: [
      kda && tr('coachEngine.last.evidenceKda', { kda }),
      ...numbers.evidence,
      match.duration && tr('coachEngine.last.evidenceDuration', { minutes: Math.round(match.duration) }),
      flags.length > 2 && tr('coachEngine.last.evidenceMore', { count: flags.length - 2 }),
    ],
    // Una sola partida: la confianza viene de que el patrón ya está medido en tu historial.
    confidence: 0.62, sample: 1, priority: recent ? 104 : 45, impact: flags.length * 3,
    entities: [match.champion, match.enemy],
    // Si habla de tus muertes (una de las dos señales principales), cuenta para ese tema.
    topic: flags.slice(0, 2).find(flag => flag.topic)?.topic ?? null,
  })];
}
