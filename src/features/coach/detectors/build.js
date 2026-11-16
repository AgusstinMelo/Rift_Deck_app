// Detectores de build: si la build responde a lo que trae el equipo rival y si la runa
// clave encaja con cómo hace daño el campeón. Todo se cruza con el catálogo.
import { baseMessages, lookup, tr } from '../../../i18n/uiI18n.js';
import { FAMILY, makeInsight } from '../card.js';
import { THREATS, keyOf, preferredDamageTypes, suggestItems } from '../catalog.js';
import { groupBy } from '../stats.js';
import { pct, shrunkRate, summarize, twoProportionZ } from '../stats.js';

const THREAT_PRIORITY = { healing: 86, magic: 80, physical: 80, cc: 74, burst: 78, tanks: 76, shields: 66 };

/** Campeón más jugado de un grupo de partidas, con su perfil. */
function mainChampionOf(rows) {
  const counts = new Map();
  rows.forEach(row => {
    if (!row.champion) return;
    const entry = counts.get(row.championKey) || { name: row.champion, own: row.own, games: 0 };
    entry.games += 1;
    counts.set(row.championKey, entry);
  });
  return [...counts.values()].sort((a, b) => b.games - a.games)[0] || null;
}

/**
 * Lo que el jugador arma con cada campeón: objetos ya comprados (para sugerir primero lo
 * conocido) y tipos de daño de sus objetos finales (para no sugerir otra build).
 */
export function buildHabitsOf(matches) {
  const habits = new Map();
  groupBy(matches.filter(match => match.championKey), match => match.championKey).forEach((rows, key) => {
    habits.set(key, {
      bought: new Set(rows.flatMap(row => [...row.itemKeys])),
      damageTypes: preferredDamageTypes(rows),
    });
  });
  return habits;
}

/** Texto de cuándo y cómo responder: los carries tienen el suyo (sin cambiar daño por defensa pura). */
function timingFor(threatId, own) {
  const carryKey = `coachEngine.threat.${threatId}.timingCarry`;
  if (own?.buildClass === 'carry' && lookup(baseMessages, carryKey)) return tr(carryKey);
  return tr(`coachEngine.threat.${threatId}.timing`);
}

/** Texto de la respuesta a una amenaza con objetos sugeridos para un campeón. */
export function threatAdvice(ctx, threatId, champion) {
  const threat = THREATS.find(entry => entry.id === threatId);
  const habits = ctx.buildHabits.get(keyOf(champion?.name)) || { bought: new Set(), damageTypes: [] };
  const items = champion?.own
    ? suggestItems(ctx.catalog, champion.own, threat.answers, { boughtKeys: habits.bought, preferredTypes: habits.damageTypes })
    : [];
  const timing = timingFor(threatId, champion?.own);
  return items.length
    ? tr('coachEngine.threat.actionWithItems', { champion: champion.name, items: items.join(tr('coachEngine.or')), timing })
    : timing;
}

/**
 * Amenazas sin respuesta: el rival trae curación, mucho daño de un tipo, control,
 * burst, tanques o escudos, y la build no lo contesta. Requiere composición y build conocidas.
 */
export function detectThreatGaps(ctx) {
  const cards = [];
  THREATS.forEach(threat => {
    const rows = ctx.matches.filter(match => match.threats[threat.id] && match.threats[threat.id].answered !== null);
    if (rows.length < 5) return;
    const answeredRows = rows.filter(row => row.threats[threat.id].answered);
    const unansweredRows = rows.filter(row => !row.threats[threat.id].answered);
    const answerRate = answeredRows.length / rows.length;
    if (answerRate > 0.4 || unansweredRows.length < 4) return;
    const unanswered = summarize(unansweredRows);
    const answered = summarize(answeredRows);
    const threatStats = summarize(rows);
    // Solo es un problema si sin respuesta perdés: por debajo de tu base, o peor que cuando sí respondés.
    // Referencia justa: tu winrate en partidas con composición conocida y sin esta amenaza
    // (las partidas contra la amenaza son más difíciles de por sí).
    const calm = summarize(ctx.matches.filter(match => match.compKnown && !match.threats[threat.id]));
    const reference = calm.games >= 8 ? calm : ctx.base;
    const unansweredShrunk = shrunkRate(unanswered.wins, unanswered.games, reference.wr);
    const answeredShrunk = answered.games >= 2 ? shrunkRate(answered.wins, answered.games, reference.wr) : null;
    const belowBase = reference.wr - unansweredShrunk;
    const answerGain = answeredShrunk !== null ? answeredShrunk - unansweredShrunk : 0;
    const gainZ = answered.games >= 2 ? twoProportionZ(answered.wins, answered.games, unanswered.wins, unanswered.games) : 0;
    const champion = mainChampionOf(unansweredRows);
    // Un carry que no arma defensa contra daño físico o mágico suele estar priorizando
    // daño a propósito: solo se marca si sin esa respuesta pierde claramente.
    // Para él solo vale la comparación directa: con defensa contra sin defensa, en el mismo contexto.
    const carryDefense = champion?.own?.buildClass === 'carry' && ['physical', 'magic'].includes(threat.id);
    const losesWithout = !carryDefense && belowBase >= 0.05;
    // "Con respuesta ganás más" solo cuenta con volumen y una diferencia sólida.
    const winsWith = answered.games >= 5 && answerGain >= 0.12 && gainZ >= 1.2;
    if (!losesWithout && !winsWith) return;
    const z = answered.games >= 2 ? gainZ : twoProportionZ(reference.wins, reference.games, unanswered.wins, unanswered.games);

    cards.push(makeInsight({
      key: `threat-${threat.id}`,
      family: FAMILY.BUILD,
      tone: 'critical',
      title: tr(`coachEngine.threat.${threat.id}.title`),
      thesis: tr('coachEngine.threat.thesis', {
        games: threatStats.games,
        threat: tr(`coachEngine.threat.${threat.id}.present`),
        answer: tr(`coachEngine.threat.${threat.id}.answer`),
        answered: answeredRows.length,
        wrUnanswered: pct(unanswered.wr),
        gamesUnanswered: unanswered.games,
        withAnswer: answered.games >= 2
          ? tr('coachEngine.threat.withAnswer', { wr: pct(answered.wr), games: answered.games })
          : '',
      }),
      action: threatAdvice(ctx, threat.id, champion),
      evidence: [
        tr('coachEngine.threat.evidenceRate', { answer: tr(`coachEngine.threat.${threat.id}.answer`), rate: pct(answerRate), games: rows.length }),
        tr('coachEngine.threat.evidenceWithout', { wr: pct(unanswered.wr), games: unanswered.games }),
        answered.games >= 2 && tr('coachEngine.threat.evidenceWith', { wr: pct(answered.wr), games: answered.games }),
      ],
      z, sample: rows.length, corroborated: true,
      priority: THREAT_PRIORITY[threat.id] ?? 70,
      impact: unanswered.losses * 2,
      entities: [champion?.name],
      track: { kind: 'threatAnswer', threat: threat.id },
    }));
  });
  return cards;
}

