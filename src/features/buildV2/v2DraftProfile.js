// Perfil del draft para Build V2, calculado del catálogo antes de llamar a la IA: qué
// señales trae el rival (en el vocabulario de `counters` de runas y hechizos), qué le falta
// a tu equipo y qué cubre tu campeón, y qué runas y hechizos encajan con tu clase, tu
// línea y esas señales. Solo describe a los campeones cargados (el draft puede estar
// incompleto) y siempre se usa como evidencia, no como instrucción.

const normalize = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const asList = value => (Array.isArray(value) ? value : value == null || value === '' ? [] : [value]);
const tags = value => new Set(asList(value).map(normalize));
const score = (champion, key) => {
  const value = champion?.[`score_${key}`];
  return value === null || value === undefined || value === '' ? null : Number(value);
};
const atLeast = (champion, key, min) => (score(champion, key) ?? -1) >= min;

const CC_TRAITS = ['cc_duro', 'stun', 'root', 'supresion', 'encanto', 'provocacion', 'miedo'];
const HEAL_TRAITS = ['autocuracion', 'curacion_aliada', 'dependiente_robo_vida'];

const isTank = champion => tags(champion.roles).has('tanque') || tags(champion.traits).has('alta_durabilidad');
const isFrontline = champion => isTank(champion) || tags(champion.team_roles).has('frontline');
const isPeeler = champion => (score(champion, 'peel') != null
  ? atLeast(champion, 'peel', 3)
  : isTank(champion) || tags(champion.roles).has('soporte'));

/**
 * Señales del rival, con los nombres de `counters` (poke, desgaste, burst, asesinos,
 * divers, cc, curacion, escudos, tanques) más pick y engage, que no tienen runa propia
 * pero cambian cómo se juega. `min`: cuántos rivales hacen falta para que cuente.
 */
const ENEMY_SIGNALS = [
  { signal: 'divers', min: 2, test: c => !isTank(c) && (tags(c.team_roles).size ? tags(c.team_roles).has('diver') : tags(c.roles).has('asesino')) },
  { signal: 'asesinos', min: 1, test: c => tags(c.roles).has('asesino') },
  { signal: 'burst', min: 2, test: c => atLeast(c, 'burst', 4) },
  { signal: 'poke', min: 2, test: c => tags(c.team_roles).has('poke') && atLeast(c, 'range', 4) },
  { signal: 'desgaste', min: 2, test: c => atLeast(c, 'sustained_damage', 4) },
  { signal: 'cc', min: 2, test: c => CC_TRAITS.some(tag => tags(c.traits).has(tag)) },
  { signal: 'curacion', min: 2, test: c => HEAL_TRAITS.some(tag => tags(c.traits).has(tag)) },
  { signal: 'escudos', min: 2, test: c => tags(c.traits).has('escudo_aliado') },
  { signal: 'tanques', min: 2, test: isTank },
  { signal: 'pick', min: 2, test: c => tags(c.team_roles).has('pick') },
  { signal: 'engage', min: 2, test: c => atLeast(c, 'engage', 4) },
];

/** Daño de un tipo (los híbridos cuentan medio) desde el que es señal para counters. */
const MIN_DAMAGE_SIDE = 2;

/** Aliados cargados (sin tu campeón) mínimos para afirmar que a tu equipo le falta algo. */
const MIN_ALLIES = 3;

/** Qué puede faltarle a tu equipo y si tu campeón lo cubre. */
const TEAM_NEEDS = [
  { need: 'primera_linea', test: isFrontline },
  { need: 'peel', test: isPeeler },
  { need: 'engage', test: c => atLeast(c, 'engage', 4) },
];

/** Clases de `fits_classes` que corresponden al campeón (y "soporte" si juega de support). */
export function championClasses(champion, role) {
  const classes = new Set([...tags(champion?.roles)].filter(value => ['tirador', 'mago', 'asesino', 'luchador', 'tanque', 'soporte'].includes(value)));
  if (normalize(role) === 'support') classes.add('soporte');
  return classes;
}

/**
 * @param {{ champion: any, role: string, allies: any[], enemies: any[] }} input  allies sin tu campeón.
 */
