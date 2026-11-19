// A qué señales del rival responde un objeto, según sus efectos (effect_tags) y sus
// resistencias. Lo usan Build V2 (v2BuildAudit.js, para las señales del draft) y la ficha
// del objeto en la Biblioteca (todas las señales, sin draft), así las dos dicen lo mismo.

const normalize = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Efectos de un objeto (effect_tags sin acentos) que responden a cada señal del draft. */
export const SIGNAL_ANSWERS = {
  curacion: ['anti_curacion'],
  escudos: ['anti_escudo'],
  tanques: ['penetracion_armadura', 'penetracion_magica', 'dano_vida_porcentual', 'dano_vida_actual', 'reduccion_armadura', 'reduccion_resistencia_magica', 'dano_verdadero'],
  burst: ['anti_burst', 'revivir', 'invulnerabilidad', 'escudo_hechizo', 'escudo', 'reduccion_dano'],
  asesinos: ['anti_burst', 'revivir', 'invulnerabilidad', 'escudo_hechizo', 'escudo'],
  divers: ['anti_burst', 'revivir', 'invulnerabilidad', 'escudo', 'reduccion_dano', 'ralentizacion'],
  pick: ['limpieza_cc', 'inmunidad_cc', 'tenacidad', 'escudo_hechizo', 'revivir'],
  engage: ['tenacidad', 'limpieza_cc', 'inmunidad_cc', 'anti_burst', 'reduccion_dano'],
  cc: ['tenacidad', 'limpieza_cc', 'inmunidad_cc', 'escudo_hechizo'],
  poke: ['regeneracion_vida', 'autocuracion', 'escudo'],
  desgaste: ['regeneracion_vida', 'autocuracion', 'vampirismo_fisico', 'vampirismo_magico'],
  dano_fisico: ['defensa_fisica'],
  dano_magico: ['defensa_magica', 'escudo_hechizo'],
};

/** Si un objeto responde a una señal (nombre de enemy_signals, con o sin acentos). */
export function itemAnswersSignal(row, signal) {
  const key = normalize(signal);
  const effects = new Set((Array.isArray(row?.effect_tags) ? row.effect_tags : []).map(normalize));
  return (SIGNAL_ANSWERS[key] || []).some(tag => effects.has(tag))
    || (key === 'dano_fisico' && Number(row?.armor) > 0)
    || (key === 'dano_magico' && Number(row?.magic_res) > 0);
}

/** Todas las señales a las que responde, en el orden de `tags` (p. ej. COUNTER_TAGS). */
export const itemCounters = (row, tags) => tags.filter(tag => itemAnswersSignal(row, tag));
