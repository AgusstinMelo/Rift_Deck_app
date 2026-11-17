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

/** Variante del texto de timing según cómo arma el campeón. */
const TIMING_VARIANT = { carry: 'timingCarry', tank: 'timingTank', support: 'timingSupport' };

/**
 * Texto de cuándo y cómo responder. Cada clase tiene el suyo si hace falta: el carry no
 * cambia daño por defensa pura, el tanque entra primero y el support protege a su equipo.
 */
function timingFor(threatId, own) {
  const variant = TIMING_VARIANT[own?.buildClass];
  const key = variant && `coachEngine.threat.${threatId}.${variant}`;
  if (key && lookup(baseMessages, key)) return tr(key);
  return tr(`coachEngine.threat.${threatId}.timing`);
}

/** Texto de la respuesta a una amenaza con objetos sugeridos para un campeón. */
export function threatAdvice(ctx, threatId, champion) {
  const threat = THREATS.find(entry => entry.id === threatId);
  const habits = ctx.buildHabits.get(keyOf(champion?.name)) || { bought: new Set(), damageTypes: [] };
  const items = champion?.own
    ? suggestItems(ctx.catalog, champion.own, threat.answers, { boughtKeys: habits.bought, preferredTypes: habits.damageTypes, boots: Boolean(threat.boots) })
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

/**
 * Runa de velocidad de ataque: se carga con golpes consecutivos de autoataque (Cadencia
 * Letal, Potenciación). Conquistador también usa golpes consecutivos, pero se carga con
 * habilidades en un combate largo, así que no cuenta.
 */
const isAttackSpeedKeystone = rune => rune.triggers.has('golpes_consecutivos')
  && (rune.triggers.has('autoataque') || !rune.triggers.has('combate_extendido'));

/** Runa que solo se activa con habilidades (Cometa Arcano). */
const isAbilityOnlyKeystone = rune => rune.triggers.has('impacto_habilidad') && !rune.triggers.has('autoataque')
  && !['golpes_consecutivos', 'golpes_multiples', 'combate_extendido'].some(tag => rune.triggers.has(tag));

/**
 * true si la runa clave encaja, false si choca y null si no se puede juzgar.
 * Choca: una runa de velocidad de ataque en un campeón de habilidades (Cadencia Letal en
 * un mago), o una que solo se activa con habilidades en uno de autoataques (Cometa Arcano
 * en Jinx). Los tanques no se juzgan: Agarre del Perpetuo, Guardián o Soberano del Hielo
 * les sirven igual.
 */
export function keystoneFits(own, keystone) {
  if (!own || !keystone || !keystone.triggers.size || own.isTank) return null;
  if (own.abilityBased) return !isAttackSpeedKeystone(keystone);
  if (own.autoAttacker) return !isAbilityOnlyKeystone(keystone);
  return null;
}

/** Runas clave del catálogo que encajan con el campeón, las más afines primero. */
function fittingKeystones(ctx, own) {
  const preferred = rune => (own.abilityBased ? isAbilityOnlyKeystone(rune) : isAttackSpeedKeystone(rune));
  return ctx.catalog.runes.rows
    .map(row => ctx.catalog.rune(row.name))
    .filter(rune => rune?.keystone && keystoneFits(own, rune) === true)
    .sort((a, b) => Number(preferred(b)) - Number(preferred(a)))
    .map(rune => rune.name);
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
    // Runa clave sugerida: la que mejor le fue con ese campeón entre las que encajan, o la más afín del catálogo.
    const usedFitting = [...groupBy(fitting, row => row.keystone.name)]
      .map(([name, keystoneRows]) => ({ name, stats: summarize(keystoneRows) }))
      .sort((a, b) => b.stats.wins - a.stats.wins || b.stats.games - a.stats.games)
      .map(entry => entry.name);
    const suggestion = usedFitting[0] || fittingKeystones(ctx, own)[0];
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

/** Objetos de una build guardada (nombres sin repetir). */
const buildItems = build => [...new Set((build?.items || []).map(name => String(name).trim()).filter(Boolean))];

/**
 * Tus builds guardadas: con un mismo campeón, una build vinculada a tus partidas rinde
 * claramente más que otra. Requiere 4 partidas por build y una diferencia sólida.
 */
export function detectSavedBuilds(ctx) {
  if (!ctx.builds?.length) return [];
  const byId = new Map(ctx.builds.map(build => [String(build.id), build]));
  const linked = ctx.matches.filter(match => match.raw.build_id != null && byId.has(String(match.raw.build_id)));
  const cards = [];
  groupBy(linked.filter(match => match.championKey), match => match.championKey).forEach(rows => {
    const prior = summarize(rows).wr;
    const groups = [...groupBy(rows, row => String(row.raw.build_id))]
      .map(([id, buildRows]) => ({ build: byId.get(id), stats: summarize(buildRows) }))
      .filter(group => group.stats.games >= 4)
      .map(group => ({ ...group, shrunk: shrunkRate(group.stats.wins, group.stats.games, prior) }))
      .sort((a, b) => b.shrunk - a.shrunk);
    if (groups.length < 2) return;
    const best = groups[0];
    const worst = groups[groups.length - 1];
    const gap = best.shrunk - worst.shrunk;
    const z = twoProportionZ(best.stats.wins, best.stats.games, worst.stats.wins, worst.stats.games);
    if (gap < 0.12 || z < 1) return;

    const champion = rows[0].champion;
    const bestItems = buildItems(best.build);
    const worstItems = buildItems(worst.build);
    const onlyBest = bestItems.filter(name => !worstItems.some(other => keyOf(other) === keyOf(name))).slice(0, 3);
    const onlyWorst = worstItems.filter(name => !bestItems.some(other => keyOf(other) === keyOf(name))).slice(0, 3);
    const names = { best: best.build.name, worst: worst.build.name };

    cards.push(makeInsight({
      key: `saved-build-${keyOf(champion)}-${best.build.id}`,
      family: FAMILY.SAVED_BUILD,
      tone: 'opportunity',
      title: tr('coachEngine.savedBuild.title', { champion, best: names.best }),
      thesis: tr('coachEngine.savedBuild.thesis', {
        champion, ...names,
        wrBest: pct(best.stats.wr), gamesBest: best.stats.games,
        wrWorst: pct(worst.stats.wr), gamesWorst: worst.stats.games,
        diff: onlyBest.length && onlyWorst.length
          ? tr('coachEngine.savedBuild.diff', { ...names, onlyBest: onlyBest.join(', '), onlyWorst: onlyWorst.join(', ') })
          : '',
      }),
      action: tr('coachEngine.savedBuild.action', { champion, ...names }),
      evidence: [
        tr('coachEngine.savedBuild.evidence', { name: names.best, wr: pct(best.stats.wr), games: best.stats.games }),
        tr('coachEngine.savedBuild.evidence', { name: names.worst, wr: pct(worst.stats.wr), games: worst.stats.games }),
      ],
      z, sample: best.stats.games + worst.stats.games, corroborated: true,
      priority: 72, impact: worst.stats.losses,
      entities: [champion],
    }));
  });
  return cards.sort((a, b) => b.score - a.score).slice(0, 1);
}