export function buildDraftProfile({ champion, role, allies = [], enemies = [] }) {
  const names = list => list.map(entry => String(entry.name ?? '').trim());
  const enemySignals = ENEMY_SIGNALS
    .map(({ signal, min, test }) => ({ signal, champions: names(enemies.filter(test)), min }))
    .filter(entry => entry.champions.length >= entry.min)
    .map(({ signal, champions }) => ({ signal, champions }));
  const allyGaps = [];
  const selectedCovers = [];
  if (allies.length >= MIN_ALLIES) {
    TEAM_NEEDS.forEach(({ need, test }) => {
      if (allies.some(test)) return;
      if (champion && test(champion)) selectedCovers.push(need);
      else allyGaps.push(need);
    });
  }
  // Daño físico y mágico del rival (los híbridos cuentan la mitad de cada uno).
  const side = c => normalize(c.damage_type);
  const enemyDamage = {
    physical: enemies.reduce((sum, c) => sum + (side(c) === 'ad' ? 1 : side(c) === 'hybrid' ? 0.5 : 0), 0),
    magic: enemies.reduce((sum, c) => sum + (side(c) === 'ap' ? 1 : side(c) === 'hybrid' ? 0.5 : 0), 0),
  };
  // Señales por tipo de daño (counters daño_magico / daño_fisico): desde 2 de ese daño.
  if (enemyDamage.magic >= MIN_DAMAGE_SIDE) enemySignals.push({ signal: 'daño_magico', champions: names(enemies.filter(c => ['ap', 'hybrid'].includes(side(c)))) });
  if (enemyDamage.physical >= MIN_DAMAGE_SIDE) enemySignals.push({ signal: 'daño_fisico', champions: names(enemies.filter(c => ['ad', 'hybrid'].includes(side(c)))) });
  return {
    selected_team_roles: asList(champion?.team_roles),
    enemy_signals: enemySignals,
    enemy_damage: enemyDamage,
    ally_gaps: allyGaps,
    selected_covers: selectedCovers,
  };
}

/** Señales que pueden responder runas y hechizos (las de `counters`). */
export const signalSet = profile => new Set(profile.enemy_signals.map(entry => normalize(entry.signal)));

/**
 * Qué tan bien encaja una runa o un hechizo: su clase, su línea (solo hechizos) y a cuántas
 * señales del rival responde. Sin datos cargados, neutro.
 */
export function fitOf(entity, { classes, lane, signals }) {
  const fitsClasses = tags(entity?.fits_classes);
  const fitsLanes = tags(entity?.fits_lanes);
  const answers = [...tags(entity?.counters)].filter(tag => signals.has(tag));
  return {
    fitsClass: fitsClasses.size ? [...classes].some(value => fitsClasses.has(value)) : null,
    fitsLane: fitsLanes.size && lane ? fitsLanes.has(normalize(lane)) : null,
    answers,
  };
}

/**
 * Pistas para la IA: runas y hechizos de tu clase (y línea) que responden a las señales del
 * rival, las que más responden primero. Es una ayuda para buscar, no una lista cerrada.
 */
export function fitHints(snapshot, { champion, role, profile, limit = 8 }) {
  const context = { classes: championClasses(champion, role), lane: role, signals: signalSet(profile) };
  const hint = entity => ({ id: String(entity.id), ...fitOf(entity, context) });
  const rank = list => list
    .map(hint)
    .filter(entry => entry.fitsClass !== false && entry.fitsLane !== false && entry.answers.length)
    .sort((a, b) => b.answers.length - a.answers.length)
    .slice(0, limit)
    .map(({ id, answers }) => ({ id, answers }));
  return { runes: rank(snapshot.runes || []), spells: rank(snapshot.spells || []) };
}

/** Contexto de encaje para el estabilizador (cuando tiene que completar una pieza). */
export function draftFitContext({ snapshot, championId, role, allies = {}, enemies = {} }) {
  const byId = new Map((snapshot?.champions || []).map(entry => [String(entry.id), entry]));
  const champion = byId.get(String(championId));
  const pick = team => Object.entries(team).filter(([lane, id]) => id && String(id) !== String(championId)).map(([, id]) => byId.get(String(id))).filter(Boolean);
  const profile = buildDraftProfile({ champion, role, allies: pick(allies), enemies: pick(enemies) });
  return { classes: championClasses(champion, role), lane: role, signals: signalSet(profile), profile, champion };
}
