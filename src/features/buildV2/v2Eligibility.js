import { championBuildFit, itemFitsChampion } from './v2BuildAudit.js';
import { championClasses } from './v2DraftProfile.js';

const normalizeText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const flattenText = values => normalizeText(values.flat(Infinity).filter(Boolean).join(' '));

export function championCanHealOrShieldAllies(champion) {
  const capabilities = flattenText([
    champion?.traits,
    champion?.item_scalings,
    champion?.tags,
    champion?.strategic_notes,
  ]);
  return [
    'curacion_aliada',
    'escudo_aliado',
    'poder_curacion',
    'poder_escudo',
    'curacion a aliados',
    'escudo a aliados',
  ].some(capability => capabilities.includes(capability));
}

export function requiresChampionAllyHealOrShield(entity) {
  const description = normalizeText(entity?.description);
  // Tags exactos (con guion bajo, sin tildes): 'recibir_daño' queda 'recibir_dano'.
  const triggers = new Set((entity?.trigger_tags || []).map(normalizeText));
  const conditionalDescription = [
    /cuando curas o escudas a un campeon aliado/,
    /curar u otorgar escudos a un aliado/,
    /habilidad que lances para curar u otorgar un escudo a un aliado/,
    /si otorgas a un aliado curaciones o escudos/,
    /al curar y otorgar escudos/,
  ].some(pattern => pattern.test(description));
  const onlyHealShieldTriggers = ['curar', 'escudar'].some(trigger => triggers.has(trigger)) &&
    !['autoataque', 'impacto_campeon', 'impacto_habilidad', 'recibir_dano', 'cerca_aliado', 'lanzar_ulti']
      .some(trigger => triggers.has(trigger));
  return conditionalDescription || Boolean(onlyHealShieldTriggers);
}

/**
 * Hechizos que se llevan en la línea (fits_lanes): Teleportación no va en support ni
 * Curación en top. Un hechizo sin fits_lanes cargado se mantiene. Castigo lo resuelven
 * las reglas de jungla.
 */
export function spellFitsLane(spell, role) {
  const lanes = (spell?.fits_lanes || []).map(normalizeText);
  return !role || !lanes.length || lanes.includes(normalizeText(role));
}

/**
 * Catálogo que ve la IA para este campeón y rol:
 * - hechizos de la línea (fits_lanes);
 * - sin piezas de encantador si el campeón no cura ni escuda aliados;
 * - sin temática (`themed` false), solo objetos, runas y hechizos de su clase: lo mismo
 *   que exige la auditoría (v2BuildAudit.js). Mostrarle a la IA piezas que después se
 *   descartan cuesta tokens, tiempo y errores. Con temática ve todo: el usuario puede pedir
 *   algo fuera de la clase.
 */
export function createEligibleV2Snapshot(snapshot, championId, role = null, { themed = false } = {}) {
  const spells = (snapshot.spells || []).filter(spell => spellFitsLane(spell, role));
  const laneSnapshot = spells.length === (snapshot.spells || []).length ? snapshot : { ...snapshot, spells };
  const eligible = withAllyHealShieldEligibility(laneSnapshot, championId);
  return role && !themed ? withClassEligibility(eligible, championId, role) : eligible;
}

/** Objetos mínimos para que la IA tenga de dónde elegir; con menos, se muestra todo. */
const MIN_CLASS_ITEMS = 12;

const fitsClasses = (entity, classes) => {
  const list = (entity?.fits_classes || []).map(normalizeText);
  return !list.length || list.some(value => classes.has(value));
};

/** Runas suficientes para armar una página: clave, una rama con los grupos 1-3 y otra rama. */
function viableRunes(runes) {
  const regular = runes.filter(rune => rune.branch !== 'Clave');
  const full = [...new Set(regular.map(rune => rune.branch))]
    .filter(branch => [1, 2, 3].every(group => regular.some(rune => rune.branch === branch && Number(rune.group) === group)));
  return runes.some(rune => rune.branch === 'Clave') && full.some(branch => regular.some(rune => rune.branch !== branch));
}

