// Composiciones: cómo te va a vos contra ciertos tipos de equipo rival (pick, engage
// fuerte, poke) o cuando a tu equipo le falta primera línea, cruzando el rol en la pelea
// (team_roles) y los puntajes 0-5 del catálogo. El draft no depende del jugador (solo
// elige su campeón), así que el consejo nunca es "armá otra composición": es cómo jugar,
// posicionarte o armar vos contra esa composición.
import { tr } from '../../../i18n/uiI18n.js';
import { FAMILY, makeInsight } from '../card.js';
import { keyOf, suggestItems } from '../catalog.js';
import { fixed, pct, shrunkRate, summarize, twoProportionZ } from '../stats.js';
import { championsLabel } from './build.js';
import { isFrontline } from './buildReview.js';

/** Partidas mínimas con el patrón y sin él para comparar. */
const MIN_GAMES = 5;
/** Aliados reconocidos mínimos para afirmar que "tu equipo no tenía primera línea". */
const MIN_ALLIES = 3;

const ranked = profile => profile.scores || {};
const DAMAGE = ['dano fisico', 'dano magico'];
const isDamageItem = item => item.types.some(type => DAMAGE.includes(type));
/** Defensa para quien aguanta adelante. */
const resistAnswer = item => item.types.includes('defensa') || item.armor || item.magicRes;
/** Objeto de daño que también defiende (lo que arma un carry para sobrevivir). */
const guardAnswer = item => isDamageItem(item)
  && (['anti_burst', 'revivir', 'invulnerabilidad', 'escudo_hechizo', 'reduccion_dano'].some(tag => item.effects.has(tag)) || item.armor || item.magicRes);

/**
 * Patrones de composición. `members(match)` devuelve los campeones que lo forman (null si
 * no está); `eligible(match)` dice si la partida sirve para comparar; `appliesTo(own)` a
 * qué campeón propio le corresponde; `metric`: muertes (el patrón te hace morir más) o
 * winrate. `variant(own)` elige el texto del consejo según cómo juega tu campeón.
 */
const PATTERNS = [
  {
    id: 'pick',
    metric: 'deaths',
    priority: 76,
    members: match => match.enemyProfiles.filter(enemy => enemy.teamRoles.has('pick')),
    min: 2,
    eligible: match => match.compKnown && match.hasKda,
    appliesTo: () => true,
    variant: own => (own.isTank ? 'tank' : own.buildClass === 'support' ? 'support' : 'carry'),
  },
  {
    id: 'engage',
    metric: 'deaths',
    priority: 74,
    // Inician fuerte (engage 4 o 5): Malphite, Amumu, Leona.
    members: match => match.enemyProfiles.filter(enemy => (ranked(enemy).engage ?? 0) >= 4),
    min: 2,
    eligible: match => match.compKnown && match.hasKda,
    // Les pesa a los carries y a los supports que no inician: al que entra primero o
    // aguanta adelante, que lo inicien es parte de su trabajo.
    appliesTo: own => (own.buildClass === 'carry' && !isFrontline(own))
      || (own.buildClass === 'support' && own.supportStyle !== 'engage'),
    variant: own => (own.buildClass === 'support' ? 'support' : 'carry'),
  },
  {
    id: 'poke',
    metric: 'wr',
    priority: 70,
    // Poke de verdad: rol poke y mucho alcance (Ziggs, Vel'Koz, Jayce).
    members: match => match.enemyProfiles.filter(enemy => enemy.teamRoles.has('poke') && (ranked(enemy).range ?? 0) >= 4),
    min: 2,
    eligible: match => match.compKnown,
    // Le pesa al que pelea cuerpo a cuerpo y tiene que caminar para llegar.
    appliesTo: own => own.traits.has('melee') && own.buildClass !== 'support',
    variant: () => 'melee',
  },
  {
    id: 'noFrontline',
    metric: 'wr',
    priority: 72,
    members: match => (match.allyProfiles.some(isFrontline) ? null : []),
    min: 0,
    eligible: match => match.allyProfiles.length >= MIN_ALLIES,
    // Si tu campeón ya es la primera línea, a tu equipo no le falta.
    appliesTo: own => !isFrontline(own) && own.buildClass !== 'support',
    variant: own => (own.buildClass === 'carry' ? 'carry' : 'fighter'),
    answers: { carry: guardAnswer, fighter: resistAnswer },
  },
];

const present = (pattern, match) => {
  const members = pattern.members(match);
  return members && members.length >= pattern.min ? members : null;
};

/**
 * Diferencia de medias en desvíos estándar (z de Welch). La varianza tiene un piso de 1
 * muerte²: con pocas partidas casi iguales, una varianza cercana a 0 daría certezas falsas.
 */
