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
  return {
    games,
    wins,
    losses: games - wins,
    winrate: pct(wins, games),
    champions: groupBy(rows, row => row.champion).map(({ key, ...entry }) => ({ name: key, ...entry })),
    lanes: groupBy(rows, row => row.lane).map(({ key, ...entry }) => ({ lane: key, ...entry })),
  };
}

/** Tipos de partida que el perfil tiene cargados, en el orden de la app. */
export function availableTypes(stats, order) {
  const present = new Set((stats || []).map(row => row.type || 'ranked'));
  return order.filter(type => present.has(type));
}
