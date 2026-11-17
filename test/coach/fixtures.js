// Catálogo y partidas de ejemplo para los tests del Coach (forma de current_champions,
// current_wr_items y current_runes).

const champion = (name, fields) => ({
  id: name.toLowerCase().replace(/[^a-z]/g, ''), name, traits: [], vulnerabilities: [], roles: [],
  strong_against: [], weak_against: [], damage_type: 'AD', scaling: 'midgame', ...fields,
});

export const champions = [
  champion('Garen', { roles: ['Luchador'], traits: ['melee', 'dependiente_habilidades'], damage_type: 'AD' }),
  champion('Darius', {
    roles: ['Luchador'], traits: ['melee', 'autocuracion', 'dependiente_autoataques'],
    vulnerabilities: ['kiteo', 'reduccion_velocidad_ataque', 'anti_curacion'],
  }),
  champion('Jinx', { roles: ['Tirador'], traits: ['rango', 'dependiente_autoataques'], scaling: 'lategame', strong_against: ['darius'] }),
  champion('Soraka', { roles: ['Soporte'], traits: ['curacion_aliada'], damage_type: 'AP' }),
  champion('Aatrox', { roles: ['Luchador'], traits: ['autocuracion', 'cc_duro'], damage_type: 'AD' }),
  champion('Lux', { roles: ['Mago'], traits: ['dependiente_habilidades', 'cc_duro', 'root'], damage_type: 'AP' }),
  champion('Ahri', { roles: ['Mago', 'Asesino'], traits: ['dano_burst'], damage_type: 'AP' }),
  champion('Zed', { roles: ['Asesino'], traits: ['daño_burst'], damage_type: 'AD' }),
  champion('Malphite', { roles: ['Tanque'], traits: ['cc_duro'], damage_type: 'AP' }),
  champion('Annie', { roles: ['Mago'], traits: ['stun'], damage_type: 'AP' }),
  champion('Kayle', { roles: ['Tirador'], traits: ['rango'], damage_type: 'Hybrid' }),
  champion("Kai'Sa", { roles: ['Tirador'], traits: ['dependiente_autoataques', 'dependiente_on_hit', 'rango', 'dash'], damage_type: 'Hybrid' }),
  // Supports: engage (figura como Tanque) y encantadora.
  champion('Leona', { roles: ['Tanque'], traits: ['dependiente_habilidades', 'melee', 'alta_durabilidad', 'cc_duro', 'stun'], damage_type: 'AP', scaling: 'earlygame' }),
  champion('Janna', { roles: ['Soporte'], traits: ['dependiente_habilidades', 'rango', 'escudo_aliado', 'curacion_aliada'], damage_type: 'AP', scaling: 'lategame' }),
  // Luchador que también se juega de support.
  champion('Sett', { roles: ['Luchador'], traits: ['dependiente_autoataques', 'melee', 'cc_duro'], damage_type: 'AD' }),
];

const item = (name, fields) => ({
  id: name, name, category: 'Mejorado', active: true, type: ['Daño Fisico'], effect_tags: [], situational_role: ['ofensivo'],
  good_against: [], armor: 0, magic_res: 0, tenacity: 0, ...fields,
});

