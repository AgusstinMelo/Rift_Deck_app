// Lo que las fichas de objeto y runa de la Biblioteca calculan del catálogo y de tus
// partidas, con los mismos criterios que el Coach y Build V2:
// - campeones que aprovechan un objeto (encaja con su clase y escala con sus estadísticas);
// - objetos que lo contrarrestan (anticuración contra robo de vida, penetración contra
//   resistencias, defensa contra su tipo de daño);
// - campeones que aprovechan una runa (su clase, si su kit la activa y si escalan con lo
//   que da) y objetos que la potencian (los que la activan o suman a lo mismo);
// - tu rendimiento con el objeto o la runa (winrate con y sin, campeones con que la usás).
import { asList, championProfile, itemProfile, keyOf, runeProfile } from '../coach/catalog.js';
import { keystoneFits } from '../coach/detectors/build.js';
import { championBuildFit, itemFitsChampion, scalingFit } from '../buildV2/v2BuildAudit.js';
import { championClasses } from '../buildV2/v2DraftProfile.js';
import {
  championCanHealOrShieldAllies, championCrowdControl, requiresChampionAllyHealOrShield, requiresChampionCrowdControl,
} from '../buildV2/v2Eligibility.js';

const tags = value => new Set(asList(value).map(keyOf));
const stat = (row, key) => Number(row?.[key]) > 0;
const byName = (a, b) => String(a.name).localeCompare(String(b.name));

/** Objeto terminado y activo (lo que se compara entre fichas). */
const isFinalRow = row => row?.active !== false && itemProfile(row)?.final;

// ── Objetos ──────────────────────────────────────────────────────────────────

/** Estadísticas del objeto con las que tiene que escalar un campeón para que cuente. */
const MIN_ITEM_SCALING = 2;
/** Estadísticas de aguante (item_scalings → columna): scalingFit las resta si no las usa. */
const BULK_STATS = { vida: 'life', armadura: 'armor', resistencia_magica: 'magic_res' };

/**
 * Campeones que aprovechan un objeto terminado: el objeto encaja con su clase (lo mismo que
 * exige Build V2) y escala con al menos dos de sus estadísticas. Primero los que menos
 * desperdician (scalingFit), después los que escalan con más. La resistencia de un objeto
 * de daño (Filo de la Cordura) no le quita a nadie el lugar: solo ordena.
 */
export function championsForItem(row, champions, limit = 12) {
  const profile = itemProfile(row);
  if (!profile || (!profile.final && !profile.boots)) return [];
  // Botas: todas dan velocidad de movimiento, así que no cuenta; deciden su clase (cargada o
  // deducida) y la otra estadística (penetración, velocidad de ataque, resistencias, robo de vida).
  const boots = profile.boots;
  const statsRow = boots ? { ...row, flat_movement: 0, percentage_movement: 0 } : row;
  const bootClasses = boots ? (profile.fitsClasses.size ? profile.fitsClasses : inferredItemClasses(row)) : null;
  if (boots && !bootClasses.size) return [];
  return champions
    .map(champion => {
      const fit = championBuildFit(champion);
      if (!fit?.scalings.size) return null;
      if (boots ? ![...championClasses(champion)].some(value => bootClasses.has(value)) : !itemFitsChampion(row, fit)) return null;
      const vamp = ['vampirismo_fisico', 'vampirismo_magico'].filter(tag => profile.effects.has(tag) && fit.scalings.has(tag) && !stat(statsRow, tag === 'vampirismo_fisico' ? 'physic_vamp' : 'magic_vamp')).length;
      const net = scalingFit(statsRow, profile, fit.scalings) + vamp;
      const wasted = Object.entries(BULK_STATS).filter(([scaling, key]) => !fit.scalings.has(scaling) && stat(row, key)).length;
      return { champion, net, matched: net + wasted };
    })
    .filter(entry => entry && entry.matched >= (boots ? 1 : MIN_ITEM_SCALING))
    .sort((a, b) => b.net - a.net || b.matched - a.matched || byName(a.champion, b.champion))
    .slice(0, limit)
    .map(entry => entry.champion);
}

/**
 * Clases a las que sirve un objeto sin fits_classes cargado (las botas), deducidas de lo que
 * da: poder de habilidad → mago; velocidad de ataque → tirador; daño de ataque o penetración
 * de armadura → asesino y luchador; resistencias → tanque y luchador; aceleración o maná sin
 * poder de habilidad → los que lanzan habilidades; robo de vida → los que pegan.
 */
