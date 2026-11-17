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

/** Tipos de objeto que hacen daño (claves sin acentos, ver keyOf). */
const DAMAGE_TYPES = ['dano fisico', 'dano magico'];

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
    /**
     * Cómo juega de support (solo cuenta en esa línea, ver `inLane`): engage (tanques como
     * Leona o Nautilus), mago (Lux, Seraphine), encantador (Soraka, Janna, Lulu) o de pelea
     * (luchadores, asesinos y tiradores que bajan a support: Sett, Pyke, Senna).
     */
    supportStyle: isTank ? 'engage'
      : isSupport && !roles.has('tirador') && !roles.has('mago') ? 'enchanter'
        : roles.has('mago') ? 'mage' : 'fighter',
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

const classProfiles = new WeakMap();

/**
 * El mismo campeón jugando con otra clase de build (memorizado por perfil y clase):
 * - support: arma objetos de soporte y su trabajo es proteger o iniciar;
 * - carry: prioriza daño (Soraka mid, Malphite full AP);
 * - tank: arma defensa (Leona top).
 */
export function withBuildClass(own, buildClass) {
  if (!own || !buildClass || own.buildClass === buildClass) return own;
  const base = own.base || own;
  if (!classProfiles.has(base)) classProfiles.set(base, new Map());
  const cache = classProfiles.get(base);
  if (!cache.has(buildClass)) {
    cache.set(buildClass, {
      ...base,
      base,
      buildClass,
      isSupport: buildClass === 'support',
      isTank: buildClass === 'tank' ? true : buildClass === 'carry' ? false : base.isTank,
    });
  }
  return cache.get(buildClass);
}

/**
 * Perfil del campeón según la línea en que se jugó, cuando el rol del catálogo no alcanza:
 * - en support, Leona (Tanque) o Lux (Maga) arman y juegan como supports;
 * - un support del catálogo en otra línea (Soraka mid, Lulu top) juega de carry.
 * Picks de otra clase en su línea (Malphite mid full AP) los resuelve `observedBuildClass`.
 */
export function inLane(own, lane) {
  if (!own || !lane) return own;
  if (lane === 'support') return withBuildClass(own, 'support');
  if (own.buildClass === 'support') return withBuildClass(own, 'carry');
  return own;
}

/** Objetos finales mínimos para deducir la clase por lo que el jugador arma. */
const OBSERVED_MIN_ITEMS = 6;

/**
 * Clase que muestra lo que el jugador arma con un campeón en una línea, cuando contradice
 * la que se deduce del catálogo y la línea (picks exóticos):
 * - un tercio o más de objetos de soporte → support;
 * - mayoría de defensa pura → tank;
 * - un tanque o un support que solo arma daño → carry (Malphite mid full AP).
 * Sin objetos suficientes, null: manda la línea.
 * @param {any} own  Perfil según la línea.
 * @param {{ itemProfiles: any[] }[]} rows  Partidas con ese campeón en esa línea.
 */
export function observedBuildClass(own, rows) {
  if (!own) return null;
  const finals = rows.flatMap(row => row.itemProfiles.filter(item => item.final));
  if (finals.length < OBSERVED_MIN_ITEMS) return null;
  const share = test => finals.filter(test).length / finals.length;
  const damage = item => item.types.some(type => DAMAGE_TYPES.includes(type));
  const support = share(item => item.types.includes('soporte'));
  const defenseOnly = share(item => item.types.includes('defensa') && !damage(item) && !item.types.includes('soporte'));
  if (support >= 0.34) return own.buildClass === 'support' ? null : 'support';
  if (defenseOnly >= 0.6) return own.buildClass === 'tank' ? null : 'tank';
  if (['support', 'tank'].includes(own.buildClass) && support === 0 && defenseOnly === 0) return 'carry';
  return null;
}

/** Support encantador (Soraka, Janna, Lulu): no arma resistencias ni antiheal propios. */
export const isEnchanter = own => own?.buildClass === 'support' && own.supportStyle === 'enchanter';

// ---------------------------------------------------------------- Objetos

const isFinalItem = item => item?.category === 'Mejorado' && item?.active !== false
  && !asList(item?.type).some(type => ['movimiento', 'encantamiento'].includes(keyOf(type)));

/** Botas que ya responden algo (Mercurio, Punteras de Acero...): no las básicas ni los encantamientos. */
const isBoots = item => item?.active !== false && ['Nivel Medio', 'Mejorado'].includes(item?.category)
  && asList(item?.type).some(type => keyOf(type) === 'movimiento')
  && !asList(item?.type).some(type => keyOf(type) === 'encantamiento');

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
    boots: isBoots(row),
    armor: Number(row.armor) > 0,
    magicRes: Number(row.magic_res) > 0,
    tenacity: Number(row.tenacity) > 0,
  };
}

/**
 * Amenazas de la composición rival y la respuesta esperada en la build.
 * `present(enemies)` cuenta cuántos rivales la aportan; desde `min` la amenaza está activa.
 * `boots`: las botas son una respuesta válida (tenacidad, armadura o resistencia mágica).
 * `answers(item)` dice si un objeto la responde. `appliesTo(own)` filtra a quién le
 * corresponde responderla (un tanque no compra penetración contra tanques).
 * `dueBy(own)`: para qué objeto (sin contar botas) ya tendría que estar la respuesta. Con
 * slots libres antes de eso no se puede afirmar que faltó: un carry arma su defensa de
 * 4º o 5º objeto, y en una partida corta todavía no había llegado.
 */