function meanZ(a, b) {
  const stats = rows => {
    const mean = rows.reduce((sum, row) => sum + row.deaths, 0) / rows.length;
    const variance = Math.max(1, rows.reduce((sum, row) => sum + (row.deaths - mean) ** 2, 0) / Math.max(1, rows.length - 1));
    return { mean, variance };
  };
  const x = stats(a);
  const y = stats(b);
  const se = Math.sqrt(x.variance / a.length + y.variance / b.length);
  return { present: x.mean, absent: y.mean, z: se ? (x.mean - y.mean) / se : 0 };
}

/** Los campeones rivales que más formaron el patrón ("Thresh, Blitzcrank y Pyke"). */
function frequentMembers(pattern, rows) {
  const counts = new Map();
  rows.forEach(row => (present(pattern, row) || []).forEach(champ => counts.set(champ.name, (counts.get(champ.name) || 0) + 1)));
  const names = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([name]) => name);
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')}${tr('coachEngine.and')}${names.at(-1)}`;
}

/** Campeón propio más jugado en las partidas con el patrón. */
function mainOf(rows) {
  const counts = new Map();
  rows.forEach(row => {
    const entry = counts.get(row.championKey) || { own: row.own, games: 0 };
    entry.games += 1;
    counts.set(row.championKey, entry);
  });
  return [...counts.values()].sort((a, b) => b.games - a.games)[0]?.own || null;
}

function evaluate(ctx, pattern) {
  const rows = ctx.matches.filter(match => match.own && pattern.appliesTo(match.own) && pattern.eligible(match));
  const withRows = rows.filter(row => present(pattern, row));
  const withoutRows = rows.filter(row => !present(pattern, row));
  if (withRows.length < MIN_GAMES || withoutRows.length < MIN_GAMES) return null;
  const withStats = summarize(withRows);
  const withoutStats = summarize(withoutRows);

  let numbers;
  if (pattern.metric === 'deaths') {
    const deaths = meanZ(withRows, withoutRows);
    // Morir de más contra ese equipo: al menos 1,5 muertes más por partida y una diferencia sólida.
    if (deaths.present - deaths.absent < 1.5 || deaths.z < 1.3) return null;
    numbers = { z: deaths.z, present: fixed(deaths.present), absent: fixed(deaths.absent), impact: withStats.losses };
  } else {
    const gap = shrunkRate(withoutStats.wins, withoutStats.games, ctx.base.wr) - shrunkRate(withStats.wins, withStats.games, ctx.base.wr);
    const z = twoProportionZ(withoutStats.wins, withoutStats.games, withStats.wins, withStats.games);
    if (gap < 0.12 || z < 1.2) return null;
    numbers = { z, present: pct(withStats.wr), absent: pct(withoutStats.wr), impact: withStats.losses };
  }

  const own = mainOf(withRows);
  const variant = pattern.variant(own);
  const names = frequentMembers(pattern, withRows);
  const answers = pattern.answers?.[variant];
  const habits = ctx.buildHabits?.get(keyOf(own.name)) || { bought: new Set(), damageTypes: [] };
  const example = answers
    ? suggestItems(ctx.catalog, own, answers, { boughtKeys: habits.bought, preferredTypes: habits.damageTypes, limit: 1 })[0]
    : null;
  const base = `coachEngine.comp.${pattern.id}`;
  const vars = {
    champions: championsLabel(withRows), names, games: withRows.length, gamesOther: withoutRows.length,
    present: numbers.present, absent: numbers.absent,
  };
  return makeInsight({
    key: `comp-${pattern.id}`,
    family: FAMILY.COMP,
    tone: 'warning',
    title: tr(`${base}.title`),
    thesis: tr(`${base}.thesis`, vars),
    action: [
      tr(`${base}.action.${variant}`, { names, champion: own.name }),
      example && tr('coachEngine.comp.example', { item: example }),
    ].filter(Boolean).join(' '),
    evidence: [
      tr(`coachEngine.comp.evidence.${pattern.metric}`, { label: tr(`${base}.label`), value: numbers.present, games: withRows.length }),
      tr(`coachEngine.comp.evidence.${pattern.metric}Other`, { value: numbers.absent, games: withoutRows.length }),
    ],
    z: numbers.z, sample: rows.length, corroborated: true,
    priority: pattern.priority, impact: numbers.impact,
    entities: [own.name],
  });
}

/**
 * Tipos de composición contra (o con) los que te va peor: morís más contra equipos de
 * pick o de engage fuerte, perdés más contra poke siendo cuerpo a cuerpo, o cuando tu
 * equipo no tiene primera línea. Requiere el rol en la pelea y los puntajes del catálogo.
 */
export function detectCompPlans(ctx) {
  return PATTERNS.map(pattern => evaluate(ctx, pattern)).filter(Boolean).sort((a, b) => b.score - a.score);
}
