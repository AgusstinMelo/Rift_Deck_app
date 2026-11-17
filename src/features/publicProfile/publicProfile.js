// Perfil público (/p/<nombre>): nombre del link y resumen de las estadísticas que devuelve
// get_public_profile(). Funciones puras: sin React ni base de datos (test/publicProfile).

export const SLUG_MIN = 3;
export const SLUG_MAX = 24;
// Igual que la restricción de la base (profiles_public_slug_format).
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$/;

/** El nombre del link es válido: minúsculas, números y guiones, de 3 a 24, sin guion en los bordes. */
export function isValidSlug(slug) {
  return SLUG_PATTERN.test(String(slug || ''));
}

/**
 * Convierte lo que escribe el usuario (o su nombre visible) en un nombre de link:
 * sin tildes, en minúsculas, espacios y símbolos como guiones, sin guiones repetidos.
 */
export function toSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '');
}

/** Mientras se escribe: igual que toSlug, pero deja un guion al final (para seguir tipeando). */
export function toSlugDraft(value) {
  const raw = String(value || '');
  const slug = toSlug(raw);
  return slug && /[^a-zA-Z0-9]$/.test(raw) && slug.length < SLUG_MAX ? `${slug}-` : slug;
}

const pct = (wins, games) => (games ? Math.round((wins / games) * 100) : 0);

/** Suma filas { games, wins } agrupando por una clave; de más a menos jugado. */
function groupBy(rows, keyOf) {
  const groups = new Map();
  rows.forEach(row => {
    const key = keyOf(row);
    if (!key) return;
    const entry = groups.get(key) || { key, games: 0, wins: 0 };
    entry.games += Number(row.games) || 0;
    entry.wins += Number(row.wins) || 0;
    groups.set(key, entry);
  });
  return [...groups.values()]
    .map(entry => ({ ...entry, winrate: pct(entry.wins, entry.games) }))
    .sort((a, b) => b.games - a.games || b.wins - a.wins || String(a.key).localeCompare(String(b.key)));
}

/**
 * Resumen de las filas { type, champion, lane, games, wins } del perfil público, solo con
 * los tipos de partida elegidos (vacío: todos).
 */
export function summarizePublicStats(stats, types = []) {
  const rows = (stats || []).filter(row => !types.length || types.includes(row.type || 'ranked'));
  const games = rows.reduce((sum, row) => sum + (Number(row.games) || 0), 0);
  const wins = rows.reduce((sum, row) => sum + (Number(row.wins) || 0), 0);
  // KDA promedio como en Estadísticas: promedio del KDA de cada partida (kda_sum / partidas).
  const kdaRows = rows.filter(row => row.kda_sum !== undefined && row.kda_sum !== null);
  const kdaGames = kdaRows.reduce((sum, row) => sum + (Number(row.games) || 0), 0);
  const kdaSum = kdaRows.reduce((sum, row) => sum + (Number(row.kda_sum) || 0), 0);
  return {
    games,
    wins,
    losses: games - wins,
    winrate: pct(wins, games),
    kda: kdaGames ? kdaSum / kdaGames : null,
    champions: groupBy(rows, row => row.champion).map(({ key, ...entry }) => ({ name: key, ...entry })),
    lanes: groupBy(rows, row => row.lane).map(({ key, ...entry }) => ({ lane: key, ...entry })),
  };
}

// Winrate "suavizado" (Laplace): con 1 partida 100% no le gana a 8 de 10.
const smoothed = entry => (entry.wins + 1) / (entry.games + 2);

/**
 * El mejor (winrate > 50) y el peor (< 50) de una lista { key, games, wins }. Si hay
 * entradas con 2 o más partidas, solo se consideran esas.
 */
function bestAndWorst(entries) {
  const solid = entries.filter(entry => entry.games >= 2);
  const pool = solid.length ? solid : entries;
  const best = pool.filter(entry => entry.winrate > 50)
    .sort((a, b) => smoothed(b) - smoothed(a) || b.games - a.games)[0] || null;
  const worst = pool.filter(entry => entry.winrate < 50)
    .sort((a, b) => smoothed(a) - smoothed(b) || b.games - a.games)[0] || null;
  const toResult = entry => (entry ? { name: entry.key, games: entry.games, wins: entry.wins, winrate: entry.winrate } : null);
  return { best: toResult(best), worst: toResult(worst) };
}

