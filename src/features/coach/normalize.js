// Normaliza las partidas para el Coach y les agrega lo que se deduce del catálogo:
// perfil del campeón propio y del rival directo, amenazas de la composición rival y
// qué respuestas tuvo la build.
import { THREATS, asList, inLane, keyOf, observedBuildClass, withBuildClass } from './catalog.js';

const LANE_ALIASES = {
  adc: 'adc', bot: 'adc', bottom: 'adc', dragonline: 'adc', dragonlane: 'adc', duo: 'adc',
  mid: 'mid', middle: 'mid', top: 'top', baron: 'top', baronlane: 'top',
  support: 'support', supp: 'support', jungle: 'jungler', jungler: 'jungler', jungla: 'jungler',
};

export const laneOf = value => {
  const raw = keyOf(value).replace(/\s+/g, '');
  return LANE_ALIASES[raw] || raw || null;
};

/** Número no negativo o null si no se registró. */
const countOf = value => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

function timestampOf(match) {
  const date = String(match?.date ?? '').slice(0, 10);
  const hour = String(match?.hour ?? '').slice(0, 5);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const value = new Date(`${date}T${/^\d{2}:\d{2}$/.test(hour) ? hour : '12:00'}:00`).getTime();
    if (Number.isFinite(value)) return { time: value, hasHour: /^\d{2}:\d{2}$/.test(hour) };
  }
  const fallback = new Date(match?.created_at || 0).getTime() || 0;
  return { time: fallback, hasHour: Boolean(fallback) };
}

