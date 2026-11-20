// Por qué una pieza de la build encaja en ESTA partida, calculado localmente con los mismos
// datos que usa la IA (draft_profile) y la auditoría: a qué amenazas del rival responde y
// quiénes las forman, y con qué estadísticas del kit escala tu campeón. El prompt se lo pasa a
// la IA ya armado (responds_to) para que el motivo arranque por el draft, y la pantalla del
// resultado lo muestra en una línea propia, aunque la IA no lo haya mencionado.
import { itemAnswersSignal } from './itemCounters.js';
import { matchedScalings } from './v2BuildAudit.js';

const normalize = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Señales del rival a las que responde un objeto (por sus efectos y resistencias). */
const itemSignals = (row, signals) => signals.filter(entry => itemAnswersSignal(row, entry.signal));

/** Señales a las que responde una runa o un hechizo (su columna counters). */
const counterSignals = (entity, signals) => {
  const counters = new Set((entity?.counters || []).map(normalize));
  return signals.filter(entry => counters.has(normalize(entry.signal)));
};

/**
 * @param {object} entity  Objeto, runa o hechizo del catálogo.
 * @param {'item' | 'rune' | 'spell'} kind
 * @param {{ profile?: { enemy_signals: { signal: string, champions: string[] }[] }, scalings?: Set<string> }} context
 * @returns {{ answers: { signal: string, champions: string[] }[], scalings: string[] }}
 *   answers: amenazas del rival a las que responde, con quiénes las forman; scalings: valores de
 *   item_scalings de tu campeón que alimenta (solo objetos).
 */
export function pieceDraftFacts(entity, kind, { profile, scalings } = {}) {
  const signals = profile?.enemy_signals || [];
  const answers = kind === 'item' ? itemSignals(entity, signals) : counterSignals(entity, signals);
  return {
    answers: answers.map(({ signal, champions }) => ({ signal, champions: [...champions] })),
    scalings: kind === 'item' ? matchedScalings(entity, scalings) : [],
  };
}

/**
 * Texto para el prompt (columna responds_to): "burst (Zed, Talon); daño mágico (Sylas)".
 * Vacío si no responde a nada del rival cargado.
 */
export function respondsToText(facts) {
  return facts.answers
    .map(({ signal, champions }) => `${signal.replace(/_/g, ' ')}${champions.length ? ` (${champions.join(', ')})` : ''}`)
    .join('; ');
}
