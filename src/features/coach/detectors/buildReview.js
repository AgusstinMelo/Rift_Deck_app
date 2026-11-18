// Revisión de la temática de la build de una partida contra las dos composiciones,
// cruzando el catálogo (y los 10 jugadores, si la partida se cargó con capturas):
// quién del rival se tira a la línea de atrás o terminó alimentado, a quién de tu equipo
// hay que cuidar (y si sobrevivió), quién aguanta adelante, qué daño le falta a tu equipo,
// qué daño trae el rival y con qué escala tu campeón. Cada clase elige entre sus
// temáticas reales:
// - support (mago o de pelea): daño (poke) o protección (curaciones y escudos);
// - carry: full daño o daño con un objeto defensivo (Ángel Guardián, Zhonya, Fauces);
// - luchador: daño o resistencias;
// - tanque: armadura o resistencia mágica.
// No hay un camino único: si armaste otra temática y funcionó, o tu campeón la convierte
// en la otra (Seraphine: el poder de habilidad también agranda sus escudos), el Coach lo
// plantea como alternativa, no como error. Solo corrige cuando la partida se perdió (o
// el aliado a cuidar murió mucho) y la build no tenía con qué.
import { tr } from '../../../i18n/uiI18n.js';
import { keyOf, suggestItems, withBuildClass } from '../catalog.js';

const MOBILITY = ['dash', 'salto', 'blink', 'desplazamiento', 'atraviesa_terreno', 'gap_close'].map(keyOf);
const DIVE_VULNS = ['asesino', 'gap_close', 'dano_burst', 'diver', 'dive', 'acceso_backline'];
const GUARD_TAGS = ['anti_burst', 'revivir', 'invulnerabilidad', 'escudo_hechizo', 'defensa_fisica', 'defensa_magica', 'reduccion_dano'];
const PROTECT_TRAITS = ['curacion_aliada', 'escudo_aliado'];

/** Objetos finales mínimos para hablar de temática (antes es solo el primer objeto). */
const MIN_FINALS = 2;
/** Aliados y rivales reconocidos mínimos para evaluar las composiciones. */
const MIN_COMP = 3;
/** Para qué objeto ya tendría que estar la defensa (con slots libres antes, pudo venir después). */
const DEFENSE_DUE = { carry: 5, fighter: 3 };
/** Muertes del aliado a cuidar (o tuyas, de carry) que dicen que el plan funcionó o no. */
const SURVIVED = 3;
const DIED = 6;

const isDamageItem = item => item.types.some(type => type === 'dano fisico' || type === 'dano magico');
const isProtectItem = item => item.types.includes('soporte')
  || ['curacion_aliada', 'escudo_aliado', 'buff_aliado'].some(tag => item.effects.has(tag));
/** Objeto de daño que también defiende: lo que arma un carry para sobrevivir. */
const isGuardItem = item => isDamageItem(item) && (GUARD_TAGS.some(tag => item.effects.has(tag)) || item.armor || item.magicRes);
const isResistItem = item => item.types.includes('defensa') || item.armor || item.magicRes;
const resistsPhysical = item => item.armor || ['defensa_fisica', 'revivir', 'invulnerabilidad'].some(tag => item.effects.has(tag));
const resistsMagic = item => item.magicRes || ['defensa_magica', 'escudo_hechizo'].some(tag => item.effects.has(tag));

/** "A, B y C". */
const listOf = names => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')}${tr('coachEngine.and')}${names.at(-1)}`);

/**
 * Rival que se tira a tu línea de atrás: asesino, o luchador cuerpo a cuerpo con
 * movilidad (Riven, Lee Sin). Los tanques no: su amenaza es iniciar o aislar a un carry
 * (K'Sante), no matarlo de un combo.
 */
const isDiver = enemy => !enemy.isTank
  && (enemy.isAssassin || (enemy.traits.has('melee') && MOBILITY.some(tag => enemy.traits.has(tag))));

/** Daño físico y mágico que aporta un campeón (los híbridos cuentan la mitad de cada uno). */
const physicalOf = champ => (champ.damage === 'AD' ? 1 : champ.damage === 'HYBRID' ? 0.5 : 0);
const magicOf = champ => (champ.damage === 'AP' ? 1 : champ.damage === 'HYBRID' ? 0.5 : 0);

/** Su protección (escudos, curaciones) escala con poder de habilidad: Seraphine, Lulu, Karma, Nami... */
const apFeedsProtection = own => PROTECT_TRAITS.some(tag => own.traits.has(tag))
  && ['poder_habilidad', 'poder_escudo', 'poder_curacion'].some(tag => own.itemScalings.has(tag));
