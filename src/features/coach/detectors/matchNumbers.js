// Los números de cada partida con los 10 jugadores (daño, daño recibido, curación y
// escudos, peleas, oro contra tu rival de línea) leídos según lo que tu campeón tiene que
// aportar: en la última partida, contra tu propio promedio; y como tendencia en tus partidas.
import { tr } from '../../../i18n/uiI18n.js';
import { FAMILY, makeInsight } from '../card.js';
import { isEnchanter } from '../catalog.js';
import { fixed, pct } from '../stats.js';
import { participantMatches } from './participants.js';

const known = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const sumOf = (players, key) => players.reduce((sum, player) => sum + Number(player[key] || 0), 0);
const avg = values => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
const thousands = value => fixed(Math.abs(value) / 1000, 1);
const LANES = ['top', 'jungler', 'mid', 'adc', 'support'];
const laneKey = lane => (LANES.includes(lane) ? lane : 'any');

/**
 * Qué aporta tu campeón en la pelea: 'backline' (tirador o mago: pega desde atrás),
 * 'diver' (luchador o asesino: entra a pegar), 'frontline' (tanque o support de engage:
 * absorbe), 'enchanter' (cura y protege) o 'support' (support mago o de pelea).
 */
export function fightRole(own) {
  if (!own) return null;
  if (isEnchanter(own)) return 'enchanter';
  if (own.isTank || (own.buildClass === 'support' && own.supportStyle === 'engage')) return 'frontline';
  if (own.buildClass === 'support') return 'support';
  if (own.buildClass === 'carry') return own.isAssassin ? 'diver' : 'backline';
  return 'diver';
}

const DAMAGE_ROLES = ['backline', 'diver'];

/** Los números de tu partida contra tu equipo y tu rival de línea (null si falta el dato). */
export function numbersOf(row) {
  const { self, allies, opponent } = row;
  const complete = key => allies.length === 5 && allies.every(player => known(player[key]));
  const share = key => {
    if (!complete(key)) return null;
    const total = sumOf(allies, key);
    return total > 0 ? Number(self[key]) / total : null;
  };
  const rank = key => (complete(key) ? 1 + allies.filter(player => player !== self && Number(player[key]) > Number(self[key])).length : null);
  const laneRival = opponent && self.lane !== 'support' ? opponent : null;
  return {
    damageShare: share('damage_dealt'),
    damageRank: rank('damage_dealt'),
    takenShare: share('damage_taken'),
    takenRank: rank('damage_taken'),
    healShare: share('healing_shielding'),
    fights: known(self.teamfight_participation) ? Number(self.teamfight_participation) : null,
    goldDiff: laneRival && known(self.gold) && known(laneRival.gold) ? Number(self.gold) - Number(laneRival.gold) : null,
    damageVsRival: laneRival && known(self.damage_dealt) && Number(laneRival.damage_dealt) > 0
      ? Number(self.damage_dealt) / Number(laneRival.damage_dealt) : null,
  };
}

/**
 * Tu valor habitual de un número: con el mismo campeón (3 partidas o más) o, si no, con
 * campeones del mismo rol en la pelea (4 o más). Sin la partida que se evalúa.
 */
function habitualOf(rows, row, key) {
  const others = rows.filter(entry => entry !== row);
  const values = list => list.map(entry => entry.numbers[key]).filter(value => value !== null);
  const same = values(others.filter(entry => entry.match.championKey === row.match.championKey));
  if (same.length >= 3) return { value: avg(same), champion: row.match.champion };
  const role = values(others.filter(entry => entry.role === row.role));
  return role.length >= 4 ? { value: avg(role), champion: null } : null;
}

/** Filas de partidas con jugadores, con sus números y el rol de tu campeón. */
export function numberRows(ctx) {
  if (!ctx.participants?.length) return [];
  if (!ctx.numberRows) {
    ctx.numberRows = participantMatches(ctx).map(row => ({ ...row, numbers: numbersOf(row), role: fightRole(row.match.own) }));
  }
  return ctx.numberRows;
}

const rivalName = (ctx, row) => (row.opponent?.champion && ctx.catalog.champion(row.opponent.champion)?.name) || row.opponent?.champion || row.match.enemy;

/**
 * Lo que dicen los números de la última partida: correcciones (`flags`) y lo que salió
 * bien (`praise`), con peso para ordenarlos junto a las muertes y la build.
 */
