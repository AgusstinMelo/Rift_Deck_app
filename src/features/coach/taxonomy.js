// Lista cerrada de valores del catálogo que usa el Coach. Cada regla del Coach se apoya
// en estos tags, así que un sinónimo nuevo ("dive" en vez de "diver") deja a ese campeón
// afuera sin avisar. `npm run catalog:check` compara el catálogo de Supabase contra esta
// lista; para sumar un valor nuevo, agregalo acá y enseñale al Coach qué hacer con él.
// Los valores van tal como se guardan en la base (con ñ).

export const CHAMPION_TRAITS = [
  'alta_durabilidad', 'atraviesa_terreno', 'autocuracion', 'blink', 'buff_aliado', 'camuflaje',
  'cc_blando', 'cc_duro', 'corto_alcance', 'creacion_terreno', 'curacion_aliada', 'dash',
  'daño_area', 'daño_burst', 'daño_ejecucion', 'daño_fisico', 'daño_magico', 'daño_mixto',
  'daño_por_vida_porcentual', 'daño_sostenido', 'daño_verdadero', 'dependiente_autoataques',
  'dependiente_habilidades', 'dependiente_on_hit', 'dependiente_recursos', 'dependiente_robo_vida',
  'dependiente_velocidad_movimiento', 'desplazamiento', 'encanto', 'escalado_infinito', 'escudo',
  'escudo_aliado', 'inalcanzable', 'invocaciones', 'invulnerabilidad', 'largo_alcance',
  'mecanica_acumulacion', 'mecanica_reset', 'medio_alcance', 'melee', 'miedo', 'poke',
  'presencia_global', 'provocacion', 'ralentizacion', 'rango', 'reduccion_daño', 'root', 'salto',
  'silencio', 'stun', 'supresion', 'transformacion',
];

/** Las que el Coach sabe explicar y aprovechar (VULN en detectors/matchups.js). */
export const CHAMPION_VULNERABILITIES = [
  'acceso_backline', 'anti_curacion', 'anti_escudo', 'armadura_alta', 'asesino', 'bloqueo_movilidad',
  'cadena_cc', 'cc_duro', 'daño_burst', 'daño_por_vida_porcentual', 'daño_sostenido', 'daño_verdadero',
  'disengage', 'diver', 'gap_close', 'kiteo', 'largo_alcance', 'outscale', 'presion_early',
  'presion_mana', 'reduccion_velocidad_ataque', 'resistencia_magica_alta', 'revelado_vision', 'vida_alta',
];

export const CHAMPION_ITEM_SCALINGS = [
  'aceleracion_habilidad', 'armadura', 'daño_ataque', 'daño_critico', 'mana', 'on_hit',
  'penetracion_armadura_plana', 'penetracion_armadura_porcentual', 'penetracion_magica_plana',
  'penetracion_magica_porcentual', 'poder_curacion', 'poder_escudo', 'poder_habilidad',
  'probabilidad_critico', 'regeneracion_mana', 'regeneracion_vida', 'resistencia_magica',
  'vampirismo_fisico', 'vampirismo_magico', 'velocidad_ataque', 'velocidad_movimiento', 'vida',
];

export const ITEM_EFFECT_TAGS = [
  'aceleracion_habilidad', 'acumulacion', 'amplificacion_daño', 'anti_burst', 'anti_curacion',
  'anti_escudo', 'autocuracion', 'buff_aliado', 'buff_velocidad_ataque', 'cc_duro', 'curacion_aliada',
  'dash', 'daño_autoataque', 'daño_burst', 'daño_habilidad', 'daño_on_hit', 'daño_sostenido',
  'daño_verdadero', 'daño_vida_actual', 'daño_vida_faltante', 'daño_vida_porcentual', 'debuff_enemigo',
  'defensa_fisica', 'defensa_magica', 'ejecucion', 'escalado', 'escudo', 'escudo_aliado',
  'escudo_hechizo', 'gap_close', 'generacion_oro', 'inmunidad_cc', 'invulnerabilidad', 'limpieza_cc',
  'mejora_autoataque', 'modificador_critico', 'penetracion_armadura', 'penetracion_magica',
  'potenciacion_habilidad', 'ralentizacion', 'reduccion_armadura', 'reduccion_daño',
  'reduccion_resistencia_magica', 'regeneracion_vida', 'resistencia_ralentizacion', 'revelado_vision',
  'revivir', 'sosten_mana', 'spellblade', 'tenacidad', 'vampirismo_fisico', 'vampirismo_magico',
  'velocidad_movimiento', 'velocidad_movimiento_combate', 'velocidad_movimiento_fuera_combate',
];

export const ITEM_SITUATIONAL_ROLES = ['core', 'counter', 'defensivo', 'early', 'escalado', 'late', 'ofensivo', 'snowball', 'utilidad'];

/**
 * Problemas del catálogo para el Coach: valores fuera de la lista cerrada, nombres con
 * espacios, relaciones entre campeones que no apuntan a un campeón y objetos terminados
 * sin effect_tags. Devuelve una lista de textos (vacía si está todo bien).
 */
export function catalogProblems({ champions = [], items = [] }) {
  const problems = [];
  const norm = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const known = new Set(champions.flatMap(champ => [norm(champ.name), String(champ.external_id)]));
  const outside = (name, field, values, allowed) => {
    const list = new Set(allowed);
    (values || []).filter(value => !list.has(value)).forEach(value => problems.push(`${name}: ${field} "${value}" no está en la lista cerrada`));
  };
  champions.forEach(champ => {
    const name = String(champ.name).trim();
    if (champ.name !== name) problems.push(`${JSON.stringify(champ.name)}: el nombre tiene espacios o saltos de línea`);
    outside(name, 'traits', champ.traits, CHAMPION_TRAITS);
    outside(name, 'vulnerabilities', champ.vulnerabilities, CHAMPION_VULNERABILITIES);
    outside(name, 'item_scalings', champ.item_scalings, CHAMPION_ITEM_SCALINGS);
    ['strong_against', 'weak_against', 'synergies'].forEach(field => (champ[field] || []).forEach(value => {
      if (!known.has(norm(value)) && !known.has(String(value))) problems.push(`${name}: ${field} "${value}" no es un campeón del catálogo`);
      else if (/^\d+$/.test(String(value))) problems.push(`${name}: ${field} "${value}" usa el id; guardá el nombre del campeón`);
    }));
  });
  items.forEach(item => {
    outside(item.name, 'effect_tags', item.effect_tags, ITEM_EFFECT_TAGS);
    outside(item.name, 'situational_role', item.situational_role, ITEM_SITUATIONAL_ROLES);
    if (item.category === 'Mejorado' && item.active !== false && !(item.effect_tags || []).length) {
      problems.push(`${item.name}: objeto terminado sin effect_tags (el Coach no sabe a qué responde)`);
    }
  });
  return problems;
}