/** Su daño escala con vida o resistencias: las resistencias también le suben el daño (K'Sante, Sion). */
const tankStatsFeedDamage = own => ['vida', 'armadura', 'resistencia_magica'].some(tag => own.itemScalings.has(tag));

/** Jugadores de la partida (de las capturas): rivales alimentados y muertes de un aliado. */
function playersOf(ctx, match) {
  const players = (ctx.participants || []).filter(player => String(player.match_id) === match.id && player.champion);
  const nameOf = player => ctx.catalog.champion(player.champion)?.name || player.champion;
  return {
    fed: players
      .filter(player => player.team === 'enemy' && Number(player.kills) >= 7 && Number(player.kills) >= 2 * Math.max(1, Number(player.deaths) || 0))
      .map(player => ({ name: nameOf(player), profile: ctx.catalog.champion(player.champion), kda: `${player.kills}/${player.deaths ?? 0}/${player.assists ?? 0}` })),
    deathsOf: name => {
      const player = players.find(entry => entry.team === 'ally' && !entry.is_self && keyOf(nameOf(entry)) === keyOf(name));
      return player && player.deaths != null ? Number(player.deaths) : null;
    },
  };
}

/** Lo que se sabe de las dos composiciones. */
function compFacts(ctx, match) {
  const own = match.own;
  const allies = match.allyProfiles || [];
  const enemies = match.enemyProfiles || [];
  const players = playersOf(ctx, match);
  const divers = enemies.filter(isDiver);
  const fedDivers = players.fed.filter(entry => entry.profile && isDiver(entry.profile));
  const ward = allies.find(ally => ally.isMarksman && !ally.isSupport)
    || allies.find(ally => ally.buildClass === 'carry' && ally.scaling === 'lategame');
  const sum = (list, fn) => list.reduce((total, champ) => total + fn(champ), 0);
  return {
    allies,
    enemies,
    divers,
    fedDivers,
    // El rival más peligroso para la línea de atrás: alimentado, asesino o el primero.
    mainDiver: fedDivers[0]?.profile || divers.find(enemy => enemy.isAssassin) || divers[0] || null,
    ward,
    wardDeaths: ward ? players.deathsOf(ward.name) : null,
    tank: allies.find(ally => ally.isTank),
    enchanter: allies.find(ally => ally.isSupport && ally.supportStyle === 'enchanter'),
    allyCarries: allies.filter(ally => ally.buildClass === 'carry').length,
    allyMagic: sum(allies, magicOf),
    enemyCarries: enemies.filter(enemy => enemy.buildClass === 'carry').length,
    enemyPhysical: sum(enemies, physicalOf),
    enemyMagic: sum(enemies, magicOf),
    enemyBurst: enemies.filter(enemy => enemy.burst).length,
    ownExposed: DIVE_VULNS.some(tag => own.vulnerabilities.includes(tag)),
  };
}

const reason = (weight, key, vars = {}) => ({ weight, key, vars });
const diverReason = facts => reason(facts.divers.length >= 3 ? 2 : 1.5, 'divers', {
  count: facts.divers.length, names: listOf(facts.divers.slice(0, 3).map(enemy => enemy.name)),
});
const fedReason = (facts, weight) => reason(weight, 'fed', { name: facts.fedDivers[0].name, kda: facts.fedDivers[0].kda });

/** De qué lado viene el daño rival, si viene claramente de uno. */
function damageSide(facts) {
  if (facts.enemyPhysical >= 3.5 && facts.enemyPhysical - facts.enemyMagic >= 2) return 'physical';
  if (facts.enemyMagic >= 3.5 && facts.enemyMagic - facts.enemyPhysical >= 2) return 'magic';
  return null;
}
const sideReason = (facts, side, weight) => reason(weight, side === 'physical' ? 'enemyPhysical' : 'enemyMagic', {
  names: listOf(facts.enemies.filter(enemy => (side === 'physical' ? physicalOf : magicOf)(enemy) === 1).slice(0, 3).map(enemy => enemy.name)),
});

/** Temática dominante: la que tiene más objetos finales (`pick` decide la de cada uno). */
function dominant(finals, pick) {
  const counts = new Map();
  finals.forEach(item => { const theme = pick(item); if (theme) counts.set(theme, (counts.get(theme) || 0) + 1); });
  const ranked = [...counts].sort((a, b) => b[1] - a[1]);
  if (!ranked.length || (ranked[1] && ranked[1][1] === ranked[0][1])) return null;
  const theme = ranked[0][0];
  return { theme, items: finals.filter(item => pick(item) === theme).map(item => item.name) };
}

