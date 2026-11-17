// Revisión de la temática de la build de una partida: qué armaste (daño, protección o
// defensa) contra lo que pedían las dos composiciones, cruzando el catálogo: quién del
// rival llega a la línea de atrás, a quién de tu equipo hay que cuidar, qué daño le
// falta a tu equipo y contra qué es vulnerable tu campeón.
//
// Por ahora juzga supports que pueden elegir temática (magos y de pelea): el encantador
// siempre protege y el engage siempre arma soporte o defensa. Los carries ya tienen las
// amenazas de la build (anti-burst, resistencias) en `THREATS`.
import { tr } from '../../../i18n/uiI18n.js';
import { keyOf, suggestItems, withBuildClass } from '../catalog.js';

const MOBILITY = ['dash', 'salto', 'blink', 'desplazamiento', 'atraviesa_terreno', 'gap_close'].map(keyOf);
const DIVE_VULNS = ['asesino', 'gap_close', 'dano_burst', 'diver', 'dive', 'acceso_backline'];

/** Objetos finales mínimos para hablar de temática (antes es solo el primer objeto). */
const MIN_FINALS = 2;
/** Aliados y rivales reconocidos mínimos para evaluar las composiciones. */
const MIN_COMP = 3;

const isDamageItem = item => item.types.some(type => type === 'dano fisico' || type === 'dano magico');
const isProtectItem = item => item.types.includes('soporte')
  || ['curacion_aliada', 'escudo_aliado', 'buff_aliado'].some(tag => item.effects.has(tag));

/** Temática de un objeto final: protección (soporte), daño o defensa. */
function themeOf(item) {
  if (isProtectItem(item)) return 'protect';
  if (isDamageItem(item)) return 'damage';
  if (item.types.includes('defensa')) return 'defense';
  return null;
}

/** "A, B y C". */
const listOf = names => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')}${tr('coachEngine.and')}${names.at(-1)}`);

/** Rival que llega a tu línea de atrás: asesino, o cuerpo a cuerpo con movilidad. */
const isDiver = enemy => enemy.isAssassin || (enemy.traits.has('melee') && MOBILITY.some(tag => enemy.traits.has(tag)));

/** Daño mágico que aporta un aliado (los híbridos cuentan la mitad). */
const magicOf = ally => (ally.damage === 'AP' ? 1 : ally.damage === 'HYBRID' ? 0.5 : 0);

/**
 * Lo que pedían las composiciones. Cada lado suma razones con su peso; gana la temática
 * con ventaja clara, si no las dos eran válidas.
 */
export function compNeeds(match) {
  const own = match.own;
  const allies = match.allyProfiles || [];
  const enemies = match.enemyProfiles || [];
  const divers = enemies.filter(isDiver);
  const marksman = allies.find(ally => ally.isMarksman && !ally.isSupport);
  const hypercarry = allies.find(ally => ally.buildClass === 'carry' && ally.scaling === 'lategame');
  const allyMagic = allies.reduce((sum, ally) => sum + magicOf(ally), 0);
  const frontline = allies.filter(ally => ally.isTank).length;
  const ownExposed = DIVE_VULNS.some(tag => own.vulnerabilities.includes(tag));

  const protect = [];
  const damage = [];
  if (divers.length >= 2) {
    protect.push({ weight: divers.length >= 3 ? 2 : 1.5, key: 'divers', vars: { count: divers.length, names: listOf(divers.slice(0, 3).map(enemy => enemy.name)) } });
  }
  if (marksman && divers.length) protect.push({ weight: 1, key: 'carry', vars: { name: marksman.name } });
  else if (hypercarry && divers.length) protect.push({ weight: 0.75, key: 'carry', vars: { name: hypercarry.name } });
  if (enemies.filter(enemy => enemy.burst).length >= 2 && ownExposed) protect.push({ weight: 0.5, key: 'burst', vars: {} });

  // Daño: tiene sentido si tu equipo no lo tenía y el rival no podía castigarte por jugar a pegar.
  if (own.damage === 'AP' && allyMagic < 1) damage.push({ weight: 1.5, key: 'noMagic', vars: {} });
  else if (own.damage === 'AD' && allies.every(ally => ally.damage === 'AP')) damage.push({ weight: 1.5, key: 'noPhysical', vars: {} });
  if (divers.length === 0) damage.push({ weight: 1, key: 'noDive', vars: {} });
  if (frontline >= 1 && divers.length <= 1) damage.push({ weight: 0.5, key: 'frontline', vars: { name: allies.find(ally => ally.isTank).name } });

  const score = list => list.reduce((sum, reason) => sum + reason.weight, 0);
  const protectScore = score(protect);
  const damageScore = score(damage);
  let wanted = null;
  if (protectScore >= 2.5 && protectScore >= damageScore + 1) wanted = 'protect';
  else if (damageScore >= 1.5 && damageScore >= protectScore + 1) wanted = 'damage';
  return { wanted, reasons: { protect, damage }, divers };
}

