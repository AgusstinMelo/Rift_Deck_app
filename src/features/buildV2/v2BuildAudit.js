// Auditoría de la build que propone la IA: la IA elige, y esta capa confirma que la
// build sea la mejor para el campeón y el draft, o la corrige con reglas firmes:
// - un carry no arma objetos de tanque (se defiende con objetos de daño que protegen);
// - Filo del Infinito sin otros objetos de crítico casi no rinde: se cambia por un
//   objeto de daño que siga el plan;
// - contra curaciones (señal "curacion" del draft), heridas graves antes del 3er objeto;
// - el defensivo de un carry va después de su núcleo de daño (4º o 5º);
// - Filo del Infinito nunca entre los dos primeros.
// Con una temática pedida por el usuario solo se aplican las reglas de orden firmes:
// el usuario está "jugando" con la build y manda lo que pidió.
import { tr } from '../../i18n/uiI18n.js';
import { championProfile, fitsBuild, inLane, isEnchanter, itemProfile } from '../coach/catalog.js';

const normalize = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const isInfinity = row => normalize(row?.name) === 'filo del infinito';
const critOf = row => Number(row?.critical_impact) > 0;
const isDamage = profile => profile.types.some(type => type === 'dano fisico' || type === 'dano magico');
/** Estadísticas de daño de un objeto (lo que hace que también sea ofensivo). */
const hasOffensiveStats = row => ['attack_damage', 'attack_speed', 'ability_power', 'critical_impact'].some(key => Number(row?.[key]) > 0);
/**
 * Defensivo: objeto de defensa o marcado como defensivo (Ángel Guardián, Fauces, Zhonya),
 * salvo los que también son ofensivos y traen estadísticas de daño (Terminus: daño al
 * impacto con resistencias de yapa). Sterak se marca ofensivo pero solo da vida: defensivo.
 */
const isDefensiveItem = (profile, row) => (profile.types.includes('defensa') || profile.roles.has('defensivo'))
  && !(profile.roles.has('ofensivo') && hasOffensiveStats(row));
const isDefensive = profile => isDefensiveItem(profile, profile.row);
/** Objeto de tanque: defensa sin daño ni soporte (Corazón de Hielo, Cota de Espinas). */
const isTankItem = profile => profile.types.includes('defensa') && !isDamage(profile) && !profile.types.includes('soporte');
const isAntiheal = profile => profile.effects.has('anti_curacion');
/** "A", "A y B", "A, B y C". */
const listOf = names => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')}${tr('coachEngine.and')}${names.at(-1)}`);

/** El perfil del objeto con su fila (para mirar estadísticas). */
const withRow = (profile, row) => (profile ? { ...profile, row } : profile);

/** Nombre corto de la regla a partir de la clave del texto ('buildV2.audit.tankItemReason' → 'tankItem'). */
const ruleOf = key => key.replace('buildV2.audit.', '').replace(/Reason$/, '').split('.')[0];

/** Objetos con crítico mínimos además del Filo para que su multiplicador rinda. */
const MIN_OTHER_CRIT = 2;
/** Slot (índice) desde el que puede ir el defensivo de un carry y hasta el que tiene que estar el antiheal. */
const CARRY_DEFENSE_FROM = 3;
const ANTIHEAL_BY = 2;
const INFINITY_FROM = 2;
/** Defensivos máximos de un carry: más que eso le quita el daño que es su trabajo. */
const CARRY_MAX_DEFENSIVE = 2;

/** Estadística del objeto que corresponde a cada valor de item_scalings del campeón. */
const SCALING_STATS = {
  daño_ataque: row => Number(row.attack_damage) > 0,
  velocidad_ataque: row => Number(row.attack_speed) > 0,
  on_hit: (row, profile) => profile.effects.has('dano_on_hit'),
  poder_habilidad: row => Number(row.ability_power) > 0,
  aceleracion_habilidad: row => Number(row.ability_haste) > 0,
  vida: row => Number(row.life) > 0,
  armadura: row => Number(row.armor) > 0,
  resistencia_magica: row => Number(row.magic_res) > 0,
  penetracion_armadura_porcentual: row => Number(row.percentage_armor_penetration) > 0,
  penetracion_armadura_plana: row => Number(row.flat_armor_penetration) > 0,
  penetracion_magica_porcentual: row => Number(row.percentage_magic_penetration) > 0,
  penetracion_magica_plana: row => Number(row.flat_magic_penetration) > 0,
  vampirismo_fisico: row => Number(row.physic_vamp) > 0 || Number(row.lifesteal) > 0,
  velocidad_movimiento: row => Number(row.percentage_movement) > 0 || Number(row.flat_movement) > 0,
};
/** Estadísticas de luchador o tanque: restan si el campeón no escala con ellas. */
const BULK_STATS = ['vida', 'armadura', 'resistencia_magica'];