function withClassEligibility(snapshot, championId, role) {
  const champion = snapshot.champions.find(candidate => String(candidate.id) === String(championId));
  if (!champion) return snapshot;
  const fit = championBuildFit(champion, role);
  const classes = championClasses(champion, role);
  const classItems = snapshot.coreItems.filter(item => itemFitsChampion(item, fit));
  const coreItems = classItems.length >= MIN_CLASS_ITEMS ? classItems : snapshot.coreItems;
  const classRunes = snapshot.runes.filter(rune => fitsClasses(rune, classes));
  const runes = viableRunes(classRunes) ? classRunes : snapshot.runes;
  const isSmite = spell => normalizeText(spell.name).trim() === 'castigo';
  const classSpells = snapshot.spells.filter(spell => isSmite(spell) || fitsClasses(spell, classes));
  const spells = classSpells.filter(spell => !isSmite(spell)).length >= 2 ? classSpells : snapshot.spells;
  const kept = new Set(coreItems.map(item => String(item.id)));
  const core = new Set(snapshot.coreItems.map(item => String(item.id)));
  return {
    ...snapshot,
    items: snapshot.items.filter(item => !core.has(String(item.id)) || kept.has(String(item.id))),
    coreItems,
    runes,
    spells,
  };
}

// Control de masas del kit (traits). Duro: inmoviliza. Cualquiera: también ralentiza o silencia.
const HARD_CC_TRAITS = ['cc_duro', 'stun', 'root', 'supresion', 'encanto', 'provocacion', 'miedo'];
const ANY_CC_TRAITS = [...HARD_CC_TRAITS, 'cc_blando', 'ralentizacion', 'silencio'];

/** 'hard' si el kit inmoviliza, 'soft' si solo ralentiza o silencia, null si no tiene control. */
export function championCrowdControl(champion) {
  const traits = new Set((champion?.traits || []).map(normalizeText));
  if (HARD_CC_TRAITS.some(trait => traits.has(trait))) return 'hard';
  if (ANY_CC_TRAITS.some(trait => traits.has(trait))) return 'soft';
  return null;
}

/**
 * Qué control tiene que aplicar el propio campeón para activar la pieza: 'hard' (Soberano
 * del Hielo, Valor del Coloso: "inmovilizar a un campeón enemigo"), 'any' (Mandato
 * Imperial, Trampa para Yordles, Invierno Nórdico: aplicar control, ralentizar o reducir el
 * movimiento) o null. No cuentan las que también se activan sin que vos apliques control:
 * Velo del Amanecer ("o te inmovilizan"), Golpe Bajo (vale el control de tus aliados).
 */
export function requiresChampionCrowdControl(entity) {
  const description = normalizeText(entity?.description);
  if (/(^|tras |\. )inmovilizar a un campeon enemigo/.test(description)) return 'hard';
  if ([
    /aplicar control de masas a un campeon enemigo/,
    /al ralentizar o inmovilizar a un campeon enemigo/,
    /reduzcas el movimiento de un campeon enemigo/,
  ].some(pattern => pattern.test(description))) return 'any';
  return null;
}

const canActivateCrowdControl = (entity, crowdControl) => {
  const needed = requiresChampionCrowdControl(entity);
  return !needed || crowdControl === 'hard' || (needed === 'any' && crowdControl === 'soft');
};

/**
 * Sin las piezas que el campeón no puede activar con su kit: las de curar o escudar aliados
 * (si no puede) y las que se activan cuando él aplica control (Mandato Imperial en Kai'Sa).
 * Vale también con temática: es una imposibilidad mecánica, no un criterio.
 */
function withAllyHealShieldEligibility(snapshot, championId) {
  const champion = snapshot.champions.find(candidate => String(candidate.id) === String(championId));
  if (!champion) return snapshot;
  const healsAllies = championCanHealOrShieldAllies(champion);
  const crowdControl = championCrowdControl(champion);
  const usable = entity => (healsAllies || !requiresChampionAllyHealOrShield(entity)) && canActivateCrowdControl(entity, crowdControl);

  const coreItems = snapshot.coreItems.filter(usable);
  const runes = snapshot.runes.filter(usable);
  if (coreItems.length === snapshot.coreItems.length && runes.length === snapshot.runes.length) return snapshot;
  const eligibleCoreIds = new Set(coreItems.map(item => String(item.id)));
  const originalCoreIds = new Set(snapshot.coreItems.map(item => String(item.id)));
  const items = snapshot.items.filter(item =>
    !originalCoreIds.has(String(item.id)) || eligibleCoreIds.has(String(item.id))
  );
  return { ...snapshot, items, coreItems, runes };
}