const sameName = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
const byType = types => row => !types.length || types.includes(row.type || 'ranked');

/**
 * Para un campeón del usuario: mejor y peor matchup directo (contra el rival de línea) y
 * mejor y peor sinergia (con un aliado), con los tipos de partida elegidos.
 */
export function championFocus(profile, champion, types = []) {
  const ofChampion = rows => (rows || []).filter(byType(types)).filter(row => sameName(row.champion, champion));
  const matchups = bestAndWorst(groupBy(ofChampion(profile?.matchups), row => row.opponent));
  const synergies = bestAndWorst(groupBy(ofChampion(profile?.synergies), row => row.ally));
  return {
    bestMatchup: matchups.best,
    worstMatchup: matchups.worst,
    bestSynergy: synergies.best,
    worstSynergy: synergies.worst,
  };
}

/** Últimas partidas con los tipos elegidos (vienen ordenadas de la más nueva a la más vieja). */
export function recentMatches(recent, types = [], limit = 8) {
  return (recent || []).filter(byType(types)).slice(0, limit);
}

/**
 * Acomoda los campeones como burbujas sin superponerse: radio según partidas (área
 * proporcional), la más grande al centro y el resto en espiral alrededor.
 * Devuelve las burbujas con x, y, r y los límites del dibujo (para el viewBox del SVG).
 * @param {{ name: string, games: number }[]} entries  de más a menos jugado.
 */
export function packBubbles(entries, { minRadius = 16, maxRadius = 56, gap = 4, aspect = 1.25 } = {}) {
  // Proporción ancho/alto del panel: la espiral se estira en ese sentido para llenarlo.
  const stretch = Math.min(2.4, Math.max(0.5, aspect || 1));
  if (!entries?.length) return { bubbles: [], bounds: { x: 0, y: 0, width: 0, height: 0 } };
  const maxGames = Math.max(...entries.map(entry => entry.games));
  const radiusOf = games => minRadius + (maxRadius - minRadius) * Math.sqrt(games / maxGames);
  const placed = [];
  const overlaps = (x, y, r) => placed.some(other => Math.hypot(other.x - x, other.y - y) < other.r + r + gap);

  entries.forEach(entry => {
    const r = radiusOf(entry.games);
    if (!placed.length) {
      placed.push({ ...entry, x: 0, y: 0, r });
      return;
    }
    // Espiral desde el centro: la primera posición libre, estirada según el panel.
    const sx = Math.sqrt(stretch);
    const sy = 1 / sx;
    for (let step = 0; step < 6000; step += 1) {
      const angle = step * 0.35;
      const distance = 2 + step * 0.9;
      const x = Math.cos(angle) * distance * sx;
      const y = Math.sin(angle) * distance * sy;
      if (!overlaps(x, y, r)) {
        placed.push({ ...entry, x, y, r });
        return;
      }
    }
  });

  const minX = Math.min(...placed.map(b => b.x - b.r));
  const maxX = Math.max(...placed.map(b => b.x + b.r));
  const minY = Math.min(...placed.map(b => b.y - b.r));
  const maxY = Math.max(...placed.map(b => b.y + b.r));
  return { bubbles: placed, bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY } };
}

/** Récord y winrate por lado del mapa (blue / red) con los tipos elegidos. */
export function sideSummary(sides, types = []) {
  const rows = (sides || []).filter(byType(types));
  const of = side => {
    const games = rows.filter(row => row.side === side).reduce((sum, row) => sum + (Number(row.games) || 0), 0);
    const wins = rows.filter(row => row.side === side).reduce((sum, row) => sum + (Number(row.wins) || 0), 0);
    return { games, wins, winrate: games ? pct(wins, games) : null };
  };
  return { blue: of('blue'), red: of('red') };
}

/** Racha de victorias más larga en los resultados del parche (en orden), con los tipos elegidos. */
export function bestStreak(results, types = []) {
  let best = 0;
  let current = 0;
  (results || []).filter(byType(types)).forEach(row => {
    current = row.result === 'win' ? current + 1 : 0;
    best = Math.max(best, current);
  });
  return best;
}

/** Tipos de partida que el perfil tiene cargados, en el orden de la app. */
export function availableTypes(stats, order) {
  const present = new Set((stats || []).map(row => row.type || 'ranked'));
  return order.filter(type => present.has(type));
}