export function lastMatchNumbers(ctx, match) {
  const rows = numberRows(ctx);
  const row = rows.find(entry => entry.match === match);
  const out = { flags: [], praise: [], evidence: [], fights: false };
  if (!row) return out;
  const { numbers: n, role } = row;
  const lost = !match.won;
  const habitual = key => habitualOf(rows, row, key);
  const habitualText = found => (found.champion
    ? tr('coachEngine.last.n.habitualChampion', { value: pct(found.value), champion: found.champion })
    : tr('coachEngine.last.n.habitual', { value: pct(found.value) }));

  // Daño: lo que tiene que aportar quien pega (tirador, mago, luchador, asesino).
  if (DAMAGE_ROLES.includes(role) && n.damageShare !== null) {
    const usual = habitual('damageShare');
    if (n.damageRank === 1 && n.damageShare >= 0.24) {
      out.praise.push({ weight: 2.7, text: tr('coachEngine.last.n.topDamage', { share: pct(n.damageShare) }) });
    } else if (usual && n.damageShare >= usual.value + 0.06) {
      out.praise.push({ weight: 2.3, text: tr('coachEngine.last.n.moreDamage', { share: pct(n.damageShare), habitual: habitualText(usual) }) });
    }
    const low = usual ? n.damageShare <= usual.value - 0.07 && n.damageShare < 0.25 : n.damageRank >= 4 && n.damageShare < 0.18;
    if (low) {
      out.flags.push({
        weight: 2.6 + (lost ? 0.3 : 0),
        topic: 'daño',
        text: usual
          ? tr('coachEngine.last.n.lowDamageHabitual', { share: pct(n.damageShare), habitual: habitualText(usual) })
          : tr('coachEngine.last.n.lowDamage', { share: pct(n.damageShare), rank: n.damageRank }),
        action: tr(`coachEngine.last.n.lowDamageAction.${role}`),
      });
    }
    if (!low && n.damageVsRival !== null && n.damageVsRival >= 1.6) {
      out.praise.push({ weight: 1.9, text: tr('coachEngine.last.n.beatRivalDamage', { times: fixed(n.damageVsRival, 1), enemy: rivalName(ctx, row) }) });
    }
  }

  // Daño recibido: quien pega desde atrás no tendría que absorber; la primera línea, sí.
  if (role === 'backline' && n.takenShare !== null) {
    const usual = habitual('takenShare');
    const exposed = (n.takenRank === 1 && n.takenShare >= 0.24) || (usual && n.takenShare >= usual.value + 0.07 && n.takenShare >= 0.22);
    // Si ganaste muriendo poco, el daño que recibiste no te costó la partida.
    const costly = lost || !match.hasKda || match.deaths >= 4;
    if (exposed && costly) {
      out.flags.push({
        weight: 2.5 + (lost ? 0.4 : 0),
        topic: 'posición',
        text: n.takenRank === 1
          ? tr('coachEngine.last.n.exposedTop', { share: pct(n.takenShare) })
          : tr('coachEngine.last.n.exposed', { share: pct(n.takenShare), habitual: habitualText(usual) }),
        action: tr('coachEngine.last.n.exposedAction'),
      });
    } else if (n.takenShare <= 0.16 && n.damageShare !== null && n.damageShare >= 0.24) {
      out.praise.push({ weight: 2, text: tr('coachEngine.last.n.safeDamage', { share: pct(n.takenShare) }) });
    }
  }
  if (role === 'frontline' && n.takenShare !== null) {
    const usual = habitual('takenShare');
    if (n.takenRank === 1 || n.takenShare >= 0.3) {
      out.praise.push({ weight: 2.5, text: tr('coachEngine.last.n.absorbed', { share: pct(n.takenShare) }) });
    } else if (n.takenShare < 0.18 && (!usual || n.takenShare <= usual.value - 0.05)) {
      out.flags.push({
        weight: 2.5 + (lost ? 0.3 : 0),
        text: tr('coachEngine.last.n.lowAbsorb', { share: pct(n.takenShare) }),
        action: tr('coachEngine.impact.role.tank.action'),
      });
    }
  }

  // Curación y escudos del encantador.
  if (role === 'enchanter' && n.healShare !== null) {
    const usual = habitual('healShare');
    if (n.healShare >= 0.5) {
      out.praise.push({ weight: 2.4, text: tr('coachEngine.last.n.protected', { share: pct(n.healShare) }) });
    } else if (n.healShare < 0.3 && (!usual || n.healShare <= usual.value - 0.08)) {
      out.flags.push({
        weight: 2.4 + (lost ? 0.3 : 0),
        text: tr('coachEngine.last.n.lowProtect', { share: pct(n.healShare) }),
        action: tr('coachEngine.impact.role.enchanter.action'),
      });
    }
  }

  // Presencia en las peleas (dato del juego).
  if (n.fights !== null) {
    const usual = habitual('fights');
    const usualFights = usual ? usual.value : null;
    if (n.fights < 45 && (usualFights === null || n.fights <= usualFights - 12)) {
      out.fights = true;
      out.flags.push({
        weight: 2.2 + (lost ? 0.5 : 0),
        topic: 'peleas',
        text: usualFights !== null
          ? tr('coachEngine.last.n.fewFightsHabitual', { fights: Math.round(n.fights), habitual: Math.round(usualFights) })
          : tr('coachEngine.last.n.fewFights', { fights: Math.round(n.fights) }),
        action: tr(`coachEngine.teamplay.isolatedAction.${laneKey(match.lane)}`),
      });
    } else if (n.fights >= 75) {
      out.praise.push({ weight: 1.7, text: tr('coachEngine.last.n.manyFights', { fights: Math.round(n.fights) }) });
    }
  }

  // Oro contra tu rival de línea.
  if (n.goldDiff !== null) {
    const enemy = rivalName(ctx, row);
    if (n.goldDiff >= 2000) {
      out.praise.push({ weight: 2, text: tr('coachEngine.last.n.goldAhead', { gold: thousands(n.goldDiff), enemy }) });
    } else if (n.goldDiff <= -2000) {
      out.flags.push({
        weight: 2.3 + (lost ? 0.4 : 0),
        topic: 'línea',
        text: tr('coachEngine.last.n.goldBehind', { gold: thousands(n.goldDiff), enemy }),
        action: tr(`coachEngine.laneEdge.action.${['top', 'jungler', 'mid', 'adc'].includes(match.lane) ? match.lane : 'any'}`),
      });
    }
  }

  out.evidence = [
    DAMAGE_ROLES.includes(role) && n.damageShare !== null && tr('coachEngine.last.n.evidenceDamage', { share: pct(n.damageShare) }),
    ['frontline', 'backline'].includes(role) && n.takenShare !== null && tr('coachEngine.last.n.evidenceTaken', { share: pct(n.takenShare) }),
    role === 'enchanter' && n.healShare !== null && tr('coachEngine.last.n.evidenceHeal', { share: pct(n.healShare) }),
    n.fights !== null && tr('coachEngine.last.n.evidenceFights', { fights: Math.round(n.fights) }),
  ].filter(Boolean);
  return out;
}