export function inferredItemClasses(row) {
  const profile = itemProfile(row);
  const classes = new Set();
  if (!profile) return classes;
  const ap = stat(row, 'ability_power') || stat(row, 'flat_magic_penetration') || stat(row, 'percentage_magic_penetration');
  const vamp = profile.effects.has('vampirismo_fisico') || profile.effects.has('vampirismo_magico') || stat(row, 'physic_vamp') || stat(row, 'lifesteal');
  if (ap) classes.add('mago');
  if (stat(row, 'attack_speed')) {
    classes.add('tirador');
    if (vamp) classes.add('luchador');
  }
  if (stat(row, 'attack_damage') || stat(row, 'flat_armor_penetration') || stat(row, 'percentage_armor_penetration')) ['asesino', 'luchador'].forEach(value => classes.add(value));
  if (profile.armor || profile.magicRes || profile.tenacity) ['tanque', 'luchador'].forEach(value => classes.add(value));
  if (!ap && stat(row, 'ability_haste')) ['mago', 'soporte', 'luchador', 'tanque'].forEach(value => classes.add(value));
  if (!ap && stat(row, 'mana_reg')) ['mago', 'soporte'].forEach(value => classes.add(value));
  if (vamp && !stat(row, 'attack_speed')) ['luchador', 'asesino', 'tirador'].forEach(value => classes.add(value));
  return classes;
}

/**
 * Cómo se contrarresta un objeto: qué aporta (curación, escudos, resistencias, vida, daño
 * de un tipo) y qué efecto de otro objeto lo responde. Cada uno: `key` (texto en
 * library.contraObjeto.<key>), `applies(row, profile)` y `answers(profile)`.
 */
const ITEM_ANSWERS = [
  {
    key: 'curacion',
    applies: (row, p) => ['vampirismo_fisico', 'vampirismo_magico', 'autocuracion', 'regeneracion_vida', 'curacion_aliada'].some(tag => p.effects.has(tag))
      || ['lifesteal', 'physic_vamp', 'magic_vamp'].some(key => stat(row, key)),
    answers: p => p.effects.has('anti_curacion'),
  },
  {
    key: 'escudos',
    applies: (row, p) => ['escudo', 'escudo_aliado', 'escudo_hechizo'].some(tag => p.effects.has(tag)),
    answers: p => p.effects.has('anti_escudo'),
  },
  {
    key: 'armadura',
    applies: row => stat(row, 'armor'),
    answers: p => p.effects.has('penetracion_armadura') || p.effects.has('reduccion_armadura'),
  },
  {
    key: 'resistenciaMagica',
    applies: row => stat(row, 'magic_res'),
    answers: p => p.effects.has('penetracion_magica') || p.effects.has('reduccion_resistencia_magica'),
  },
  {
    key: 'vida',
    applies: row => Number(row.life) >= 300,
    answers: p => ['dano_vida_porcentual', 'dano_vida_actual'].some(tag => p.effects.has(tag)),
  },
  {
    key: 'danoMagico',
    applies: row => stat(row, 'ability_power'),
    answers: p => p.magicRes || p.effects.has('defensa_magica') || p.effects.has('escudo_hechizo'),
  },
  {
    key: 'danoFisico',
    applies: row => stat(row, 'attack_damage') || stat(row, 'critical_impact'),
    answers: p => p.armor || p.effects.has('defensa_fisica'),
  },
];

/** Grupos de respuesta que se muestran (los primeros que apliquen) y objetos por grupo. */
const MAX_ANSWER_GROUPS = 3;
const ANSWERS_PER_GROUP = 3;

/**
 * Objetos que contrarrestan a `row`, agrupados por lo que responden. Primero los marcados
 * como "counter" y los que responden a más cosas del objeto.
 * @returns {{ key: string, items: object[] }[]}
 */
export function itemCountersFor(row, items) {
  const profile = itemProfile(row);
  if (!profile?.final) return [];
  const applying = ITEM_ANSWERS.filter(entry => entry.applies(row, profile));
  if (!applying.length) return [];
  const candidates = items
    .filter(other => other.id !== row.id && isFinalRow(other))
    .map(other => ({ row: other, profile: itemProfile(other) }));
  const used = new Set();
  return applying
    .map(entry => {
      const list = candidates
        .filter(candidate => entry.answers(candidate.profile) && !used.has(candidate.row.id))
        .map(candidate => ({
          ...candidate,
          score: (candidate.profile.roles.has('counter') ? 2 : 0)
            + applying.filter(other => other.answers(candidate.profile)).length,
        }))
        .sort((a, b) => b.score - a.score || byName(a.row, b.row))
        .slice(0, ANSWERS_PER_GROUP)
        .map(candidate => candidate.row);
      list.forEach(other => used.add(other.id));
      return { key: entry.key, items: list };
    })
    .filter(group => group.items.length)
    .slice(0, MAX_ANSWER_GROUPS);
}

