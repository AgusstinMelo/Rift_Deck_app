// Conocimiento del catálogo que usa el Coach: índices por nombre e id, amenazas de la
// composición rival y qué respuesta (en objetos) tiene cada una.
// Los valores de los tags son los guardados en la base (en español): current_champions
// (traits, vulnerabilities, roles, damage_type, scaling), current_wr_items (effect_tags,
// situational_role, type, category, good_against) y current_runes (trigger_tags, branch).

/** Clave de comparación de nombres: sin acentos, minúsculas y espacios simples. */
export function keyOf(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim().toLowerCase().replace(/\s+/g, ' ');
}

export const asList = value => {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.flatMap(asList);
  if (typeof value === 'string') {
    const text = value.trim();
    if (text.startsWith('[')) {
      try { return asList(JSON.parse(text)); } catch { /* texto plano */ }
    }
    return text.split(/[,|;\n]+/).map(part => part.trim()).filter(Boolean);
  }
  return [value];
};

const tagSet = value => new Set(asList(value).map(keyOf));
export const hasAnyTag = (value, tags) => {
  const set = value instanceof Set ? value : tagSet(value);
  return tags.some(tag => set.has(keyOf(tag)));
};

/** Índice de una tabla del catálogo por nombre y por id. */
function indexBy(rows) {
  const byName = new Map();
  const byId = new Map();
  (rows || []).forEach(row => {
    if (row?.name) byName.set(keyOf(row.name), row);
    if (row?.original_name) byName.set(keyOf(row.original_name), row);
    if (row?.id != null) byId.set(String(row.id), row);
  });
  return {
    rows: rows || [],
    get: (name, id) => (id != null && byId.get(String(id))) || byName.get(keyOf(name)) || null,
  };
}

// ---------------------------------------------------------------- Campeones

const CC_TRAITS = ['cc_duro', 'stun', 'root', 'miedo', 'supresion', 'encanto', 'provocacion', 'silencio'];
const HEAL_TRAITS = ['autocuracion', 'curacion_aliada', 'dependiente_robo_vida'];
const SHIELD_TRAITS = ['escudo', 'escudo_aliado'];

/** Perfil compacto de un campeón del catálogo. */
export function championProfile(row) {
  if (!row) return null;
  const traits = tagSet(row.traits);
  const roles = tagSet(row.roles);
  const damage = String(row.damage_type || '').toUpperCase();
  const isTank = roles.has('tanque') || traits.has('alta_durabilidad');
  const isSupport = roles.has('soporte');
  const isCarry = !isTank && (roles.has('tirador') || roles.has('mago') || roles.has('asesino'));
  return {
    name: row.name,
    traits,
    roles,
    vulnerabilities: asList(row.vulnerabilities).map(keyOf),
    strongAgainst: asList(row.strong_against).map(keyOf),
    weakAgainst: asList(row.weak_against).map(keyOf),
    scaling: keyOf(row.scaling), // earlygame | midgame | lategame
    damage, // AD | AP | HYBRID
    isTank,
    isSupport,
    /**
     * Cómo arma el campeón: un carry (tirador, mago, asesino) prioriza daño y se defiende
     * con objetos de daño que traen defensa (Ángel Guardián, Fauces de Malmortius), nunca
     * con objetos de tanque; un luchador mezcla; un tanque arma defensa.
     */
    buildClass: isTank ? 'tank' : isCarry && !isSupport ? 'carry' : isSupport ? 'support' : 'fighter',
    isAssassin: roles.has('asesino'),
    isMarksman: roles.has('tirador'),
    isMage: roles.has('mago'),
    healer: hasAnyTag(traits, HEAL_TRAITS),
    hardCc: hasAnyTag(traits, CC_TRAITS),
    burst: roles.has('asesino') || traits.has('dano_burst'),
    shields: hasAnyTag(traits, SHIELD_TRAITS),
    autoAttacker: traits.has('dependiente_autoataques') || traits.has('dependiente_on_hit'),
    abilityBased: traits.has('dependiente_habilidades') && !traits.has('dependiente_autoataques'),
  };
}

// ---------------------------------------------------------------- Objetos

const isFinalItem = item => item?.category === 'Mejorado' && item?.active !== false
  && !asList(item?.type).some(type => ['movimiento', 'encantamiento'].includes(keyOf(type)));