// ── Evaluadores por clase ──────────────────────────────────────────────────
// Cada uno devuelve: la temática armada, las razones de cada temática, cuáles son de
// defensa (solo se exigen cuando la build llegó a su objeto), qué temática cubre a otra
// por cómo escala el campeón (`covers`), si el plan funcionó (`worked`; si falló, suma
// una razón `carryDied` o `selfDied`) y qué objetos responden a cada temática.

const EVALUATORS = {
  support(match, facts) {
    const own = match.own;
    const built = dominant(match.finals, item => (isProtectItem(item) ? 'protect' : isDamageItem(item) ? 'damage' : null));
    const protect = [];
    const damage = [];
    if (facts.divers.length >= 2) protect.push(diverReason(facts));
    if (facts.ward && facts.divers.length) protect.push(reason(facts.ward.isMarksman ? 1 : 0.75, 'carry', { name: facts.ward.name }));
    if (facts.enemyBurst >= 2 && facts.ownExposed) protect.push(reason(0.5, 'burst'));
    if (facts.fedDivers.length) protect.push(fedReason(facts, 1));
    const failed = facts.wardDeaths !== null && facts.wardDeaths >= DIED;
    if (failed) protect.push(reason(1.5, 'carryDied', { name: facts.ward.name, deaths: facts.wardDeaths }));
    // Daño (poke): tiene sentido si tu equipo no lo tenía y el rival tenía que caminar para entrar.
    if (own.damage === 'AP' && facts.allyMagic < 1) damage.push(reason(1.5, 'noMagic'));
    else if (own.damage === 'AD' && facts.allies.every(ally => ally.damage === 'AP')) damage.push(reason(1.5, 'noPhysical'));
    if (!facts.divers.length) damage.push(reason(1, 'noDive'));
    if (facts.tank && facts.divers.length <= 1) damage.push(reason(0.5, 'frontline', { name: facts.tank.name }));
    // Un tirador que escala tarde necesita farmear tranquilo: el poke en línea se lo da.
    if (facts.ward?.scaling === 'lategame' && facts.divers.length <= 1) damage.push(reason(0.5, 'pokeLane', { name: facts.ward.name }));
    // Poder de habilidad que también agranda escudos y curaciones: el daño no deja de proteger.
    const apDamage = built?.theme === 'damage' && match.finals.filter(item => isDamageItem(item)).every(item => item.abilityPower);
    return {
      built, reasons: { protect, damage }, threshold: 2.5, defensive: [],
      covers: apDamage && apFeedsProtection(own) ? { damage: { theme: 'protect', key: 'coverShield' } } : {},
      worked: facts.wardDeaths !== null && facts.wardDeaths <= SURVIVED ? { key: 'wardSurvived', vars: { name: facts.ward.name, deaths: facts.wardDeaths } } : null,
      answers: {
        protect: item => isProtectItem(item) && (facts.divers.length < 2 || item.effects.has('escudo_aliado') || item.effects.has('anti_burst')),
        damage: item => isDamageItem(item) && !item.types.includes('soporte'),
      },
      // Se sugiere como support aunque el historial lo marque carry (siempre armado de daño).
      own: withBuildClass(own, 'support'),
    };
  },

  carry(match, facts) {
    const built = match.finals.some(isGuardItem)
      ? { theme: 'guard', items: match.finals.filter(isGuardItem).map(item => item.name) }
      : { theme: 'fullDamage', items: match.finals.filter(isDamageItem).map(item => item.name) };
    const guard = [];
    const fullDamage = [];
    if (facts.divers.length >= 2) guard.push(diverReason(facts));
    if (facts.fedDivers.length) guard.push(fedReason(facts, 1.5));
    if (facts.enemyBurst >= 2 && facts.ownExposed) guard.push(reason(0.5, 'burst'));
    if (!facts.tank && !facts.enchanter && facts.divers.length) guard.push(reason(0.5, 'noPeel'));
    const failed = match.hasKda && match.deaths >= DIED && facts.divers.length > 0;
    if (failed) guard.push(reason(1, 'selfDied', { deaths: match.deaths }));
    if (!facts.divers.length) fullDamage.push(reason(1.5, 'noDive'));
    const peel = facts.tank || facts.enchanter;
    if (peel && facts.divers.length <= 1) fullDamage.push(reason(0.5, 'peel', { name: peel.name }));
    if (facts.allyCarries <= 1) fullDamage.push(reason(1, 'fewCarries'));
    const side = damageSide(facts);
    return {
      built, reasons: { guard, fullDamage }, threshold: 2, defensive: ['guard'], covers: {},
      worked: match.hasKda && match.deaths <= SURVIVED ? { key: 'selfSurvived', vars: { deaths: match.deaths } } : null,
      answers: {
        guard: item => isGuardItem(item) && (side === 'magic' ? resistsMagic(item) : side === 'physical' ? resistsPhysical(item) : true),
        fullDamage: null, // Ir full daño es cambiar el defensivo por daño, no comprar algo nuevo.
      },
      own: match.own,
    };
  },

  fighter(match, facts) {
    const own = match.own;
    const built = dominant(match.finals, item => (isResistItem(item) ? 'resist' : isDamageItem(item) ? 'damage' : null));
    const resist = [];
    const damage = [];
    const side = damageSide(facts);
    if (!facts.tank) resist.push(reason(1.5, 'noFrontline'));
    if (side) resist.push(sideReason(facts, side, 1));
    if (facts.fedDivers.length) resist.push(fedReason(facts, 0.5));
    const failed = match.hasKda && match.deaths >= DIED + 1;
    if (failed) resist.push(reason(1, 'selfDied', { deaths: match.deaths }));
    if (facts.tank) damage.push(reason(1, 'frontline', { name: facts.tank.name }));
    if (facts.allyCarries <= 1) damage.push(reason(1.5, 'fewCarries'));
    if (facts.enemyCarries >= 3) damage.push(reason(0.5, 'squishy', { count: facts.enemyCarries }));
    return {
      built, reasons: { resist, damage }, threshold: 2, defensive: ['resist'],
      // Si su daño escala con vida o resistencias, armarse de defensa no le quita daño.
      covers: tankStatsFeedDamage(own) ? { resist: { theme: 'damage', key: 'coverTank' } } : {},
      worked: match.hasKda && match.deaths <= SURVIVED ? { key: 'selfSurvived', vars: { deaths: match.deaths } } : null,
      answers: {
        resist: item => isResistItem(item) && (side === 'magic' ? resistsMagic(item) : side === 'physical' ? resistsPhysical(item) : true),
        damage: item => isDamageItem(item) && !isResistItem(item),
      },
      own,
    };
  },

  tank(match, facts) {
    const built = dominant(match.finals, item => (item.armor && !item.magicRes ? 'armor' : item.magicRes && !item.armor ? 'magicRes' : null));
    const side = damageSide(facts);
    return {
      built,
      reasons: {
        armor: side === 'physical' ? [sideReason(facts, side, 2.5)] : [],
        magicRes: side === 'magic' ? [sideReason(facts, side, 2.5)] : [],
      },
      threshold: 2, defensive: [], covers: {},
      worked: null,
      answers: { armor: item => Boolean(item.armor), magicRes: item => Boolean(item.magicRes) },
      own: match.own,
    };
  },
};

