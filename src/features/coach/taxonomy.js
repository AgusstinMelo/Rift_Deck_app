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

/** Rol en la pelea (champions.team_roles). pick = atrapa a un rival aislado y lo borra. */
export const TEAM_ROLES = ['frontline', 'iniciador', 'diver', 'protector', 'poke', 'pick', 'daño_sostenido', 'split'];

/** Perfil 0-5 de cada campeón (columnas champions.score_*); vacío = sin cargar. */
export const CHAMPION_SCORES = [
  'score_engage', 'score_peel', 'score_disengage', 'score_mobility', 'score_burst',
  'score_sustained_damage', 'score_range', 'score_self_sustain', 'score_waveclear',
];

/** Clases para runas y hechizos (fits_classes). */
export const FIT_CLASSES = ['tirador', 'mago', 'asesino', 'luchador', 'tanque', 'soporte'];
export const LANES = ['top', 'jungler', 'mid', 'adc', 'support'];

/** Contra qué responde una runa o un hechizo (counters). */
export const COUNTER_TAGS = ['poke', 'desgaste', 'burst', 'asesinos', 'divers', 'cc', 'curacion', 'escudos', 'tanques', 'kiteo'];

/**
 * Qué activa una runa (runes.trigger_tags). El Coach (detectors/build.js) y Build V2
 * (v2Eligibility.js) buscan estos valores exactos. Los tres "golpes" son distintos:
 * golpes_multiples = N impactos mezclando ataques y habilidades en una ventana corta
 * (Electrocutar, Fase Veloz); golpes_consecutivos = ataques seguidos o acumulaciones
 * (Potenciación, Cadencia Letal, Conquistador); golpes_mismo_objetivo = tienen que
 * caer sobre el mismo campeón.
 */
export const RUNE_TRIGGER_TAGS = [
  'autoataque', 'blink', 'cerca_aliado', 'combate_extendido', 'curar', 'dash', 'derribo',
  'distancia_recorrida', 'enemigo_con_cc', 'enemigo_ralentizado', 'escalado_tiempo', 'escudar',
  'fuera_combate', 'golpes_consecutivos', 'golpes_mismo_objetivo', 'golpes_multiples',
  'impacto_campeon', 'impacto_habilidad', 'lanzar_ulti', 'movimiento', 'nivel', 'objetivo_vida_alta',
  'objetivo_vida_baja', 'recibir_daño', 'salto', 'sigilo', 'trade_corto', 'vida_propia_baja',
];

/** Qué da una runa (runes.benefit_tags). */
export const RUNE_BENEFIT_TAGS = [
  'aceleracion_habilidad', 'armadura', 'buff_aliado', 'curacion', 'curacion_aliada', 'daño_adaptativo',
  'daño_adicional', 'daño_burst', 'daño_ejecucion', 'daño_escalado', 'daño_on_hit', 'daño_sostenido',
  'daño_verdadero', 'debuff_enemigo', 'defensa_escalada', 'escudo', 'escudo_aliado',
  'estadisticas_permanentes', 'generacion_oro', 'mana', 'poder_all_in', 'poder_teamfight', 'poder_trade',
  'reduccion_daño', 'reduccion_enfriamiento', 'reduccion_enfriamiento_ulti', 'regeneracion_mana',
  'regeneracion_vida', 'resistencia_magica', 'resistencia_ralentizacion', 'sosten_linea', 'tenacidad',
  'velocidad_ataque', 'velocidad_movimiento', 'vida_escalada',
];

export const ITEM_SITUATIONAL_ROLES = ['core', 'counter', 'defensivo', 'early', 'escalado', 'late', 'ofensivo', 'snowball', 'utilidad'];

/**
 * Problemas del catálogo para el Coach: valores fuera de la lista cerrada, nombres con
 * espacios, relaciones entre campeones que no apuntan a un campeón y objetos terminados
 * sin effect_tags. Devuelve una lista de textos (vacía si está todo bien).
 */