/**
 * Cuánto aprovecha el campeón las estadísticas del objeto (item_scalings): suma por cada
 * una con la que escala y resta las de aguante que no usa (La Cuchilla Oscura en Kai'Sa).
 */
export function scalingFit(row, profile, scalings) {
  if (!scalings.size) return 0;
  const matched = Object.entries(SCALING_STATS).filter(([key, has]) => scalings.has(key) && has(row, profile)).length;
  const wasted = BULK_STATS.filter(key => !scalings.has(key) && SCALING_STATS[key](row, profile)).length;
  return matched - wasted;
}

/** Tipos de daño que arma el campeón: un híbrido que escala con poder de habilidad suma los mágicos (Kai'Sa, Guinsoo). */
function damageTypesOf(own, scalings) {
  if (own.damage !== 'HYBRID') return [];
  const types = ['dano fisico'];
  if (scalings.has('poder_habilidad')) types.push('dano magico');
  return types;
}

/**
 * Cómo arma el campeón en esa línea: su perfil de clase (carry, luchador, tanque o
 * support), con qué escala su kit y qué tipos de daño compra.
 */
export function championBuildFit(champion, role) {
  if (!champion) return null;
  const own = inLane(championProfile(champion), role);
  const scalings = new Set((champion.item_scalings || []).map(value => String(value).trim().toLowerCase()));
  return { own, scalings, preferred: damageTypesOf(own, scalings) };
}

/** ¿El objeto encaja con la clase del campeón? (lo mismo que exige la auditoría). */
export function itemFitsChampion(row, buildFit) {
  const profile = itemProfile(row);
  if (!profile || !buildFit) return true;
  if (buildFit.own.buildClass === 'carry' && isTankItem(profile)) return false;
  return fitsBuild(profile, buildFit.own, buildFit.preferred);
}

/**
 * El mejor objeto del catálogo para reemplazar uno de la build: encaja con la clase del
 * campeón, cumple `need`, aprovecha sus item_scalings y comparte efectos y tipo de daño
 * con lo que ya arma.
 */