/** Perfil compacto de un objeto: qué respuestas aporta. */
export function itemProfile(row) {
  if (!row) return null;
  const effects = tagSet(row.effect_tags);
  const types = asList(row.type).map(keyOf);
  return {
    name: row.name,
    effects,
    types,
    roles: tagSet(row.situational_role),
    goodAgainst: asList(row.good_against).map(keyOf),
    final: isFinalItem(row),
    armor: Number(row.armor) > 0,
    magicRes: Number(row.magic_res) > 0,
    tenacity: Number(row.tenacity) > 0,
  };
}

/**
 * Amenazas de la composición rival y la respuesta esperada en la build.
 * `present(enemies)` cuenta cuántos rivales la aportan; desde `min` la amenaza está activa.
 * `answers(item)` dice si un objeto la responde. `appliesTo(own)` filtra a quién le
 * corresponde responderla (un tanque no compra penetración contra tanques).
 */
export const THREATS = [
  {
    id: 'healing',
    min: 2,
    count: enemies => enemies.filter(enemy => enemy.healer).length,
    answers: item => item.effects.has('anti_curacion'),
    appliesTo: () => true,
  },
  {
    id: 'magic',
    min: 3,
    count: enemies => enemies.reduce((sum, enemy) => sum + (enemy.damage === 'AP' ? 1 : enemy.damage === 'HYBRID' ? 0.5 : 0), 0),
    // Un carry también se defiende con objetos de daño anti-burst (escudos, Velo, Zhonya).
    answers: (item, own) => item.magicRes || item.effects.has('defensa_magica') || item.effects.has('escudo_hechizo')
      || (own?.buildClass === 'carry' && item.effects.has('anti_burst')),
    appliesTo: () => true,
  },
  {
    id: 'physical',
    min: 3,
    count: enemies => enemies.reduce((sum, enemy) => sum + (enemy.damage === 'AD' ? 1 : enemy.damage === 'HYBRID' ? 0.5 : 0), 0),
    // Un carry también se defiende con Ángel Guardián, Zhonya u otro objeto de daño anti-burst.
    answers: (item, own) => item.armor || item.effects.has('defensa_fisica')
      || (own?.buildClass === 'carry' && ['anti_burst', 'revivir', 'invulnerabilidad'].some(tag => item.effects.has(tag))),
    appliesTo: () => true,
  },
  {
    id: 'cc',
    min: 3,
    count: enemies => enemies.filter(enemy => enemy.hardCc).length,
    answers: item => item.tenacity || ['tenacidad', 'limpieza_cc', 'inmunidad_cc', 'escudo_hechizo'].some(tag => item.effects.has(tag)),
    appliesTo: () => true,
  },
  {
    id: 'burst',
    min: 2,
    count: enemies => enemies.filter(enemy => enemy.burst).length,
    answers: item => ['anti_burst', 'escudo_hechizo', 'invulnerabilidad', 'escudo'].some(tag => item.effects.has(tag)),
    // Los tanques ya responden con vida y resistencias.
    appliesTo: own => !own?.isTank,
  },
  {
    id: 'tanks',
    min: 2,
    count: enemies => enemies.filter(enemy => enemy.isTank).length,
    answers: item => ['penetracion_armadura', 'penetracion_magica', 'dano_vida_porcentual', 'reduccion_armadura',
      'reduccion_resistencia_magica', 'dano_verdadero', 'dano_vida_actual'].some(tag => item.effects.has(tag)),
    appliesTo: own => Boolean(own) && !own.isTank && !own.isSupport,
  },
  {
    id: 'shields',
    min: 2,
    count: enemies => enemies.filter(enemy => enemy.shields).length,
    answers: item => item.effects.has('anti_escudo'),
    appliesTo: own => Boolean(own) && !own.isTank && !own.isSupport,
  },
];

const DAMAGE_TYPES = ['dano fisico', 'dano magico'];

/**
 * Tipos de daño con los que arma el jugador ese campeón: los que vienen de sus objetos
 * finales en sus partidas (Kai'Sa figura como híbrida, pero si la armás de ataque, de
 * ataque). Sin historial, se deduce del catálogo y del rol.
 */
function damageTypesFor(own, preferredTypes) {
  if (preferredTypes?.length) return preferredTypes;
  if (own.damage === 'AD') return ['dano fisico'];
  if (own.damage === 'AP') return ['dano magico'];
  if (own.isMarksman) return ['dano fisico'];
  if (own.isMage) return ['dano magico'];
  return DAMAGE_TYPES;
}