const unique = values => {
  const seen = new Set();
  return values.filter(value => {
    const key = keyOf(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Amenazas de la composición rival que le tocan responder a este campeón (según su clase)
 * y si la build las respondió. Se recalculan si cambia la clase (ver `withOwn`).
 */
export function assessThreats({ own, enemyProfiles, itemProfiles, compKnown, buildKnown, itemSlots = itemProfiles.length }) {
  const threats = {};
  if (!compKnown) return threats;
  THREATS.forEach(threat => {
    const count = threat.count(enemyProfiles);
    const min = typeof threat.min === 'function' ? threat.min(own) : threat.min;
    if (count < min || !threat.appliesTo(own)) return;
    // Solo cuentan objetos terminados (y botas donde son respuesta): un componente camino a
    // Zhonya no es "armaste armadura".
    const hasAnswer = itemProfiles.some(item => (item.final || (threat.boots && item.boots)) && threat.answers(item, own));
    // Sin la respuesta pero con slots libres antes de cuando le toca: pudo venir después
    // (la partida terminó antes), así que no se cuenta como que faltó.
    const due = itemSlots >= threat.dueBy(own);
    threats[threat.id] = {
      count,
      answered: !buildKnown ? null : hasAnswer ? true : due ? false : null,
    };
  });
  return threats;
}

/** La misma partida con otro perfil del campeón propio (y sus amenazas recalculadas). */
export function withOwn(row, own) {
  if (row.own === own) return row;
  return { ...row, own, threats: assessThreats({ ...row, own }) };
}

/**
 * Ajusta la clase del campeón a lo que el jugador arma con él en cada línea (picks
 * exóticos: Malphite mid full AP, Leona top tanque). Sin builds suficientes, manda la línea.
 */
export function applyObservedClasses(rows) {
  const groups = new Map();
  rows.forEach(row => {
    if (!row.own || !row.championKey) return;
    const key = `${row.championKey}|${row.lane || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  const adjusted = new Map();
  groups.forEach(group => {
    const observed = observedBuildClass(group[0].own, group);
    if (!observed) return;
    const own = withBuildClass(group[0].own, observed);
    group.forEach(row => adjusted.set(row, withOwn(row, own)));
  });
  return adjusted.size ? rows.map(row => adjusted.get(row) || row) : rows;
}

/**
 * @param {any} match  Fila de `matches`.
 * @param {ReturnType<import('./catalog.js').buildCatalog>} catalog
 */
export function normalizeMatch(match, catalog) {
  const { time, hasHour } = timestampOf(match);
  const champion = String(match.own_champion_name || match.champion_name || '').trim() || null;
  const enemy = String(match.enemy_champion_name || '').trim() || null;
  const enemies = unique([...asList(match.enemy_champions), enemy].filter(Boolean))
    .filter(name => keyOf(name) !== keyOf(champion));
  const allies = unique(asList(match.ally_champions)).filter(name => keyOf(name) !== keyOf(champion));
  const result = keyOf(match.result);
  const kills = countOf(match.kills);
  const deaths = countOf(match.deaths);
  const assists = countOf(match.assists);
  const hasKda = kills !== null && deaths !== null && assists !== null;
  const duration = countOf(match.duration_minutes) || null;
  const gold = countOf(match.gold) || null;
  const teamKills = countOf(match.team_kills);
  const enemyKills = countOf(match.enemy_team_kills);

  const lane = laneOf(match.lane);
  // Perfil según la línea: en support, Leona o Lux juegan (y arman) como supports.
  const own = inLane(catalog.champion(champion, match.own_champion_id), lane);
  const enemyProfiles = enemies.map(name => catalog.champion(name)).filter(Boolean);
  const allyProfiles = allies.map(name => catalog.champion(name)).filter(Boolean);
  const items = asList(match.items_used).map(name => String(name).trim()).filter(Boolean);
  const itemProfiles = items.map(name => catalog.item(name)).filter(Boolean);
  const runes = unique(asList(match.runes_used));
  const keystone = runes.map(name => catalog.rune(name)).find(rune => rune?.keystone) || null;

  // Amenazas solo con la composición rival completa (o casi): con 1-2 rivales cargados
  // no se puede afirmar que "no había curadores".
  const compKnown = enemyProfiles.length >= 4;
  // La build cuenta como conocida desde 3 objetos reconocidos: antes la partida pudo
  // terminar sin llegar a comprar la respuesta.
  const buildKnown = itemProfiles.length >= 3;
  // Slots ocupados por objetos (las botas y los encantamientos van aparte).
  const itemSlots = items.length - itemProfiles.filter(item => item.types.some(type => ['movimiento', 'encantamiento'].includes(type))).length;
  const threats = assessThreats({ own, enemyProfiles, itemProfiles, compKnown, buildKnown, itemSlots });

  return {
    raw: match,
    id: String(match.id ?? `${time}-${champion}`),
    time,
    hasHour,
    day: String(match.date || '').slice(0, 10) || null,
    type: match.type || 'ranked',
    result: result === 'win' || result === 'loss' ? result : null,
    won: result === 'win',
    champion,
    championKey: keyOf(champion),
    own,
    lane,
    enemy,
    enemyKey: keyOf(enemy),
    enemyProfile: enemy ? catalog.champion(enemy) : null,
    enemies,
    enemyProfiles,
    allies,
    allyProfiles,
    items,
    itemKeys: new Set(items.map(keyOf)),
    itemProfiles,
    buildKnown,
    itemSlots,
    compKnown,
    threats,
    runes,
    keystone,
    kills,
    deaths,
    assists,
    hasKda,
    kda: hasKda ? (deaths ? (kills + assists) / deaths : kills + assists) : null,
    duration,
    gold,
    goldPerMinute: gold && duration ? gold / duration : null,
    teamKills,
    enemyKills,
    // Participación en asesinatos y parte de las muertes del equipo (requiere kills de equipo).
    killParticipation: hasKda && teamKills ? Math.min(1, (kills + assists) / teamKills) : null,
    deathShare: hasKda && enemyKills ? Math.min(1, deaths / enemyKills) : null,
  };
}

/**
 * Partidas normalizadas, más reciente primero. Las que no tienen resultado se descartan.
 * La clase del campeón sale de la línea y, si alcanza, de lo que el jugador arma.
 */
export function normalizeMatches(matches, catalog) {
  const rows = (matches || [])
    .map(match => normalizeMatch(match, catalog))
    .filter(match => match.result)
    .sort((a, b) => b.time - a.time);
  return applyObservedClasses(rows);
}