function bestReplacement(snapshot, own, entries, need, scalings = new Set()) {
  const preferred = damageTypesOf(own, scalings);
  const used = new Set(entries.map(entry => String(entry.row.id)));
  const keptEffects = new Set(entries.flatMap(entry => [...entry.profile.effects]));
  const keptTypes = new Set(entries.flatMap(entry => entry.profile.types));
  return snapshot.coreItems
    .filter(row => !used.has(String(row.id)))
    .map(row => ({ row, profile: withRow(itemProfile(row), row) }))
    .filter(({ row, profile }) => profile && fitsBuild(profile, own, preferred) && need(profile, row))
    .map((candidate, index) => ({
      ...candidate,
      index,
      score: 2 * scalingFit(candidate.row, candidate.profile, scalings)
        + [...candidate.profile.effects].filter(tag => keptEffects.has(tag)).length
        + (candidate.profile.types.some(type => keptTypes.has(type)) ? 1 : 0)
        + (candidate.profile.roles.has('core') ? 1 : 0)
        + (candidate.profile.roles.has('ofensivo') ? 0.5 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0] || null;
}

/** Mueve la entrada `entry` a la posición `index`. */
const moveTo = (entries, entry, index) => {
  const rest = entries.filter(other => other !== entry);
  rest.splice(Math.min(index, rest.length), 0, entry);
  return rest;
};

/**
 * @param {{
 *   coreItems: { id: string, reason: string }[], snapshot: any,
 *   fit?: { champion: any, lane: string, profile: { enemy_signals: { signal: string, champions: string[] }[] } } | null,
 *   themed?: boolean, nameOf?: (entity: any) => string,
 * }} input
 * @returns {{ coreItems: { id: string, reason: string }[], notes: string[], changes: string[] }}
 *   `changes`: la regla de cada cambio (para el registro build_v2_audit_log).
 */
export function auditCoreItems({ coreItems, snapshot, fit = null, themed = false, nameOf = entity => entity?.name || '' }) {
  const rows = new Map(snapshot.coreItems.map(row => [String(row.id), row]));
  let entries = coreItems
    .map(selection => ({ selection, row: rows.get(String(selection.id)) }))
    .filter(entry => entry.row)
    .map(entry => ({ ...entry, profile: withRow(itemProfile(entry.row), entry.row) }));
  const notes = [];
  const changes = [];
  const own = fit?.champion ? inLane(championProfile(fit.champion), fit.lane) : null;
  const carry = own?.buildClass === 'carry';
  // Con qué escala el kit (tags tal como se guardan, con ñ).
  const scalings = new Set((fit?.champion?.item_scalings || []).map(value => String(value).trim().toLowerCase()));
  // Del lado que viene el daño rival: a igual encaje, se queda el defensivo que lo resiste.
  const damage = fit?.profile?.enemy_damage || { physical: 0, magic: 0 };
  const resistsDraft = row => (damage.magic >= damage.physical + 1 && Number(row.magic_res) > 0 ? 1 : 0)
    + (damage.physical >= damage.magic + 1 && Number(row.armor) > 0 ? 1 : 0);
  const healers = fit?.profile?.enemy_signals?.find(entry => entry.signal === 'curacion')?.champions || [];
  const needsAntiheal = !themed && own && healers.length > 0 && !isEnchanter(own) && own.buildClass !== 'support';

  const replace = (entry, need, reasonKey, noteKey) => {
    const next = bestReplacement(snapshot, own, entries.filter(other => other !== entry), need, scalings);
    if (!next) return false;
    const vars = { removed: nameOf(entry.row), item: nameOf(next.row), names: listOf(healers) };
    entries = entries.map(other => (other === entry
      ? { selection: { id: String(next.row.id), reason: tr(reasonKey, vars) }, row: next.row, profile: next.profile }
      : other));
    notes.push(tr(noteKey, vars));
    changes.push(ruleOf(reasonKey));
    return true;
  };

  if (!themed && own) {
    // Un carry no arma objetos de tanque.
    if (carry) {
      // Primero un objeto de daño que defienda; si no queda ninguno libre, uno de daño.
      entries.filter(entry => isTankItem(entry.profile)).forEach(entry => replace(
        entry, profile => isDamage(profile) && isDefensive(profile), 'buildV2.audit.tankItemReason', 'buildV2.audit.tankItemNote',
      ) || replace(entry, isDamage, 'buildV2.audit.tankItemReason', 'buildV2.audit.tankItemNote'));
    }
    // Un carry con más de dos defensivos: sobran los que menos aprovecha su kit (Sterak en Kai'Sa).
    if (carry) {
      const defensive = entries.filter(entry => isDefensive(entry.profile));
      defensive
        .map((entry, index) => ({ entry, index, fit: scalingFit(entry.row, entry.profile, scalings) + resistsDraft(entry.row) }))
        .sort((a, b) => a.fit - b.fit || b.index - a.index)
        .slice(0, Math.max(0, defensive.length - CARRY_MAX_DEFENSIVE))
        .forEach(({ entry }) => replace(entry, (profile, row) => isDamage(profile) && !isDefensive(profile) && !(isInfinity(row)),
          'buildV2.audit.tooDefensiveReason', 'buildV2.audit.tooDefensiveNote'));
    }
    // Resistencia del lado equivocado: contra un equipo que pega casi todo físico, un objeto
    // cuya única defensa es resistencia mágica (Al Filo de la Cordura) casi no protege, y al revés.
    const side = damage.physical >= 3 && damage.physical >= damage.magic + 2 ? 'physical'
      : damage.magic >= 3 && damage.magic >= damage.physical + 2 ? 'magic' : null;
    if (side && ['carry', 'fighter'].includes(own.buildClass)) {
      const armorOf = row => Number(row.armor) > 0;
      const resistOf = row => Number(row.magic_res) > 0;
      const wrongSide = row => (side === 'physical' ? resistOf(row) && !armorOf(row) : armorOf(row) && !resistOf(row));
      const rightSide = row => (side === 'physical' ? armorOf(row) : resistOf(row));
      entries.filter(entry => wrongSide(entry.row)).forEach(entry => {
        const reason = `buildV2.audit.wrongSide.${side}.reason`;
        const note = `buildV2.audit.wrongSide.${side}.note`;
        // Se cambia por defensa del lado correcto (un carry, con objetos de daño que defienden).
        replace(entry, (profile, row) => rightSide(row) && (!carry || isDamage(profile)), reason, note)
          || replace(entry, profile => isDamage(profile) && !isDefensive(profile), reason, note);
      });
    }
    // Filo del Infinito necesita otros objetos de crítico.
    const infinity = entries.find(entry => isInfinity(entry.row));
    if (infinity && entries.filter(entry => entry !== infinity && critOf(entry.row)).length < MIN_OTHER_CRIT) {
      replace(infinity, (profile, row) => isDamage(profile) && !isDefensive(profile) && !critOf(row),
        'buildV2.audit.infinityReason', 'buildV2.audit.infinityNote');
    }
    // Contra curaciones, heridas graves en la build (en lugar del objeto de daño menos central).
    if (needsAntiheal && !entries.some(entry => isAntiheal(entry.profile))) {
      const weakest = [...entries].slice(1).reverse()
        .filter(entry => !isDefensive(entry.profile))
        .sort((a, b) => Number(a.profile.roles.has('core')) - Number(b.profile.roles.has('core')))[0];
      if (weakest) replace(weakest, isAntiheal, 'buildV2.audit.antihealReason', 'buildV2.audit.antihealNote');
    }
  }

  // Orden. El defensivo de un carry, después de su núcleo de daño.
  // Los tres primeros lugares, para los objetos de daño (en el orden de la IA); el resto
  // sigue en su orden. Así ningún defensivo se cuela adelante al mover otro.
  let delayed = [];
  if (!themed && carry) {
    const head = entries.filter(entry => !isDefensive(entry.profile)).slice(0, CARRY_DEFENSE_FROM);
    const reordered = [...head, ...entries.filter(entry => !head.includes(entry))];
    delayed = entries.filter((entry, index) => index < CARRY_DEFENSE_FROM && reordered.indexOf(entry) >= CARRY_DEFENSE_FROM);
    entries = reordered;
  }
  // Filo del Infinito nunca entre los dos primeros (regla firme, también con temática).
  const infinity = entries.find(entry => isInfinity(entry.row));
  if (infinity && entries.indexOf(infinity) < INFINITY_FROM) {
    entries = moveTo(entries, infinity, INFINITY_FROM);
    changes.push('infinitySlot');
  }
  // Heridas graves a tiempo.
  const antiheal = needsAntiheal && entries.find(entry => isAntiheal(entry.profile));
  const antihealLate = antiheal && entries.indexOf(antiheal) > ANTIHEAL_BY;
  if (antihealLate) entries = moveTo(entries, antiheal, ANTIHEAL_BY);
  // Las notas, con la posición final de cada objeto.
  const slotOf = entry => entries.indexOf(entry) + 1;
  delayed.forEach(() => changes.push('defenseLater'));
  if (antihealLate) changes.push('antihealEarlier');
  delayed.forEach(entry => notes.push(tr('buildV2.audit.defenseLaterNote', { item: nameOf(entry.row), slot: slotOf(entry) })));
  if (antihealLate) notes.push(tr('buildV2.audit.antihealEarlierNote', { item: nameOf(antiheal.row), names: listOf(healers), slot: slotOf(antiheal) }));
  return { coreItems: entries.map(entry => entry.selection), notes, changes };
}

/**
 * Runas y hechizos: cada pieza tiene que ser para la clase del campeón (fits_classes; sin
 * dato, se acepta). La que no lo es se cambia por otra del mismo lugar (misma rama y grupo
 * para las principales, otra rama para la secundaria, otra clave para la clave) que sí lo
 * sea, prefiriendo la que responde a más señales del rival (counters). Con temática no se
 * toca nada.
 * @returns {{ keystone: any, primaryRunes: any[], secondaryRune: any, spells: any[], notes: string[], changes: { runes: number, spells: number } }}
 */
export function auditRunesAndSpells({ keystone, primaryRunes, secondaryRune, spells, snapshot, fit = null, themed = false, role = '', nameOf = entity => entity?.name || '' }) {
  const unchanged = { keystone, primaryRunes, secondaryRune, spells, notes: [], changes: { runes: 0, spells: 0 } };
  if (themed || !fit?.champion || !fit.classes?.size) return unchanged;
  const notes = [];
  const runes = new Map((snapshot.runes || []).map(rune => [String(rune.id), rune]));
  const spellRows = new Map((snapshot.spells || []).map(spell => [String(spell.id), spell]));
  const fitsClass = entity => {
    const classes = (entity?.fits_classes || []).map(normalize);
    return !classes.length || classes.some(value => fit.classes.has(value));
  };
  const answers = entity => (entity?.counters || []).map(normalize).filter(tag => fit.signals?.has(tag)).length;
  const used = new Set([keystone, ...(primaryRunes || []), secondaryRune].filter(Boolean).map(selection => String(selection.id)));
  const champion = nameOf(fit.champion);

  /** Cambia la pieza por la mejor de `pool` si no es para la clase. */
  const check = (selection, rows, pool, taken) => {
    const current = rows.get(String(selection?.id));
    if (!current || fitsClass(current)) return selection;
    const next = pool
      .filter(candidate => !taken.has(String(candidate.id)) && fitsClass(candidate) && (candidate.fits_classes || []).length)
      .map((candidate, index) => ({ candidate, index, score: answers(candidate) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.candidate;
    if (!next) return selection;
    taken.delete(String(current.id));
    taken.add(String(next.id));
    const vars = { removed: nameOf(current), item: nameOf(next), champion };
    notes.push(tr('buildV2.audit.classNote', vars));
    return { id: String(next.id), reason: tr('buildV2.audit.classReason', vars) };
  };

  const allRunes = [...runes.values()];
  const keystoneOut = check(keystone, runes, allRunes.filter(rune => rune.branch === 'Clave'), used);
  const primaryOut = (primaryRunes || []).map(selection => {
    const rune = runes.get(String(selection?.id));
    return rune ? check(selection, runes, allRunes.filter(other => other.branch === rune.branch && Number(other.group) === Number(rune.group)), used) : selection;
  });
  const primaryBranch = runes.get(String(primaryOut[0]?.id))?.branch;
  const secondary = runes.get(String(secondaryRune?.id));
  // Secundaria: primero de su misma rama; si ninguna es para la clase, de otra rama que no sea la principal.
  const secondaryOut = secondary
    ? check(secondaryRune, runes, [
      ...allRunes.filter(rune => rune.branch === secondary.branch),
      ...allRunes.filter(rune => rune.branch !== secondary.branch && rune.branch !== primaryBranch && rune.branch !== 'Clave'),
    ], used)
    : secondaryRune;

  const smite = spell => normalize(spell?.name) === 'castigo';
  const jungler = normalize(role) === 'jungler';
  const usedSpells = new Set((spells || []).map(selection => String(selection.id)));
  const runeChanges = notes.length;
  const spellsOut = (spells || []).map(selection => check(selection, spellRows,
    [...spellRows.values()].filter(spell => jungler || !smite(spell)), usedSpells));

  return {
    keystone: keystoneOut, primaryRunes: primaryOut, secondaryRune: secondaryOut, spells: spellsOut, notes,
    changes: { runes: runeChanges, spells: notes.length - runeChanges },
  };
}

/** Efectos de un objeto (effect_tags sin acentos) que responden a cada señal del draft. */
const SIGNAL_ANSWERS = {
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

/**
 * Anotaciones de un objeto para el prompt, calculadas para este campeón y este draft:
 * - answers: señales de enemy_signals a las que responde (tal como se llaman ahí);
 * - kit_fit: cuánto aprovecha el campeón sus estadísticas (item_scalings; negativo =
 *   estadísticas que no usa);
 * - path: camino de daño (critico, al_impacto) cuando lo define.
 * @param {any} row  Objeto del catálogo.
 * @param {{ signals: { signal: string }[], scalings: Set<string> }} context
 */
export function itemAnnotations(row, { signals = [], scalings = new Set() } = {}) {
  const profile = itemProfile(row);
  if (!profile) return {};
  const answers = signals
    .map(entry => entry.signal)
    .filter(signal => (SIGNAL_ANSWERS[normalize(signal)] || []).some(tag => profile.effects.has(tag))
      || (normalize(signal) === 'dano_fisico' && Number(row.armor) > 0)
      || (normalize(signal) === 'dano_magico' && Number(row.magic_res) > 0));
  const path = critOf(row) || profile.effects.has('modificador_critico') ? 'critico'
    : profile.effects.has('dano_on_hit') ? 'al_impacto' : null;
  return {
    answers: [...new Set(answers)],
    kit_fit: scalings.size ? scalingFit(row, profile, scalings) : null,
    path,
  };
}