/**
 * ¿El objeto tiene sentido en la build de este campeón?
 * - carry: solo objetos de su tipo de daño (los de defensa pura o de soporte, nunca).
 * - luchador: su tipo de daño o defensa.
 * - tanque: defensa.
 * - support: soporte, defensa o su tipo de daño.
 */
export function fitsBuild(item, own, preferredTypes) {
  if (!item || !own) return false;
  const damageTypes = damageTypesFor(own, preferredTypes);
  const ofDamage = item.types.some(type => damageTypes.includes(type));
  switch (own.buildClass) {
    case 'tank': return item.types.includes('defensa');
    case 'carry': return ofDamage;
    case 'support': return ofDamage || item.types.includes('soporte') || item.types.includes('defensa');
    default: return ofDamage || item.types.includes('defensa');
  }
}

/** Tipos de daño (de objetos finales) que el jugador arma con un campeón. */
export function preferredDamageTypes(rows) {
  const counts = new Map();
  let total = 0;
  rows.forEach(row => row.itemProfiles.forEach(item => {
    if (!item.final) return;
    item.types.filter(type => DAMAGE_TYPES.includes(type)).forEach(type => {
      counts.set(type, (counts.get(type) || 0) + 1);
      total += 1;
    });
  }));
  if (total < 4) return [];
  return [...counts].filter(([, count]) => count / total >= 0.3).map(([type]) => type);
}

/**
 * Objetos finales del parche actual que responden a una amenaza y encajan con la build
 * del campeón. Prioriza los que el jugador ya compró y los marcados como "counter".
 */
export function suggestItems(catalog, own, answers, { boughtKeys = new Set(), preferredTypes = [], limit = 2 } = {}) {
  if (!own) return [];
  return catalog.items.rows
    .map(row => ({ row, item: catalog.itemProfile(row) }))
    .filter(({ item }) => item?.final && answers(item, own) && fitsBuild(item, own, preferredTypes))
    .map(({ row, item }) => ({
      name: row.name,
      score: (boughtKeys.has(keyOf(row.name)) ? 2 : 0) + (item.roles.has('counter') ? 1 : 0) + (item.roles.has('defensivo') ? 0.5 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(entry => entry.name);
}

/** Objetos finales que el catálogo marca como buenos contra un campeón y encajan con la build propia. */
export function itemsGoodAgainst(catalog, own, enemyName, { preferredTypes = [], limit = 2 } = {}) {
  const enemyKey = keyOf(enemyName);
  return catalog.items.rows
    .map(row => ({ row, item: catalog.itemProfile(row) }))
    .filter(({ item }) => item?.final && item.goodAgainst.includes(enemyKey) && fitsBuild(item, own, preferredTypes))
    .sort((a, b) => Number(b.item.roles.has('counter')) - Number(a.item.roles.has('counter')) || a.row.name.localeCompare(b.row.name))
    .slice(0, limit)
    .map(({ row }) => row.name);
}

// ---------------------------------------------------------------- Runas

/** Perfil de una runa clave: qué la activa. */
export function runeProfile(row) {
  if (!row) return null;
  return {
    name: row.name,
    keystone: keyOf(row.branch) === 'clave',
    triggers: tagSet(row.trigger_tags),
  };
}

/** Catálogo indexado con perfiles memorizados. */
export function buildCatalog({ champions = [], items = [], runes = [] } = {}) {
  const cache = new Map();
  const memo = (kind, fn) => row => {
    if (!row) return null;
    const key = `${kind}:${row.id ?? row.name}`;
    if (!cache.has(key)) cache.set(key, fn(row));
    return cache.get(key);
  };
  const championIndex = indexBy(champions);
  const itemIndex = indexBy(items);
  const runeIndex = indexBy(runes);
  const champion = memo('c', championProfile);
  const item = memo('i', itemProfile);
  const rune = memo('r', runeProfile);
  return {
    champions: championIndex,
    items: itemIndex,
    runes: runeIndex,
    champion: (name, id) => champion(championIndex.get(name, id)),
    item: name => item(itemIndex.get(name)),
    rune: name => rune(runeIndex.get(name)),
    itemProfile: item,
    size: { champions: champions.length, items: items.length, runes: runes.length },
  };
}