/** Clase con la que se evalúa la partida (null: no se revisa). */
function classOf(match) {
  const own = match.own;
  if (!own) return null;
  if (match.lane === 'support') {
    // Si siempre lo armás de daño el historial lo trata como carry, pero sigue siendo el support.
    return own.buildClass !== 'tank' && ['mage', 'fighter'].includes(own.supportStyle) ? 'support' : null;
  }
  return EVALUATORS[own.buildClass] ? own.buildClass : null;
}

/**
 * Cómo usar el kit contra el rival que se tira atrás (vale con cualquier build): quien
 * tiene control lo guarda para cuando salte sobre el carry; un carry con desplazamiento
 * lo guarda para escapar.
 */
function kitTip(kind, match, facts) {
  const diver = facts.mainDiver;
  if (!diver) return null;
  const own = match.own;
  if (['support', 'tank'].includes(kind) && own.hardCc && facts.ward) {
    return tr('coachEngine.review.kit.peel', { diver: diver.name, carry: facts.ward.name });
  }
  if (kind === 'carry' && MOBILITY.some(tag => own.traits.has(tag))) {
    return tr('coachEngine.review.kit.escape', { diver: diver.name });
  }
  return null;
}

const score = list => list.reduce((sum, entry) => sum + entry.weight, 0);
const reasonText = reasons => [...reasons]
  .sort((a, b) => b.weight - a.weight)
  .slice(0, 2)
  .map(entry => tr(`coachEngine.review.reason.${entry.key}`, entry.vars))
  .join(tr('coachEngine.and'));

/** Un objeto de ejemplo de la temática, que encaje con el campeón. */
function exampleFor(ctx, match, review, theme) {
  const answers = review.answers[theme];
  if (!answers) return null;
  const habits = ctx.buildHabits?.get(match.championKey) || { bought: new Set(), damageTypes: [] };
  return suggestItems(ctx.catalog, review.own, answers, {
    boughtKeys: new Set([...habits.bought].filter(key => !match.itemKeys.has(key))),
    preferredTypes: habits.damageTypes,
    limit: 3,
  }).find(name => !match.itemKeys.has(keyOf(name))) || null;
}