// ── Tendencias ────────────────────────────────────────────────────────────

/** Campeón con más partidas en el grupo. */
function mainChampion(rows) {
  const counts = new Map();
  rows.forEach(row => counts.set(row.match.championKey, (counts.get(row.match.championKey) || 0) + 1));
  const key = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  return rows.find(row => row.match.championKey === key)?.match.champion || null;
}

/**
 * Perdés siendo el que más daño hace: en la mitad o más de tus derrotas fuiste el máximo
 * daño de tu equipo. El daño lo ponés; la partida se escapa en las muertes del final o en
 * no convertir las peleas ganadas en objetivos.
 */
export function detectCarryLoad(ctx, rows = numberRows(ctx)) {
  const ranked = rows.filter(row => DAMAGE_ROLES.includes(row.role) && row.numbers.damageRank !== null);
  const losses = ranked.filter(row => !row.match.won);
  const carried = losses.filter(row => row.numbers.damageRank === 1);
  if (losses.length < 4 || carried.length < 3 || carried.length / losses.length < 0.5) return [];
  const deaths = avg(carried.filter(row => row.match.hasKda).map(row => row.match.deaths));
  const share = avg(carried.map(row => row.numbers.damageShare));
  const dying = deaths !== null && deaths >= 5;
  return [makeInsight({
    key: 'impact-carry-load',
    family: FAMILY.IMPACT,
    tone: 'opportunity',
    title: tr('coachEngine.impact.carryLoad.title'),
    thesis: tr('coachEngine.impact.carryLoad.thesis', { carried: carried.length, losses: losses.length, share: pct(share) }),
    action: tr(`coachEngine.impact.carryLoad.action.${dying ? 'deaths' : 'objectives'}`, { deaths: fixed(deaths ?? 0) }),
    evidence: [
      tr('coachEngine.impact.carryLoad.evidence', { carried: carried.length, losses: losses.length }),
      deaths !== null && tr('coachEngine.impact.carryLoad.evidenceDeaths', { deaths: fixed(deaths) }),
    ],
    z: 1 + carried.length / losses.length, sample: ranked.length, priority: 73, impact: carried.length,
    entities: [mainChampion(carried)],
  })];
}

