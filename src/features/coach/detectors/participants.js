// Consejos con los 10 jugadores de cada partida (match_participants, carga con capturas):
// tu parte del daño del equipo, el oro contra tu rival de línea, tu presencia en las
// peleas, los números de tu rol (tanque, encantador, carry) y las builds reales del rival.
// Solo hay estos datos en las partidas cargadas con capturas: cada detector pide su
// propia muestra mínima y, si no alcanza, no dice nada.
import { tr } from '../../../i18n/uiI18n.js';
import { FAMILY, makeInsight } from '../card.js';
import { isEnchanter, suggestItems } from '../catalog.js';
import { fixed, pct, summarize, twoProportionZ } from '../stats.js';
import { mainOwnOf } from './performance.js';

const avg = values => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
const known = value => value !== null && value !== undefined && Number.isFinite(Number(value));
const sumOf = (players, key) => players.reduce((sum, player) => sum + Number(player[key] || 0), 0);
const thousands = value => fixed(value / 1000, 1);

/**
 * Partidas con jugadores guardados: la partida normalizada, tu fila, tus aliados (con
 * vos), los enemigos y tu rival de línea.
 * @param {{ matches: any[], participants?: any[] }} ctx
 */
export function participantMatches(ctx) {
  const byMatch = new Map();
  (ctx.participants || []).forEach(player => {
    const key = String(player.match_id);
    if (!byMatch.has(key)) byMatch.set(key, []);
    byMatch.get(key).push(player);
  });
  return ctx.matches.map(match => {
    const players = byMatch.get(match.id);
    const self = players?.find(player => player.is_self && player.team === 'ally');
    if (!self) return null;
    return {
      match,
      self,
      allies: players.filter(player => player.team === 'ally'),
      enemies: players.filter(player => player.team === 'enemy'),
      opponent: players.find(player => player.team === 'enemy' && player.lane === self.lane) || null,
    };
  }).filter(Boolean);
}

/** Victorias y derrotas por separado, con al menos `min` de cada una. */
function splitByResult(rows, min = 3) {
  const wins = rows.filter(row => row.match.won);
  const losses = rows.filter(row => !row.match.won);
  return wins.length >= min && losses.length >= min ? { wins, losses } : null;
}