// ── Runas ────────────────────────────────────────────────────────────────────

/** Lo que da la runa (benefit_tags) y con qué item_scalings del campeón rinde más. */
const BENEFIT_SCALINGS = {
  velocidad_ataque: ['velocidad_ataque'],
  dano_on_hit: ['on_hit', 'velocidad_ataque'],
  mana: ['mana'],
  regeneracion_mana: ['mana', 'regeneracion_mana'],
  reduccion_enfriamiento: ['aceleracion_habilidad'],
  reduccion_enfriamiento_ulti: ['aceleracion_habilidad'],
  curacion_aliada: ['poder_curacion'],
  escudo_aliado: ['poder_escudo'],
  vida_escalada: ['vida'],
  defensa_escalada: ['armadura', 'resistencia_magica'],
  armadura: ['armadura'],
  resistencia_magica: ['resistencia_magica'],
  velocidad_movimiento: ['velocidad_movimiento'],
  curacion: ['vampirismo_fisico', 'vampirismo_magico'],
};

/** Disparadores de movilidad: el kit tiene que tener ese desplazamiento. */
const MOBILITY_TRIGGERS = ['dash', 'blink', 'salto'];

/**
 * Qué tan bien le queda una runa a un campeón (null: no la puede usar o no es para su clase).
 * Suma por cada disparador que su kit activa de lleno y por cada beneficio con el que escala.
 */
function runeChampionScore(row, champion) {
  const fitClasses = tags(row.fits_classes);
  if (fitClasses.size && ![...championClasses(champion)].some(value => fitClasses.has(value))) return null;
  if (requiresChampionAllyHealOrShield(row) && !championCanHealOrShieldAllies(champion)) return null;
  const needsCc = requiresChampionCrowdControl(row);
  const cc = championCrowdControl(champion);
  if (needsCc === 'hard' && cc !== 'hard') return null;
  if (needsCc === 'any' && !cc) return null;

  const own = championProfile(champion);
  const triggers = tags(row.trigger_tags);
  const traits = own.traits;
  const mobility = MOBILITY_TRIGGERS.filter(tag => triggers.has(tag));
  if (mobility.length && !mobility.some(tag => traits.has(tag))) return null;
  if (keyOf(row.branch) === 'clave' && keystoneFits(own, runeProfile(row)) === false) return null;

  let score = mobility.length ? 2 : 0;
  if (own.autoAttacker && (triggers.has('autoataque') || triggers.has('golpes_consecutivos'))) score += 1;
  if (own.abilityBased && triggers.has('impacto_habilidad')) score += 1;
  if (needsCc) score += 1;
  if (triggers.has('sigilo') && traits.has('sigilo')) score += 2;
  const benefits = tags(row.benefit_tags);
  // Runas de combo (Electrocutar, Golpe de Gracia): para los que matan de una ráfaga.
  if (own.burst && (triggers.has('golpes_multiples') || triggers.has('objetivo_vida_baja')
    || ['dano_burst', 'dano_ejecucion', 'poder_all_in'].some(tag => benefits.has(tag)))) score += 1;
  // Peleas largas (Conquistador, Agarre): para los que pegan sostenido.
  if ((own.scores.sustained_damage ?? 0) >= 4 && (triggers.has('combate_extendido') || benefits.has('dano_sostenido'))) score += 1;
  // Intercambios cortos (Primer Golpe, Concentración Absoluta): los que pegan de lejos o de un combo.
  if ((triggers.has('trade_corto') || benefits.has('poder_trade')) && (own.burst || own.teamRoles.has('poke') || (own.scores.range ?? 0) >= 4)) score += 1;
  // Derribos (Colección de Ojos, Arrogancia, Leyenda): los que cierran kills.
  if (triggers.has('derribo') && (own.isAssassin || own.burst || own.teamRoles.has('pick'))) score += 1;
  // Escalan con el tiempo (Tormenta Creciente, Crecimiento Excesivo): los de partida larga.
  if ((triggers.has('escalado_tiempo') || benefits.has('dano_escalado')) && own.scaling === 'lategame') score += 1;
  // Rival con control (Golpe Bajo): los que lo aplican.
  if ((triggers.has('enemigo_con_cc') || triggers.has('enemigo_ralentizado')) && (own.hardCc || traits.has('ralentizacion'))) score += 1;
  // Al recibir daño (Coraza Ósea, Segundo Aire, Orbe de Anulación): los que pelean de cerca.
  if (triggers.has('recibir_dano') && (own.isTank || own.teamRoles.has('frontline') || traits.has('melee'))) score += 1;
  // Fuera de combate (Hexdestello, Cazador Implacable): los que buscan entrar por sorpresa.
  if (triggers.has('fuera_combate') && (own.isAssassin || own.teamRoles.has('iniciador') || own.teamRoles.has('pick'))) score += 1;
  [...benefits].forEach(benefit => {
    if ((BENEFIT_SCALINGS[benefit] || []).some(scaling => own.itemScalings.has(scaling))) score += 1;
  });
  return score;
}