/** Disparadores de runa clave que encajan con cada forma de hacer daño. */
const ABILITY_TRIGGERS = ['impacto_habilidad', 'impacto_campeon', 'trade_corto', 'golpes_multiples', 'lanzar_ulti'];
const AUTO_TRIGGERS = ['autoataque', 'golpes_consecutivos', 'golpes_mismo_objetivo', 'combate_extendido', 'impacto_campeon'];

/**
 * true si la runa clave encaja, false si choca y null si no se puede juzgar.
 * Choca: una runa que solo se activa con autoataques en un campeón de habilidades, o una
 * que solo se activa con habilidades en un campeón de autoataques.
 */
export function keystoneFits(own, keystone) {
  if (!own || !keystone || !keystone.triggers.size) return null;
  const triggers = [...keystone.triggers];
  if (own.abilityBased) return !(triggers.includes('autoataque') && !triggers.some(tag => ABILITY_TRIGGERS.includes(tag)));
  if (own.autoAttacker) {
    const abilityOnly = triggers.every(tag => ['impacto_habilidad', 'lanzar_ulti'].includes(tag));
    return !abilityOnly;
  }
  return null;
}

/** Runa clave que no encaja con el campeón (por ejemplo, una de autoataques en un mago). */
export function detectRuneFit(ctx) {
  const byChampion = new Map();
  ctx.matches.forEach(match => {
    if (!match.own || !match.keystone) return;
    if (!byChampion.has(match.championKey)) byChampion.set(match.championKey, []);
    byChampion.get(match.championKey).push(match);
  });
  const cards = [];
  byChampion.forEach(rows => {
    const misfit = rows.filter(row => keystoneFits(row.own, row.keystone) === false);
    if (misfit.length < 3) return;
    const own = rows[0].own;
    const fitting = rows.filter(row => keystoneFits(row.own, row.keystone) === true);
    const misfitStats = summarize(misfit);
    const fittingStats = summarize(fitting);
    const wanted = own.abilityBased ? ABILITY_TRIGGERS : AUTO_TRIGGERS;
    // Runa clave sugerida: la que mejor le fue con ese campeón entre las que encajan, o la primera del catálogo.
    const usedFitting = [...new Set(fitting.map(row => row.keystone.name))];
    const catalogFitting = ctx.catalog.runes.rows
      .map(row => ctx.catalog.rune(row.name))
      .filter(rune => rune?.keystone && [...rune.triggers].some(tag => wanted.includes(tag)))
      .map(rune => rune.name);
    const suggestion = usedFitting[0] || catalogFitting[0];
    if (!suggestion) return;
    const misfitKeystone = misfit[0].keystone.name;
    cards.push(makeInsight({
      key: `runes-${keyOf(own.name)}`,
      family: FAMILY.RUNES,
      tone: 'warning',
      title: tr('coachEngine.runes.title', { champion: own.name, keystone: misfitKeystone }),
      thesis: tr(own.abilityBased ? 'coachEngine.runes.thesisAbility' : 'coachEngine.runes.thesisAuto', {
        champion: own.name, keystone: misfitKeystone, games: misfit.length, wr: pct(misfitStats.wr),
        comparison: fittingStats.games >= 2 ? tr('coachEngine.runes.comparison', { wr: pct(fittingStats.wr), games: fittingStats.games }) : '',
      }),
      action: tr('coachEngine.runes.action', { champion: own.name, suggestion }),
      evidence: [
        tr('coachEngine.runes.evidenceMisfit', { keystone: misfitKeystone, wr: pct(misfitStats.wr), games: misfit.length }),
        fittingStats.games >= 2 && tr('coachEngine.runes.evidenceFit', { wr: pct(fittingStats.wr), games: fittingStats.games }),
      ],
      z: fittingStats.games >= 2 ? twoProportionZ(fittingStats.wins, fittingStats.games, misfitStats.wins, misfitStats.games) : 0.5,
      sample: rows.length, corroborated: true, priority: 60, impact: misfitStats.losses,
      entities: [own.name],
    }));
  });
  return cards.sort((a, b) => b.score - a.score).slice(0, 1);
}