/** Defensa contra daño o burst: el carry la arma al final de su núcleo de daño. */
const defenseDue = own => (own?.buildClass === 'carry' ? 5 : own?.buildClass === 'support' ? 4 : 3);

export const THREATS = [
  {
    id: 'healing',
    dueBy: () => 3,
    min: 2,
    count: enemies => enemies.filter(enemy => enemy.healer).length,
    answers: item => item.effects.has('anti_curacion'),
    // El encantador no tiene antiheal que armar: lo aporta su tirador.
    appliesTo: own => !isEnchanter(own),
  },
  {
    id: 'magic',
    dueBy: defenseDue,
    boots: true,
    min: 3,
    count: enemies => enemies.reduce((sum, enemy) => sum + (enemy.damage === 'AP' ? 1 : enemy.damage === 'HYBRID' ? 0.5 : 0), 0),
    // Un carry también se defiende con objetos de daño anti-burst (escudos, Velo, Zhonya).
    answers: (item, own) => item.magicRes || item.effects.has('defensa_magica') || item.effects.has('escudo_hechizo')
      || (own?.buildClass === 'carry' && item.effects.has('anti_burst')),
    appliesTo: own => !isEnchanter(own),
  },
  {
    id: 'physical',
    dueBy: defenseDue,
    boots: true,
    min: 3,
    count: enemies => enemies.reduce((sum, enemy) => sum + (enemy.damage === 'AD' ? 1 : enemy.damage === 'HYBRID' ? 0.5 : 0), 0),
    // Un carry también se defiende con Ángel Guardián, Zhonya u otro objeto de daño anti-burst.
    answers: (item, own) => item.armor || item.effects.has('defensa_fisica')
      || (own?.buildClass === 'carry' && ['anti_burst', 'revivir', 'invulnerabilidad'].some(tag => item.effects.has(tag))),
    appliesTo: own => !isEnchanter(own),
  },
  {
    id: 'cc',
    dueBy: () => 3,
    boots: true,
    min: 3,
    count: enemies => enemies.filter(enemy => enemy.hardCc).length,
    answers: item => item.tenacity || ['tenacidad', 'limpieza_cc', 'inmunidad_cc', 'escudo_hechizo'].some(tag => item.effects.has(tag)),
    appliesTo: () => true,
  },
  {
    id: 'burst',
    dueBy: defenseDue,
    min: 2,
    count: enemies => enemies.filter(enemy => enemy.burst).length,
    answers: item => ['anti_burst', 'escudo_hechizo', 'invulnerabilidad', 'escudo'].some(tag => item.effects.has(tag)),
    // Los tanques ya responden con vida y resistencias.
    appliesTo: own => !own?.isTank,
  },
  {
    id: 'tanks',
    dueBy: () => 3,
    min: 2,
    count: enemies => enemies.filter(enemy => enemy.isTank).length,
    answers: item => ['penetracion_armadura', 'penetracion_magica', 'dano_vida_porcentual', 'reduccion_armadura',
      'reduccion_resistencia_magica', 'dano_verdadero', 'dano_vida_actual'].some(tag => item.effects.has(tag)),
    appliesTo: own => Boolean(own) && !own.isTank && own.buildClass !== 'support',
  },
  {
    id: 'shields',
    dueBy: () => 4,
    min: 2,
    count: enemies => enemies.filter(enemy => enemy.shields).length,
    answers: item => item.effects.has('anti_escudo'),
    appliesTo: own => Boolean(own) && !own.isTank && own.buildClass !== 'support',
  },
];


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
 * - botas: todos las compran.
 * - carry: solo objetos de su tipo de daño (los de defensa pura o de soporte, nunca).
 * - luchador: su tipo de daño o defensa.
 * - tanque: defensa.
 * - support: encantador, solo objetos de soporte; engage, soporte o defensa; mago,
 *   soporte o su tipo de daño (Zhonya o Banshee ya traen defensa; tanque puro, nunca);
 *   de pelea, soporte, su daño o defensa.
 */
export function fitsBuild(item, own, preferredTypes) {
  if (!item || !own) return false;
  if (item.boots) return true;
  const damageTypes = damageTypesFor(own, preferredTypes);
  const ofDamage = item.types.some(type => damageTypes.includes(type));
  const support = item.types.includes('soporte');
  const defense = item.types.includes('defensa');
  switch (own.buildClass) {
    case 'tank': return defense;
    case 'carry': return ofDamage;
    case 'support':
      if (own.supportStyle === 'enchanter') return support;
      if (own.supportStyle === 'engage') return support || defense;
      if (own.supportStyle === 'mage') return support || ofDamage;
      // De pelea (Sett, Pyke, Senna): soporte, su daño o defensa.
      return support || ofDamage || defense;
    default: return ofDamage || defense;
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
export function suggestItems(catalog, own, answers, { boughtKeys = new Set(), preferredTypes = [], limit = 2, boots = false } = {}) {
  if (!own) return [];
  return catalog.items.rows
    .map(row => ({ row, item: catalog.itemProfile(row) }))
    .filter(({ item }) => (item?.final || (boots && item?.boots)) && answers(item, own) && fitsBuild(item, own, preferredTypes))
    .map(({ row, item }) => ({
      name: row.name,
      score: (boughtKeys.has(keyOf(row.name)) ? 2 : 0) + (item.roles.has('counter') ? 1 : 0) + (item.roles.has('defensivo') ? 0.5 : 0)
        // Las botas son la respuesta más barata y no le quitan un espacio de daño a nadie.
        + (item.boots ? 1 : 0)
        // Un support prefiere lo que también protege a su equipo.
        + (own.buildClass === 'support' && item.roles.has('utilidad') ? 0.75 : 0),
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