/**
 * Campeones que aprovechan una runa: de su clase, que la pueden activar con su kit y que
 * rinden más con lo que da. Sin nada que la ate a un kit, ninguno (la usa cualquiera).
 */
export function championsForRune(row, champions, limit = 12) {
  return champions
    .map(champion => ({ champion, score: runeChampionScore(row, champion) }))
    .filter(entry => entry.score !== null && entry.score >= 1)
    .sort((a, b) => b.score - a.score || byName(a.champion, b.champion))
    .slice(0, limit)
    .map(entry => entry.champion);
}

/**
 * Qué objeto activa o potencia cada disparador o beneficio de una runa. Las claves son las
 * de trigger_tags y benefit_tags (sin tildes).
 */
const RUNE_ITEM_SYNERGY = {
  autoataque: (row, p) => stat(row, 'attack_speed') || ['dano_on_hit', 'dano_autoataque', 'mejora_autoataque'].some(tag => p.effects.has(tag)),
  golpes_consecutivos: (row, p) => stat(row, 'attack_speed') || p.effects.has('dano_on_hit'),
  impacto_habilidad: (row, p) => stat(row, 'ability_haste') || ['dano_habilidad', 'potenciacion_habilidad', 'spellblade'].some(tag => p.effects.has(tag)),
  combate_extendido: (row, p) => p.effects.has('dano_sostenido'),
  curar: (row, p) => stat(row, 'healing_and_shield') || p.effects.has('curacion_aliada'),
  escudar: (row, p) => stat(row, 'healing_and_shield') || p.effects.has('escudo_aliado'),
  movimiento: (row, p) => stat(row, 'percentage_movement') || stat(row, 'flat_movement') || p.effects.has('velocidad_movimiento'),
  distancia_recorrida: (row, p) => stat(row, 'percentage_movement') || stat(row, 'flat_movement') || p.effects.has('velocidad_movimiento'),
  objetivo_vida_baja: (row, p) => p.effects.has('ejecucion') || p.effects.has('dano_vida_faltante'),
  objetivo_vida_alta: (row, p) => p.effects.has('dano_vida_porcentual') || p.effects.has('dano_vida_actual'),
  recibir_dano: (row, p) => p.armor || p.magicRes,
  vida_propia_baja: (row, p) => p.effects.has('revivir') || p.effects.has('anti_burst'),
  enemigo_con_cc: (row, p) => p.effects.has('cc_duro'),
  enemigo_ralentizado: (row, p) => p.effects.has('ralentizacion'),
  dano_burst: (row, p) => p.effects.has('dano_burst'),
  curacion: (row, p) => ['vampirismo_fisico', 'vampirismo_magico'].some(tag => p.effects.has(tag)) || stat(row, 'lifesteal') || stat(row, 'physic_vamp'),
  mana: row => stat(row, 'mana'),
  regeneracion_mana: (row, p) => stat(row, 'mana_reg') || p.effects.has('sosten_mana'),
  velocidad_ataque: row => stat(row, 'attack_speed'),
  reduccion_enfriamiento: row => stat(row, 'ability_haste'),
  reduccion_enfriamiento_ulti: row => stat(row, 'ability_haste'),
  lanzar_ulti: row => stat(row, 'ability_haste'),
  aceleracion_habilidad: row => stat(row, 'ability_haste'),
  derribo: (row, p) => ['ejecucion', 'dano_burst', 'acumulacion'].some(tag => p.effects.has(tag)),
  escalado_tiempo: (row, p) => p.effects.has('escalado') || p.roles.has('escalado') || p.roles.has('late'),
  dano_escalado: (row, p) => p.effects.has('escalado') || p.effects.has('acumulacion'),
  trade_corto: (row, p) => p.effects.has('dano_burst') || p.effects.has('spellblade'),
  poder_trade: (row, p) => p.effects.has('dano_burst') || p.effects.has('spellblade'),
  poder_all_in: (row, p) => ['dano_burst', 'gap_close', 'dash'].some(tag => p.effects.has(tag)),
  fuera_combate: (row, p) => p.effects.has('velocidad_movimiento_fuera_combate') || p.effects.has('velocidad_movimiento'),
  velocidad_movimiento: (row, p) => stat(row, 'percentage_movement') || stat(row, 'flat_movement') || p.effects.has('velocidad_movimiento'),
  armadura: (row, p) => p.armor,
  resistencia_magica: (row, p) => p.magicRes,
  vida_escalada: (row, p) => p.life,
  defensa_escalada: (row, p) => p.armor || p.magicRes,
  resistencia_ralentizacion: (row, p) => p.tenacity || p.effects.has('resistencia_ralentizacion'),
};

