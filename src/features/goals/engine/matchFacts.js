// Lectura tolerante de los campos de una partida. Distingue siempre entre
// "dato ausente" (null) y "cero".
import { DEFAULT_MATCH_TYPE } from '../../../constants/matchTypes.js';
import { normalizeChampionName } from '../../../utils/tierlist.js';
import { isIsoDate, toLocalDate } from './period.js';

/**
 * Fecha en que se jugó la partida, como fecha local YYYY-MM-DD.
 * `date` es una fecha de calendario sin zona horaria: se interpreta en la zona del objetivo.
 * Si falta, se usa la fecha de registro (`created_at`) convertida a esa zona.
 * @returns {{ date: string, source: 'date' | 'created_at' } | null}
 */
export function playedDateOf(match, timeZone) {
  const raw = String(match?.date ?? '').slice(0, 10);
  if (isIsoDate(raw)) return { date: raw, source: 'date' };

  if (match?.created_at) {
    const fallback = toLocalDate(match.created_at, timeZone);
    if (fallback) return { date: fallback, source: 'created_at' };
  }
  return null;
}

/** 'win' | 'loss' | null */
export function resultOf(match) {
  const result = String(match?.result ?? '').trim().toLowerCase();
  return result === 'win' || result === 'loss' ? result : null;
}

/** Número finito no negativo, o null si el dato no fue registrado. */
export function countStatOf(match, field) {
  const raw = match?.[field];
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function deathsOf(match) {
  return countStatOf(match, 'deaths');
}

/** Oro de la partida; 0 o vacío se consideran no registrados. */
export function goldOf(match) {
  const gold = countStatOf(match, 'gold');
  return gold ? gold : null;
}

/** Duración en minutos; 0 o vacío se consideran no registrados. */
export function durationOf(match) {
  const duration = countStatOf(match, 'duration_minutes');
  return duration ? duration : null;
}

/** Campeón propio de la partida, o null si no fue registrado. */
export function championOf(match) {
  const id = String(match?.own_champion_id ?? '').trim();
  const name = String(match?.own_champion_name ?? '').trim();
  if (!id && !name) return null;
  return { id: id || null, name: name || null };
}

/** true si el campeón de la partida coincide con alguno de la lista (por id o por nombre normalizado). */
export function championMatchesAny(champion, selection) {
  const key = champion.name ? normalizeChampionName(champion.name) : null;
  return selection.some(selected =>
    (champion.id && selected.id && String(selected.id) === champion.id)
    || (key && normalizeChampionName(selected.name) === key));
}

export function laneOf(match) {
  const lane = String(match?.lane ?? '').trim().toLowerCase();
  return lane || null;
}

/** Tipo de partida. La columna es not null; las filas legacy sin tipo se tratan como clasificatoria, igual que en Partidas. */
export function matchTypeOf(match) {
  return String(match?.type ?? '').trim() || DEFAULT_MATCH_TYPE;
}

export function patchOf(match) {
  const patch = String(match?.patch ?? '').trim();
  return patch || null;
}