/**
 * Revisión de la build de una partida contra las composiciones.
 * - good: armaste lo que pedía la partida (o las dos temáticas eran válidas);
 * - alternative: armaste otra cosa y funcionó, o tu campeón la convierte en la otra:
 *   se plantea la otra opción con sus razones, sin marcarlo como error;
 * - shift: la partida se perdió (o el plan falló) y la build no tenía con qué.
 * @returns {null | { verdict: 'good' | 'alternative' | 'shift', text: string, action?: string, tip?: string }}
 */
export function reviewBuild(ctx, match) {
  const kind = classOf(match);
  if (!kind) return null;
  if ((match.allyProfiles || []).length < MIN_COMP || (match.enemyProfiles || []).length < MIN_COMP) return null;
  const finals = match.itemProfiles.filter(item => item.final);
  if (finals.length < MIN_FINALS) return null;

  const facts = compFacts(ctx, match);
  const review = EVALUATORS[kind]({ ...match, finals }, facts);
  const { built, reasons, threshold } = review;
  if (!built || !reasons[built.theme]) return null;
  const [top, second] = Object.keys(reasons)
    .map(theme => ({ theme, score: score(reasons[theme]) }))
    .sort((a, b) => b.score - a.score);
  const wanted = top.score >= threshold && top.score >= (second?.score || 0) + 1 ? top.theme : null;
  const label = theme => tr(`coachEngine.review.theme.${theme}`);
  const tip = kitTip(kind, match, facts);
  const champion = match.champion;

  // Armaste lo que pedía la partida, o las dos temáticas eran válidas.
  if (!wanted || wanted === built.theme) {
    if (!reasons[built.theme].length) return tip ? { verdict: 'good', text: null, tip } : null;
    return { verdict: 'good', text: tr('coachEngine.review.good', { built: label(built.theme), reasons: reasonText(reasons[built.theme]) }), tip };
  }

  // Pedía defensa y no está, pero quedaban slots antes de cuando le toca: pudo venir después.
  if (review.defensive.includes(wanted) && (match.itemSlots ?? finals.length) < DEFENSE_DUE[kind]) return tip ? { verdict: 'good', text: null, tip } : null;

  const cover = review.covers[built.theme]?.theme === wanted ? review.covers[built.theme] : null;
  const coverText = cover ? tr(`coachEngine.review.reason.${cover.key}`, { champion }) : '';
  const example = exampleFor(ctx, match, review, wanted);
  const exampleText = example ? tr('coachEngine.review.itemsAction', { champion, items: example }) : '';
  const play = tr(`coachEngine.review.play.${kind}.${wanted}`);

  // Corrección: se perdió, o el plan falló aunque se ganara (el aliado a cuidar o vos
  // murieron mucho), y tu campeón no compensaba con lo que armó.
  const planFailed = reasons[wanted].some(entry => ['carryDied', 'selfDied'].includes(entry.key));
  if (!cover && (!match.won || planFailed)) {
    return {
      verdict: 'shift',
      text: tr('coachEngine.review.shift', {
        built: label(built.theme), items: listOf(built.items.slice(0, 2)), wanted: label(wanted), reasons: reasonText(reasons[wanted]),
      }),
      action: [play, exampleText, tip].filter(Boolean).join(' '),
    };
  }

  // Alternativa: funcionó (o tu campeón la compensa); la otra opción también tenía argumentos.
  // "Smolder no murió" / "murió solo 1 vez" / "murió solo 2 veces".
  const deaths = review.worked?.vars.deaths;
  const workedKey = review.worked && `coachEngine.review.worked.${review.worked.key}${deaths === 0 ? 'None' : deaths === 1 ? 'One' : ''}`;
  const worked = match.won && review.worked ? tr(workedKey, review.worked.vars) : '';
  return {
    verdict: 'alternative',
    text: tr(match.won ? 'coachEngine.review.alternativeWon' : 'coachEngine.review.alternativeCovered', {
      built: label(built.theme),
      worked,
      cover: coverText ? tr('coachEngine.review.coverJoin', { cover: coverText }) : '',
      wanted: label(wanted),
      reasons: reasonText(reasons[wanted]),
    }),
    // "otra opción: jugá..." (después de los dos puntos, minúscula).
    action: [`${tr('coachEngine.review.altLead')} ${play.charAt(0).toLocaleLowerCase()}${play.slice(1)}`, exampleText, tip].filter(Boolean).join(' '),
  };
}
