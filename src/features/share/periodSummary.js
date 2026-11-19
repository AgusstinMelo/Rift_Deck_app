// Resumen de un período para la tarjeta compartible ("Mi semana en Rift Deck").
// Funciones puras: sin React ni base de datos (se testean en test/share).
import { averageMatchKda, matchKda } from '../../domain/matchStats.js';
import { getPatchGroup } from '../../utils/patches.js';

/** Períodos de la tarjeta: últimos 7 o 30 días, o el parche activo completo (7.3 incluye 7.3, 7.3b, 7.3f...). */
export const SHARE_PERIODS = ['week', 'month', 'patch'];

const DAY_MS = 24 * 3600 * 1000;
const isoDay = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dayOf = match => String(match?.date || match?.created_at || '').slice(0, 10);
const isResult = match => match?.result === 'win' || match?.result === 'loss';
const hasKda = match => [match.kills, match.deaths, match.assists].every(value => value !== null && value !== undefined && value !== '');

/**
 * Partidas del período y sus límites.
 * @param {any[]} matches
 * @param {{ period: 'week'|'month'|'patch', now?: Date, patch?: string, types?: string[] }} options
 *   `types`: tipos de partida incluidos (ranked, legendary_ranked, casual). Vacío o sin
 *   indicar, todos.
 * @returns {{ rows: any[], from: string|null, to: string|null }}
 */
export function matchesInPeriod(matches, { period, now = new Date(), patch = '', types = [] }) {
  const allTypes = !types?.length;
  // Mismo criterio que Estadísticas: sin tipo cargado, la partida es Clasificatoria.
  const valid = (matches || []).filter(match => isResult(match) && (allTypes || types.includes(match.type || 'ranked')));
  if (period === 'patch') {
    // Todo el parche, sin importar la letra del hotfix.
    const group = getPatchGroup(patch);
    const rows = group ? valid.filter(match => getPatchGroup(match.patch) === group) : [];
    const days = rows.map(dayOf).filter(Boolean).sort();
    return { rows, from: days[0] || null, to: days[days.length - 1] || null };
  }
  const span = period === 'month' ? 30 : 7;
  const to = isoDay(now);
  const from = isoDay(new Date(now.getTime() - (span - 1) * DAY_MS));
  return { rows: valid.filter(match => dayOf(match) >= from && dayOf(match) <= to), from, to };
}

/**
 * Parches que se pueden elegir para la tarjeta: el activo (aunque todavía no tenga
 * partidas) y los anteriores con alguna partida terminada, del más nuevo al más viejo.
 * Agrupados como en la tierlist: 7.3, 7.3b y 7.3f son "7.3".
 * @param {any[]} matches
 * @param {string} [currentPatch]
 * @returns {string[]}
 */
export function sharePatchOptions(matches, currentPatch = '') {
  const groups = new Set((matches || []).filter(isResult).map(match => getPatchGroup(match.patch)).filter(Boolean));
  const current = getPatchGroup(currentPatch);
  if (current) groups.add(current);
  const version = group => group.split('.').map(Number);
  return [...groups].sort((a, b) => {
    const [majorA, minorA] = version(a);
    const [majorB, minorB] = version(b);
    return majorB - majorA || minorB - minorA;
  });
}

/** Racha de victorias más larga, en orden cronológico. */
function longestWinStreak(rows) {
  const ordered = [...rows].sort((a, b) => `${dayOf(a)} ${a.hour || ''} ${a.created_at || ''}`.localeCompare(`${dayOf(b)} ${b.hour || ''} ${b.created_at || ''}`));
  let best = 0;
  let current = 0;
  ordered.forEach(match => {
    current = match.result === 'win' ? current + 1 : 0;
    best = Math.max(best, current);
  });
  return best;
}

/** Agrupa por una clave y devuelve [{ key, games, wins }] de más a menos jugado. */
function tally(rows, keyOf) {
  const counts = new Map();
  rows.forEach(row => {
    const key = keyOf(row);
    if (!key) return;
    const entry = counts.get(key) || { key, games: 0, wins: 0 };
    entry.games += 1;
    if (row.result === 'win') entry.wins += 1;
    counts.set(key, entry);
  });
  return [...counts.values()].sort((a, b) => b.games - a.games || b.wins - a.wins);
}

/**
 * Resumen para la tarjeta: récord, winrate, KDA, campeón destacado, mejor partida,
 * racha y líneas. `null` si no hay partidas en el período.
 */
export function summarizePeriod(matches, options) {
  const { rows, from, to } = matchesInPeriod(matches, options);
  if (!rows.length) return null;
  const wins = rows.filter(match => match.result === 'win').length;
  const kdaRows = rows.filter(hasKda);
  const sum = key => kdaRows.reduce((total, match) => total + Number(match[key]), 0);
  const kills = sum('kills');
  const deaths = sum('deaths');
  const assists = sum('assists');

  // Campeón destacado: el más jugado; a igualdad, el de más victorias.
  const champions = tally(rows, match => match.own_champion_name);
  const top = champions[0] || null;
  // Mejor partida: victoria con el KDA más alto (o cualquier partida si no hubo victorias).
  const candidates = kdaRows.filter(match => match.result === 'win');
  const best = (candidates.length ? candidates : kdaRows)
    .map(match => ({ match, kda: matchKda(Number(match.kills), Number(match.deaths), Number(match.assists)) }))
    .sort((a, b) => b.kda - a.kda)[0];

  return {
    from,
    to,
    games: rows.length,
    wins,
    losses: rows.length - wins,
    winrate: Math.round((wins / rows.length) * 100),
    // Misma fórmula que Estadísticas: promedio del KDA de cada partida.
    kda: averageMatchKda(rows),
    // K / D / A acumulados del período (las partidas sin esos datos no suman).
    totals: kdaRows.length ? { kills, deaths, assists } : null,
    avgKills: kdaRows.length ? kills / kdaRows.length : null,
    avgDeaths: kdaRows.length ? deaths / kdaRows.length : null,
    avgAssists: kdaRows.length ? assists / kdaRows.length : null,
    topChampion: top ? { name: top.key, games: top.games, wins: top.wins, winrate: Math.round((top.wins / top.games) * 100) } : null,
    champions: champions.slice(0, 3).map(entry => ({ name: entry.key, games: entry.games, wins: entry.wins })),
    // Cuántos campeones distintos se jugaron en el período.
    championCount: champions.length,
    lanes: tally(rows, match => match.lane).slice(0, 2).map(entry => entry.key),
    bestMatch: best ? {
      champion: best.match.own_champion_name,
      kills: Number(best.match.kills),
      deaths: Number(best.match.deaths),
      assists: Number(best.match.assists),
      won: best.match.result === 'win',
    } : null,
    winStreak: longestWinStreak(rows),
  };
}