/** Temática que dominó la build (con al menos dos objetos finales). */
export function builtTheme(match) {
  const finals = match.itemProfiles.filter(item => item.final);
  if (finals.length < MIN_FINALS) return null;
  const counts = { protect: 0, damage: 0, defense: 0 };
  finals.forEach(item => { const theme = themeOf(item); if (theme) counts[theme] += 1; });
  const [theme, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!count) return null;
  return { theme, items: finals.filter(item => themeOf(item) === theme).map(item => item.name) };
}

const reasonText = reasons => reasons
  .sort((a, b) => b.weight - a.weight)
  .slice(0, 2)
  .map(reason => tr(`coachEngine.review.reason.${reason.key}`, reason.vars))
  .join(tr('coachEngine.and'));

/** Objetos de la temática que pedía la partida, de los que encajan con el campeón. */
function itemsFor(ctx, match, wanted, divers) {
  const habits = ctx.buildHabits?.get(match.championKey) || { bought: new Set(), damageTypes: [] };
  const answers = wanted === 'protect'
    // Contra divers, primero lo que salva al aliado del burst (escudos).
    ? item => (divers.length >= 2 ? item.effects.has('escudo_aliado') || item.effects.has('anti_burst') : true) && isProtectItem(item)
    : item => isDamageItem(item) && !item.types.includes('soporte');
  // Se sugiere como support aunque el historial lo marque carry (siempre armado de daño).
  return suggestItems(ctx.catalog, withBuildClass(match.own, 'support'), answers, {
    boughtKeys: new Set([...habits.bought].filter(key => !match.itemKeys.has(key))),
    preferredTypes: habits.damageTypes,
    limit: 2,
  }).filter(name => !match.itemKeys.has(keyOf(name)));
}

/**
 * Revisión de la build de una partida contra las composiciones.
 * @returns {null | { verdict: 'good' | 'shift', text: string, action?: string }}
 */
export function reviewBuild(ctx, match) {
  const own = match.own;
  // En support, con un campeón que puede elegir temática. Si siempre lo armás de daño el
  // historial lo trata como carry, pero sigue siendo el support del equipo.
  if (!own || match.lane !== 'support' || own.buildClass === 'tank' || !['mage', 'fighter'].includes(own.supportStyle)) return null;
  if ((match.allyProfiles || []).length < MIN_COMP || (match.enemyProfiles || []).length < MIN_COMP) return null;
  const built = builtTheme(match);
  if (!built || built.theme === 'defense') return null;
  const { wanted, reasons, divers } = compNeeds(match);
  const builtLabel = tr(`coachEngine.review.theme.${built.theme}`);

  // Las dos temáticas eran válidas, o armaste la que pedía: la build estuvo bien.
  if (!wanted || wanted === built.theme) {
    const why = reasons[built.theme];
    if (!why.length) return null;
    return { verdict: 'good', text: tr('coachEngine.review.good', { built: builtLabel, reasons: reasonText(why) }) };
  }

  const items = itemsFor(ctx, match, wanted, divers);
  return {
    verdict: 'shift',
    text: tr('coachEngine.review.shift', {
      built: builtLabel,
      items: built.items.slice(0, 2).join(tr('coachEngine.and')),
      wanted: tr(`coachEngine.review.theme.${wanted}`),
      reasons: reasonText(reasons[wanted]),
    }),
    action: [
      items.length && tr('coachEngine.review.itemsAction', { champion: match.champion, items: items.join(tr('coachEngine.or')) }),
      tr(`coachEngine.review.play.${wanted}`),
    ].filter(Boolean).join(' '),
  };
}
