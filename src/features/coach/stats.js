// Estadística del Coach. Con pocas partidas cualquier diferencia de winrate parece
// enorme, así que todo se compara "encogido" hacia el promedio del jugador: un grupo
// necesita volumen para alejarse de su base. La confianza sale de una prueba de dos
// proporciones (z) y del volumen.
import { formatLocale } from '../../i18n/uiI18n.js';

/** Partidas, victorias, winrate y promedios de un grupo. */
export function summarize(rows) {
  const games = rows.length;
  const wins = rows.filter(row => row.won).length;
  const withKda = rows.filter(row => row.hasKda);
  const sum = key => withKda.reduce((total, row) => total + row[key], 0);
  const deaths = sum('deaths');
  return {
    games,
    wins,
    losses: games - wins,
    wr: games ? wins / games : 0,
    kdaGames: withKda.length,
    avgDeaths: withKda.length ? deaths / withKda.length : null,
    avgKills: withKda.length ? sum('kills') / withKda.length : null,
    kda: withKda.length ? (deaths ? (sum('kills') + sum('assists')) / deaths : sum('kills') + sum('assists')) : null,
  };
}

/**
 * Winrate encogido hacia `prior`: con `strength` partidas "virtuales" del promedio.
 * 2 de 2 victorias con base 50% da 0,625, no 100%.
 */
export function shrunkRate(wins, games, prior, strength = 6) {
  return (wins + prior * strength) / (games + strength);
}

/** Estadístico z de la diferencia entre dos proporciones. */
export function twoProportionZ(wins1, games1, wins2, games2) {
  if (!games1 || !games2) return 0;
  const pooled = (wins1 + wins2) / (games1 + games2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / games1 + 1 / games2));
  if (!se) return 0;
  return (wins1 / games1 - wins2 / games2) / se;
}

/**
 * Confianza 0–1 a partir de la evidencia: |z| de la diferencia, volumen y si el
 * catálogo corrobora el patrón (por ejemplo, el antiheal contra curadores).
 */
export function confidenceOf({ z = 0, games = 0, corroborated = false }) {
  const evidence = Math.min(1, Math.abs(z) / 2.5);
  const volume = Math.min(1, Math.sqrt(games / 30));
  return Math.max(0.1, Math.min(0.97, evidence * 0.55 + volume * 0.3 + (corroborated ? 0.15 : 0)));
}

export const pct = value => `${Math.round(value * 100)}%`;

const formatters = new Map();
/** Número con decimales fijos en el formato del idioma activo (2,5 en español, 2.5 en inglés). */
export function fixed(value, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  const key = `${formatLocale()}:${digits}`;
  if (!formatters.has(key)) {
    formatters.set(key, new Intl.NumberFormat(formatLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }));
  }
  return formatters.get(key).format(Number(value));
}

/** Agrupa filas por una o varias claves por fila. */
export function groupBy(rows, keysOf) {
  const groups = new Map();
  rows.forEach(row => {
    const keys = [].concat(keysOf(row) ?? []).filter(Boolean);
    new Set(keys).forEach(key => {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
  });
  return groups;
}