/**
 * Desde atrás recibís demasiado: un tirador o mago que se lleva una parte grande del daño
 * del equipo se está parando delante de su primera línea. Se marca si el promedio es alto
 * o si en las derrotas recibís claramente más que en las victorias.
 */
export function detectExposure(ctx, rows = numberRows(ctx)) {
  const backline = rows.filter(row => row.role === 'backline' && row.numbers.takenShare !== null);
  if (backline.length < 5) return [];
  const of = list => avg(list.map(row => row.numbers.takenShare));
  const all = of(backline);
  const wins = backline.filter(row => row.match.won);
  const losses = backline.filter(row => !row.match.won);
  const split = wins.length >= 2 && losses.length >= 2 ? { win: of(wins), loss: of(losses) } : null;
  const highAverage = all >= 0.24;
  const worseInLosses = split && split.loss - split.win >= 0.06 && split.loss >= 0.22;
  if (!highAverage && !worseInLosses) return [];
  const champion = mainChampion(backline);
  return [makeInsight({
    key: 'impact-exposed',
    family: FAMILY.IMPACT,
    tone: 'warning',
    title: tr('coachEngine.impact.exposed.title'),
    thesis: tr('coachEngine.impact.exposed.thesis', {
      share: pct(all), games: backline.length,
      split: split ? tr('coachEngine.impact.exposed.split', { win: pct(split.win), loss: pct(split.loss) }) : '',
    }),
    action: tr('coachEngine.last.n.exposedAction'),
    evidence: [
      tr('coachEngine.impact.exposed.evidence', { share: pct(all), games: backline.length }),
      split && tr('coachEngine.impact.exposed.evidenceSplit', { win: pct(split.win), loss: pct(split.loss) }),
    ],
    z: Math.max((all - 0.18) * 14, split ? (split.loss - split.win) * 14 : 0),
    sample: backline.length, priority: 72, impact: losses.length,
    entities: [champion],
  })];
}

/**
 * Tu daño en las últimas 5 partidas contra las anteriores (hasta 15), con campeones que
 * pegan: si subió o bajó claramente tu parte del daño del equipo.
 */
export function detectDamageTrend(ctx, rows = numberRows(ctx)) {
  const withDamage = rows.filter(row => DAMAGE_ROLES.includes(row.role) && row.numbers.damageShare !== null);
  if (withDamage.length < 10) return [];
  const recentRows = withDamage.slice(0, 5);
  const previousRows = withDamage.slice(5, 20);
  const recent = avg(recentRows.map(row => row.numbers.damageShare));
  const previous = avg(previousRows.map(row => row.numbers.damageShare));
  const delta = recent - previous;
  if (Math.abs(delta) < 0.05) return [];
  const up = delta > 0;
  const role = recentRows[0].role;
  const wins = list => list.filter(row => row.match.won).length;
  const vars = {
    recent: pct(recent), previous: pct(previous), games: recentRows.length, previousGames: previousRows.length,
    winsRecent: wins(recentRows), winsPrevious: wins(previousRows),
  };
  return [makeInsight({
    key: up ? 'trend-damage-up' : 'trend-damage-down',
    family: FAMILY.TREND,
    tone: up ? 'positive' : 'warning',
    title: tr(`coachEngine.trend.damage${up ? 'Up' : 'Down'}Title`),
    thesis: tr(`coachEngine.trend.damage${up ? 'Up' : 'Down'}Thesis`, vars),
    action: up ? tr('coachEngine.trend.damageUpAction') : tr(`coachEngine.last.n.lowDamageAction.${role}`),
    evidence: [
      tr('coachEngine.trend.evidenceDamageRecent', vars),
      tr('coachEngine.trend.evidenceDamagePrevious', vars),
    ],
    z: Math.abs(delta) * 20, sample: withDamage.length, priority: up ? 52 : 69,
    impact: up ? 0 : recentRows.length - vars.winsRecent,
  })];
}

/** Tendencias con los números de las partidas (vacío sin jugadores guardados). */
export function detectNumberTrends(ctx) {
  const rows = numberRows(ctx);
  if (rows.length < 5) return [];
  return [...detectCarryLoad(ctx, rows), ...detectExposure(ctx, rows), ...detectDamageTrend(ctx, rows)];
}