export const items = [
  item('Recordatorio Mortal', { effect_tags: ['anti_curacion', 'penetracion_armadura'], situational_role: ['counter'], good_against: ['Darius', 'Soraka'] }),
  item('Hidra Titánica', { type: ['Daño Fisico'], effect_tags: ['dano_sostenido'] }),
  item('Cuchilla Negra', { effect_tags: ['reduccion_armadura'] }),
  item('Filo Infinito', { effect_tags: ['modificador_critico'] }),
  item('Fauces de Malmortius', { effect_tags: ['defensa_magica', 'anti_burst'], magic_res: 40 }),
  item('Corazón Helado', { type: ['Defensa'], effect_tags: ['defensa_fisica'], armor: 60, good_against: ['Darius'] }),
  item('Espada Larga', { category: 'Básico' }),
  // Defensa de tanque (no para un carry) y defensa de carry (daño + armadura).
  item('Corazón de Hielo', { type: ['Defensa', 'Soporte'], effect_tags: ['defensa_fisica', 'debuff_enemigo'], armor: 80, situational_role: ['counter', 'defensivo'] }),
  item('Cota de Espinas', { type: ['Defensa'], effect_tags: ['defensa_fisica', 'anti_curacion'], armor: 75, situational_role: ['counter', 'defensivo'] }),
  item('Ángel Guardián', { type: ['Daño Fisico', 'Defensa'], effect_tags: ['revivir', 'defensa_fisica', 'anti_burst'], armor: 40, situational_role: ['defensivo'] }),
  item('Danza de la Muerte', { type: ['Daño Fisico', 'Defensa'], effect_tags: ['reduccion_daño', 'anti_burst', 'defensa_fisica'], armor: 45, situational_role: ['defensivo'] }),
  item('Báculo Abisal', { type: ['Daño Magico'], effect_tags: ['reduccion_resistencia_magica'] }),
  // Soporte, tanque puro, daño mágico con defensa y botas (como en el catálogo real).
  item('Relicario de los Solari de Hierro', { type: ['Soporte'], effect_tags: ['escudo_aliado', 'anti_burst', 'defensa_fisica', 'defensa_magica'], situational_role: ['defensivo', 'utilidad'] }),
  item('Bendición de Mikael', { type: ['Soporte'], effect_tags: ['limpieza_cc', 'curacion_aliada'], situational_role: ['counter', 'defensivo', 'utilidad'] }),
  item('Presagio de Randuin', { type: ['Defensa'], effect_tags: ['defensa_fisica', 'anti_burst'], armor: 75, situational_role: ['defensivo'] }),
  item('Reloj de Arena de Zhonya', { type: ['Daño Magico', 'Defensa'], effect_tags: ['invulnerabilidad', 'anti_burst'], armor: 45, situational_role: ['defensivo'] }),
  item('Botas de Mercurio', { category: 'Nivel Medio', type: ['Movimiento'], tenacity: 30, magic_res: 25 }),
  item('Orbe del Infinito', { type: ['Daño Magico'], effect_tags: ['penetracion_magica'] }),
];

export const runes = [
  { id: 'conq', name: 'Conquistador', branch: 'Clave', trigger_tags: ['impacto_campeon', 'combate_extendido'] },
  // Disparadores como en el catálogo real (Cadencia Letal): runa de velocidad de ataque.
  { id: 'lethal', name: 'Ritmo Letal', branch: 'Clave', trigger_tags: ['autoataque', 'golpes_consecutivos', 'combate_extendido', 'impacto_campeon'] },
  { id: 'electro', name: 'Electrocutar', branch: 'Clave', trigger_tags: ['impacto_habilidad'] },
  { id: 'comet', name: 'Cometa Arcano', branch: 'Clave', trigger_tags: ['impacto_habilidad', 'impacto_campeon'] },
  { id: 'grasp', name: 'Agarre del Perpetuo', branch: 'Clave', trigger_tags: ['combate_extendido', 'autoataque', 'impacto_campeon'] },
];

export const catalog = { champions, items, runes };

let nextId = 1;
/**
 * Partida con valores por defecto: Garen top vs Darius, composición conocida que no
 * activa ninguna amenaza (1 curador, 2,5 de daño físico y 2,5 de mágico, 2 con control).
 */
export function match(fields = {}) {
  const id = nextId++;
  return {
    id: `m${id}`,
    date: '2026-11-01',
    hour: null,
    result: 'win',
    lane: 'top',
    own_champion_name: 'Garen',
    enemy_champion_name: 'Darius',
    enemy_champions: ['Darius', 'Jinx', 'Lux', 'Malphite', 'Kayle'],
    ally_champions: [],
    items_used: ['Hidra Titánica', 'Cuchilla Negra', 'Filo Infinito'],
    runes_used: ['Conquistador'],
    kills: 5, deaths: 3, assists: 5,
    duration_minutes: 18,
    created_at: '2026-11-01T12:00:00Z',
    ...fields,
  };
}

/** n partidas iguales con un día distinto cada una (evita sesiones). */
export function many(count, fields = {}, startDay = 1) {
  return Array.from({ length: count }, (_, index) => {
    const day = String(((startDay + index - 1) % 28) + 1).padStart(2, '0');
    return match({ date: `2026-10-${day}`, created_at: `2026-10-${day}T12:00:00Z`, ...fields });
  });
}