export function catalogProblems({ champions = [], items = [], runes = [], spells = [] }) {
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
    outside(name, 'team_roles', champ.team_roles, TEAM_ROLES);
    CHAMPION_SCORES.forEach(field => {
      const value = champ[field];
      if (value != null && !(Number.isInteger(value) && value >= 0 && value <= 5)) problems.push(`${name}: ${field} = ${value} (tiene que ser de 0 a 5)`);
    });
    ['strong_against', 'weak_against', 'synergies'].forEach(field => (champ[field] || []).forEach(value => {
      if (!known.has(norm(value)) && !known.has(String(value))) problems.push(`${name}: ${field} "${value}" no es un campeón del catálogo`);
      else if (/^\d+$/.test(String(value))) problems.push(`${name}: ${field} "${value}" usa el id; guardá el nombre del campeón`);
    }));
  });
  items.forEach(item => {
    outside(item.name, 'effect_tags', item.effect_tags, ITEM_EFFECT_TAGS);
    outside(item.name, 'situational_role', item.situational_role, ITEM_SITUATIONAL_ROLES);
    if (item.category === 'Mejorado' && item.active !== false) {
      if (!(item.effect_tags || []).length) problems.push(`${item.name}: objeto terminado sin effect_tags (el Coach no sabe a qué responde)`);
      ['good_against', 'avoid_against'].forEach(field => {
        if (!(item[field] || []).length) problems.push(`${item.name}: objeto terminado sin ${field}`);
        (item[field] || []).filter(value => !known.has(norm(value))).forEach(value => problems.push(`${item.name}: ${field} "${value}" no es un campeón del catálogo`));
      });
    }
  });
  runes.forEach(rune => {
    outside(rune.name, 'trigger_tags', rune.trigger_tags, RUNE_TRIGGER_TAGS);
    outside(rune.name, 'benefit_tags', rune.benefit_tags, RUNE_BENEFIT_TAGS);
    if (rune.branch === 'Clave' && !(rune.trigger_tags || []).length) problems.push(`${rune.name}: runa clave sin trigger_tags (el Coach no sabe si le pega al campeón)`);
    outside(rune.name, 'fits_classes', rune.fits_classes, FIT_CLASSES);
    outside(rune.name, 'counters', rune.counters, COUNTER_TAGS);
  });
  spells.forEach(spell => {
    outside(spell.name, 'fits_classes', spell.fits_classes, FIT_CLASSES);
    outside(spell.name, 'fits_lanes', spell.fits_lanes, LANES);
    outside(spell.name, 'counters', spell.counters, COUNTER_TAGS);
  });
  return problems;
}

/** Campos que se cargan a mano solo en la tabla base (el parche no los tiene que pisar). */
export const BASE_ONLY_COLUMNS = [
  'counters', 'fits_classes', 'fits_lanes', 'team_roles', ...CHAMPION_SCORES,
  'traits', 'vulnerabilities', 'item_scalings',
];

/**
 * Lo que el trigger sync_catalog_base_from_patch NO copia del parche a la base
 * (misma lista que public.catalog_sync_excluded_columns()).
 */
export const PATCH_SYNC_EXCLUDED = [
  'id', 'created_at', 'created_date', 'created_by_id', 'updated_at', 'updated_date', 'is_sample',
  ...BASE_ONLY_COLUMNS, 'tags', 'recommended_champions', 'recommended_champion', 'recommended_items', 'active',
];

const isEmpty = value => value == null || value === '' || (Array.isArray(value) && !value.length);
const sameValue = (a, b) => {
  if (a == null && b == null) return true;
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  return JSON.stringify(a) === JSON.stringify(b);
};

/**
 * Problemas entre la tabla base y los datos del parche activo, que ganan en las vistas
 * current_* aunque valgan null:
 *  - un null del parche que tapa un valor cargado en la base;
 *  - un campo de carga manual (perfil del Coach) metido en el parche, que tapa la base;
 *  - un campo distinto entre base y parche: la base se actualiza sola al guardar el
 *    parche, así que casi siempre es una edición hecha en la base que no se ve.
 * `patch` son filas { [key]: id, data }; `key` es la columna con el id.
 */
export function patchOverrideProblems({ label, base = [], patch = [], key }) {
  const problems = [];
  const excluded = new Set(PATCH_SYNC_EXCLUDED);
  const baseOnly = new Set(BASE_ONLY_COLUMNS);
  const byId = new Map(base.map(row => [String(row.id), row]));
  patch.forEach(row => {
    const entity = byId.get(String(row[key]));
    if (!entity || row.data?.active === false) return;
    const name = String(entity.name ?? entity.id).trim();
    Object.entries(row.data || {}).forEach(([field, value]) => {
      if (!(field in entity)) return;
      if (baseOnly.has(field)) {
        problems.push(`${label} ${name}: ${field} está en el parche y tapa lo que cargás en la base (borrá la clave del parche)`);
      } else if (value === null) {
        if (!excluded.has(field) && !isEmpty(entity[field])) problems.push(`${label} ${name}: ${field} vale null en el parche y tapa el valor de la base (borrá la clave del parche)`);
      } else if (!excluded.has(field) && !sameValue(entity[field], value)) {
        problems.push(`${label} ${name}: ${field} es distinto en la base y en el parche activo; se ve el del parche (editalo ahí, la base se actualiza sola)`);
      }
    });
  });
  return problems;
}

/** Cuánto del perfil del Coach está cargado (para ir completándolo a mano). */
export function catalogCoverage({ champions = [], runes = [], spells = [] }) {
  const filled = (rows, test) => `${rows.filter(test).length}/${rows.length}`;
  return {
    'Campeones con rol en la pelea': filled(champions, champ => (champ.team_roles || []).length),
    'Campeones con perfil 0-5 completo': filled(champions, champ => CHAMPION_SCORES.every(field => champ[field] != null)),
    // counters puede quedar vacío: una runa de daño puro no responde a nada del rival.
    'Runas clave con clases': filled(runes.filter(rune => rune.branch === 'Clave'), rune => (rune.fits_classes || []).length),
    'Runas con clases': filled(runes, rune => (rune.fits_classes || []).length),
    // Igual que las runas: Castigo o Teleportación no responden a nada del rival.
    'Hechizos con clases y líneas': filled(spells, spell => (spell.fits_classes || []).length && (spell.fits_lanes || []).length),
  };
}