/** Campeón con más partidas en el grupo y sus filas. */
function mainChampionRows(rows) {
  const groups = new Map();
  rows.forEach(row => {
    const key = row.match.championKey;
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return [...groups.values()].sort((a, b) => b.length - a.length)[0] || [];
}

// ── 1) Tu parte del daño del equipo ────────────────────────────────────────

/**
 * Con tu campeón más jugado, qué parte del daño del equipo hacés en victorias y en
 * derrotas. Para carries y luchadores: si en las derrotas tu parte cae claramente, el
 * problema es llegar a pegar (posición, momento de entrar), no solo el resultado.
 */
export function detectDamageShare(ctx, rows = participantMatches(ctx)) {
  const withDamage = rows.filter(row => row.allies.length === 5 && row.allies.every(player => known(player.damage_dealt)) && sumOf(row.allies, 'damage_dealt') > 0);
  const champRows = mainChampionRows(withDamage);
  if (champRows.length < 6) return [];
  const own = champRows[0].match.own;
  if (!own || !['carry', 'fighter'].includes(own.buildClass)) return [];
  const split = splitByResult(champRows);
  if (!split) return [];
  const shareOf = row => Number(row.self.damage_dealt) / sumOf(row.allies, 'damage_dealt');
  const win = avg(split.wins.map(shareOf));
  const loss = avg(split.losses.map(shareOf));
  if (win - loss < 0.06) return [];
  const champion = champRows[0].match.champion;
  return [makeInsight({
    key: `impact-damage-share-${champRows[0].match.championKey}`,
    family: FAMILY.IMPACT,
    tone: 'warning',
    title: tr('coachEngine.impact.damageShare.title', { champion }),
    thesis: tr('coachEngine.impact.damageShare.thesis', { champion, win: pct(win), loss: pct(loss), games: champRows.length }),
    action: tr(`coachEngine.impact.damageShare.action.${own.buildClass}`),
    evidence: [
      tr('coachEngine.impact.damageShare.evidenceWin', { share: pct(win), games: split.wins.length }),
      tr('coachEngine.impact.damageShare.evidenceLoss', { share: pct(loss), games: split.losses.length }),
    ],
    z: (win - loss) * 12, sample: champRows.length, priority: 74, impact: split.losses.length,
    entities: [champion],
  })];
}

// ── 2) Oro contra tu rival de línea ────────────────────────────────────────

/**
 * Oro final contra tu rival directo, en victorias y derrotas. Si en las derrotas
 * terminás claramente abajo, la partida se pierde en la línea. Sin support (su oro
 * depende de otra cosa).
 */
export function detectLaneGold(ctx, rows = participantMatches(ctx)) {
  const withGold = rows.filter(row => row.self.lane !== 'support' && row.opponent && known(row.self.gold) && known(row.opponent.gold));
  if (withGold.length < 6) return [];
  const split = splitByResult(withGold);
  if (!split) return [];
  const diffOf = row => Number(row.self.gold) - Number(row.opponent.gold);
  const win = avg(split.wins.map(diffOf));
  const loss = avg(split.losses.map(diffOf));
  if (loss > -1200 || win - loss < 1500) return [];
  const lane = mainLaneFrom(withGold);
  return [makeInsight({
    key: 'lane-gold-gap',
    family: FAMILY.LANE_EDGE,
    tone: 'warning',
    title: tr('coachEngine.laneEdge.title'),
    thesis: tr('coachEngine.laneEdge.thesis', {
      loss: thousands(Math.abs(loss)), win: signedThousands(win), games: withGold.length,
    }),
    action: tr(`coachEngine.laneEdge.action.${lane in LANE_GOLD_ACTIONS ? lane : 'any'}`),
    evidence: [
      tr('coachEngine.laneEdge.evidenceLoss', { gold: signedThousands(loss), games: split.losses.length }),
      tr('coachEngine.laneEdge.evidenceWin', { gold: signedThousands(win), games: split.wins.length }),
    ],
    z: (win - loss) / 1000, sample: withGold.length, priority: 73, impact: split.losses.length,
  })];
}

const LANE_GOLD_ACTIONS = { top: true, jungler: true, mid: true, adc: true };
const signedThousands = value => `${value >= 0 ? '+' : '−'}${thousands(Math.abs(value))}k`;
const mainLaneFrom = rows => {
  const counts = new Map();
  rows.forEach(row => counts.set(row.self.lane, (counts.get(row.self.lane) || 0) + 1));
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
};

// ── 3) Presencia en las peleas (dato del juego) ─────────────────────────────

/** Participación en peleas (pestaña DATOS) en victorias contra derrotas. */
export function detectFightPresence(ctx, rows = participantMatches(ctx)) {
  const withFights = rows.filter(row => known(row.self.teamfight_participation));
  if (withFights.length < 6) return [];
  const split = splitByResult(withFights);
  if (!split) return [];
  const of = list => avg(list.map(row => Number(row.self.teamfight_participation)));
  const win = of(split.wins);
  const loss = of(split.losses);
  if (win - loss < 10 || loss >= 50) return [];
  const lane = mainLaneFrom(withFights);
  return [makeInsight({
    key: 'teamplay-fight-presence',
    family: FAMILY.TEAMPLAY,
    tone: 'warning',
    title: tr('coachEngine.teamplay.presenceTitle'),
    thesis: tr('coachEngine.teamplay.presenceThesis', { win: `${Math.round(win)}%`, loss: `${Math.round(loss)}%`, games: withFights.length }),
    action: tr(`coachEngine.teamplay.isolatedAction.${['top', 'jungler', 'mid', 'adc', 'support'].includes(lane) ? lane : 'any'}`),
    evidence: [
      tr('coachEngine.teamplay.presenceEvidence', { win: `${Math.round(win)}%`, loss: `${Math.round(loss)}%` }),
      tr('coachEngine.teamplay.evidenceGames', { games: withFights.length }),
    ],
    z: (win - loss) / 8, sample: withFights.length, priority: 72, impact: split.losses.length,
  })];
}

// ── 4) Los números de tu rol ───────────────────────────────────────────────

/**
 * Lo que tu clase tiene que aportar, medido:
 * - tanque (o support de engage): qué parte del daño del equipo recibís;
 * - encantador: qué parte de la curación y los escudos del equipo das;
 * - carry: daño por cada mil de oro contra tu rival de línea.
 */
export function detectRoleNumbers(ctx, rows = participantMatches(ctx)) {
  const own = mainOwnOf(rows.map(row => row.match));
  if (!own) return [];
  const mine = rows.filter(row => row.match.own === own);
  const frontline = own.isTank || (own.buildClass === 'support' && own.supportStyle === 'engage');

  if (frontline) {
    const valid = mine.filter(row => row.allies.length === 5 && row.allies.every(player => known(player.damage_taken)) && sumOf(row.allies, 'damage_taken') > 0);
    if (valid.length < 6) return [];
    const share = avg(valid.map(row => Number(row.self.damage_taken) / sumOf(row.allies, 'damage_taken')));
    if (share >= 0.22) return [];
    return [roleCard('tank', { share: pct(share), games: valid.length, champion: valid[0].match.champion }, valid, (0.25 - share) * 12)];
  }

  if (isEnchanter(own)) {
    const valid = mine.filter(row => row.allies.length === 5 && row.allies.every(player => known(player.healing_shielding)) && sumOf(row.allies, 'healing_shielding') > 0);
    if (valid.length < 6) return [];
    const share = avg(valid.map(row => Number(row.self.healing_shielding) / sumOf(row.allies, 'healing_shielding')));
    if (share >= 0.35) return [];
    return [roleCard('enchanter', { share: pct(share), games: valid.length, champion: valid[0].match.champion }, valid, (0.4 - share) * 10)];
  }

  if (own.buildClass === 'carry') {
    const efficiency = player => Number(player.damage_dealt) / (Number(player.gold) / 1000);
    const valid = mine.filter(row => row.opponent
      && [row.self.damage_dealt, row.self.gold, row.opponent.damage_dealt, row.opponent.gold].every(known)
      && Number(row.self.gold) > 0 && Number(row.opponent.gold) > 0);
    if (valid.length < 6) return [];
    const ratio = avg(valid.map(row => efficiency(row.self) / Math.max(1, efficiency(row.opponent))));
    if (ratio >= 0.85) return [];
    return [roleCard('carry', {
      ratio: pct(ratio), games: valid.length, champion: valid[0].match.champion,
      mine: fixed(avg(valid.map(row => efficiency(row.self))), 0),
      theirs: fixed(avg(valid.map(row => efficiency(row.opponent))), 0),
    }, valid, (1 - ratio) * 6)];
  }
  return [];
}

function roleCard(kind, vars, rows, z) {
  const losses = rows.filter(row => !row.match.won).length;
  return makeInsight({
    key: `impact-role-${kind}`,
    family: FAMILY.IMPACT,
    tone: 'warning',
    title: tr(`coachEngine.impact.role.${kind}.title`, vars),
    thesis: tr(`coachEngine.impact.role.${kind}.thesis`, vars),
    action: tr(`coachEngine.impact.role.${kind}.action`, vars),
    evidence: [tr(`coachEngine.impact.role.${kind}.evidence`, vars)],
    z, sample: rows.length, priority: 70, impact: losses,
    entities: [vars.champion],
  });
}

// ── 5) Builds reales del rival ─────────────────────────────────────────────

/**
 * Lo que el rival armó de verdad (no lo que suele armar su campeón):
 * - armor: 5 o más objetos con armadura y vos, carry de daño físico, sin penetración;
 * - magicRes: lo mismo con resistencia mágica, si sos de daño mágico;
 * - healing: 3 o más objetos de curación o robo de vida y vos sin antiheal.
 * Se marca si pasó en al menos 3 partidas y en esas perdiste más que en las que sí
 * respondiste (o que tu promedio).
 */
const ENEMY_ITEM_THREATS = [
  {
    id: 'armor',
    enemyCount: profiles => profiles.filter(item => item.final && item.armor).length,
    min: 5,
    appliesTo: (own, damage) => own?.buildClass === 'carry' && damage === 'physical',
    answers: item => ['penetracion_armadura', 'reduccion_armadura', 'dano_vida_porcentual', 'dano_verdadero'].some(tag => item.effects.has(tag)),
  },
  {
    id: 'magicRes',
    enemyCount: profiles => profiles.filter(item => item.final && item.magicRes).length,
    min: 5,
    appliesTo: (own, damage) => own?.buildClass === 'carry' && damage === 'magic',
    answers: item => ['penetracion_magica', 'reduccion_resistencia_magica', 'dano_vida_porcentual', 'dano_verdadero'].some(tag => item.effects.has(tag)),
  },
  {
    id: 'healing',
    enemyCount: profiles => profiles.filter(item => ['autocuracion', 'vampirismo_fisico', 'vampirismo_magico', 'curacion_aliada'].some(tag => item.effects.has(tag))).length,
    min: 3,
    appliesTo: own => Boolean(own) && !isEnchanter(own) && !own.isTank,
    answers: item => item.effects.has('anti_curacion'),
  },
];

/** Tipo de daño de tu build en la partida: el de la mayoría de tus objetos finales. */
function damageTypeOf(match) {
  const finals = (match.itemProfiles || []).filter(item => item?.final);
  const physical = finals.filter(item => item.types.includes('dano fisico')).length;
  const magic = finals.filter(item => item.types.includes('dano magico')).length;
  if (!physical && !magic) return null;
  return physical >= magic ? 'physical' : 'magic';
}

export function detectEnemyItems(ctx, rows = participantMatches(ctx)) {
  const cards = [];
  const withItems = rows.filter(row => row.match.buildKnown && row.enemies.filter(enemy => enemy.items?.length >= 2).length >= 3);
  if (withItems.length < 5) return [];
  ENEMY_ITEM_THREATS.forEach(threat => {
    const facing = withItems.filter(row => {
      const profiles = row.enemies.flatMap(enemy => (enemy.items || []).map(name => ctx.catalog.item(name)).filter(Boolean));
      return threat.enemyCount(profiles) >= threat.min && threat.appliesTo(row.match.own, damageTypeOf(row.match));
    });
    if (facing.length < 3) return;
    const answered = facing.filter(row => (row.match.itemProfiles || []).some(item => item && threat.answers(item)));
    const missed = facing.filter(row => !answered.includes(row));
    if (missed.length < 3 || answered.length / facing.length > 0.4) return;
    const missedStats = summarize(missed.map(row => row.match));
    const answeredStats = summarize(answered.map(row => row.match));
    const reference = answeredStats.games >= 2 ? answeredStats : ctx.base;
    if (reference.wr - missedStats.wr < 0.1) return;
    const own = missed[0].match.own;
    const champion = missed[0].match.champion;
    const suggestions = suggestItems(ctx.catalog, own, item => threat.answers(item), { limit: 2 });
    cards.push(makeInsight({
      key: `enemy-items-${threat.id}`,
      family: FAMILY.BUILD,
      tone: 'critical',
      title: tr(`coachEngine.enemyItems.${threat.id}.title`),
      thesis: tr(`coachEngine.enemyItems.${threat.id}.thesis`, {
        games: facing.length, missed: missed.length, wr: pct(missedStats.wr),
        withAnswer: answeredStats.games >= 2 ? tr('coachEngine.enemyItems.withAnswer', { wr: pct(answeredStats.wr), games: answeredStats.games }) : '',
      }),
      action: suggestions.length
        ? tr(`coachEngine.enemyItems.${threat.id}.action`, { items: suggestions.join(tr('coachEngine.or')) })
        : tr(`coachEngine.enemyItems.${threat.id}.actionGeneric`),
      evidence: [
        tr('coachEngine.enemyItems.evidenceMissed', { wr: pct(missedStats.wr), games: missedStats.games }),
        answeredStats.games >= 2 && tr('coachEngine.enemyItems.evidenceAnswered', { wr: pct(answeredStats.wr), games: answeredStats.games }),
      ],
      z: answeredStats.games >= 2 ? twoProportionZ(answeredStats.wins, answeredStats.games, missedStats.wins, missedStats.games) : 1,
      sample: facing.length, corroborated: true, priority: 76, impact: missedStats.losses * 2,
      entities: [champion],
    }));
  });
  return cards;
}

/** Todos los consejos con jugadores guardados (vacío si no hay). */
export function detectParticipantInsights(ctx) {
  if (!ctx.participants?.length) return [];
  const rows = participantMatches(ctx);
  if (rows.length < 5) return [];
  return [
    ...detectDamageShare(ctx, rows),
    ...detectLaneGold(ctx, rows),
    ...detectFightPresence(ctx, rows),
    ...detectRoleNumbers(ctx, rows),
    ...detectEnemyItems(ctx, rows),
  ];
}