/**
 * Objetos terminados que potencian una runa: la activan o suman a lo que da, y son de las
 * mismas clases (si las dos tienen fits_classes). Los que cumplen más cosas primero.
 */
export function itemsForRune(row, items, limit = 12) {
  const keys = [...tags(row.trigger_tags), ...tags(row.benefit_tags)].filter(key => RUNE_ITEM_SYNERGY[key]);
  if (!keys.length) return [];
  const runeClasses = tags(row.fits_classes);
  return items
    .filter(isFinalRow)
    .map(other => ({ other, profile: itemProfile(other) }))
    .filter(({ profile }) => !runeClasses.size || !profile.fitsClasses.size || [...profile.fitsClasses].some(value => runeClasses.has(value)))
    .map(({ other, profile }) => {
      const hits = keys.filter(key => RUNE_ITEM_SYNERGY[key](other, profile)).length;
      // Desempate: los de las mismas clases que la runa y los centrales de una build.
      const classMatch = runeClasses.size && [...profile.fitsClasses].some(value => runeClasses.has(value)) ? 0.5 : 0;
      return { other, hits, score: 2 * hits + classMatch + (profile.roles.has('core') ? 0.5 : 0) };
    })
    .filter(entry => entry.hits > 0)
    .sort((a, b) => b.score - a.score || byName(a.other, b.other))
    .slice(0, limit)
    .map(entry => entry.other);
}

// ── Tus partidas ─────────────────────────────────────────────────────────────

/** Campeones con los que más lo usaste. */
const TOP_CHAMPIONS = 4;

/**
 * Tu rendimiento con un objeto (`field` items_used) o una runa (runes_used): partidas,
 * winrate con y sin, y los campeones con los que más lo usaste.
 * @returns {null | { games: number, wins: number, wr: number, without: { games: number, wr: number } | null,
 *   champions: { name: string, games: number, wr: number }[] }}
 */
export function personalUsage(matches, entityName, field) {
  const key = keyOf(entityName);
  if (!key) return null;
  const decided = matches.filter(match => match.result === 'win' || match.result === 'loss');
  const uses = match => asList(match[field]).some(value => keyOf(value) === key);
  const withIt = decided.filter(uses);
  if (!withIt.length) return { games: 0, wins: 0, wr: 0, without: null, champions: [] };
  const rate = list => list.filter(match => match.result === 'win').length / list.length;
  const others = decided.filter(match => !uses(match));
  const byChampion = new Map();
  withIt.forEach(match => {
    const name = String(match.own_champion_name || '').trim();
    if (!name) return;
    const list = byChampion.get(keyOf(name)) || { name, rows: [] };
    list.rows.push(match);
    byChampion.set(keyOf(name), list);
  });
  return {
    games: withIt.length,
    wins: withIt.filter(match => match.result === 'win').length,
    wr: rate(withIt),
    without: others.length ? { games: others.length, wr: rate(others) } : null,
    champions: [...byChampion.values()]
      .map(entry => ({ name: entry.name, games: entry.rows.length, wr: rate(entry.rows) }))
      .sort((a, b) => b.games - a.games || b.wr - a.wr)
      .slice(0, TOP_CHAMPIONS),
  };
}
