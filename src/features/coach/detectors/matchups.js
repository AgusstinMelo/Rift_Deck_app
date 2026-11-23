// Detectores de matchups y pool: contra quién perdés y qué hacer (vulnerabilidades del
// rival, herramientas de tu campeón, objetos del catálogo buenos contra él y una
// alternativa de tu pool), y si tu pool te suma o te resta.
import { tr } from '../../../i18n/uiI18n.js';
import { FAMILY, makeInsight } from '../card.js';
import { itemsGoodAgainst, keyOf } from '../catalog.js';
import { fixed, groupBy, pct, shrunkRate, summarize, twoProportionZ } from '../stats.js';

const CC = ['cc_duro', 'stun', 'root', 'miedo', 'supresion', 'encanto', 'provocacion', 'silencio'];

/**
 * Vulnerabilidades del catálogo que el jugador puede aprovechar, y con qué rasgos del
 * campeón propio se aprovechan. Las que no tienen `tools` se responden con la build.
 */
const VULNERABILITIES = {
  kiteo: { tools: own => ['rango', 'largo_alcance', 'ralentizacion'].some(tag => own.traits.has(tag)) },
  cc_duro: { tools: own => own.hardCc },
  cadena_cc: { tools: own => own.hardCc },
  gap_close: { tools: own => ['dash', 'blink', 'salto'].some(tag => own.traits.has(tag)) },
  bloqueo_movilidad: { tools: own => ['root', 'stun', 'cc_duro', 'creacion_terreno'].some(tag => own.traits.has(tag)) },
  dano_burst: { tools: own => own.burst },
  asesino: { tools: own => own.isAssassin },
  presion_early: { tools: own => own.scaling === 'earlygame' },
  outscale: { tools: own => own.scaling === 'lategame' || own.traits.has('escalado_infinito') },
  dano_por_vida_porcentual: { tools: own => own.traits.has('dano_por_vida_porcentual') },
  dano_verdadero: { tools: own => own.traits.has('dano_verdadero') },
  largo_alcance: { tools: own => ['largo_alcance', 'poke'].some(tag => own.traits.has(tag)) },
  dano_sostenido: { tools: own => own.traits.has('dano_sostenido') || own.autoAttacker },
  acceso_backline: { tools: own => ['dash', 'blink', 'salto', 'camuflaje'].some(tag => own.traits.has(tag)) },
  diver: { tools: own => ['dash', 'salto'].some(tag => own.traits.has(tag)) },
  disengage: { tools: own => own.hardCc || own.traits.has('ralentizacion') },
  anti_curacion: { tools: null },
  reduccion_velocidad_ataque: { tools: null },
  resistencia_magica_alta: { tools: null },
  armadura_alta: { tools: null },
  anti_escudo: { tools: null },
  vida_alta: { tools: null },
  presion_mana: { tools: own => own.traits.has('poke') || CC.some(tag => own.traits.has(tag)) },
  revelado_vision: { tools: null },
};

/**
 * Vulnerabilidades conocidas del rival, separando las que tu campeón aprovecha. `lead`: la
 * que conviene usar de consejo, una que tu kit aprovecha o, si no, una que se responde con
 * la build (antiheal, penetración); nunca una que pide herramientas que no tenés.
 */
export function vulnerabilityPlan(own, enemy) {
  const known = (enemy?.vulnerabilities || []).filter(tag => VULNERABILITIES[tag]);
  const exploitable = own ? known.filter(tag => VULNERABILITIES[tag].tools?.(own)) : [];
  const lead = exploitable[0] || known.find(tag => !VULNERABILITIES[tag].tools) || null;
  return { known, exploitable, lead };
}

const vulnList = tags => tags.slice(0, 3).map(tag => tr(`coachEngine.vuln.${tag}`)).join(', ');

/** Campeón de tu pool que mejor responde a un rival (por historial o por catálogo). */
function poolAnswer(ctx, enemyKey, excludeKey, lane) {
  const candidates = [];
  groupBy(ctx.matches.filter(match => match.championKey !== excludeKey && (!lane || match.lane === lane)), match => match.championKey)
    .forEach(rows => {
      if (rows.length < 3) return;
      const stats = summarize(rows);
      const shrunk = shrunkRate(stats.wins, stats.games, ctx.base.wr);
      const own = rows[0].own;
      const versus = summarize(rows.filter(row => row.enemyKey === enemyKey));
      const catalogSays = own?.strongAgainst.includes(enemyKey);
      const historySays = versus.games >= 2 && versus.wr > 0.5;
      // Nunca recomendar como "mejor respuesta" un campeón que pierde más de lo que gana.
      if (shrunk < ctx.base.wr || stats.wr < 0.5 || (!catalogSays && !historySays)) return;
      candidates.push({ name: rows[0].champion, stats, versus, score: shrunk + (catalogSays ? 0.1 : 0) + (historySays ? 0.1 : 0) });
    });
  return candidates.sort((a, b) => b.score - a.score)[0] || null;
}

/** Matchup que más te cuesta: récord, plan contra el rival, objetos y alternativa del pool. */
export function detectMatchups(ctx) {
  const championBase = new Map();
  groupBy(ctx.matches, match => match.championKey).forEach((rows, key) => championBase.set(key, summarize(rows)));

  const pairs = [];
  groupBy(ctx.matches.filter(match => match.enemyKey && match.championKey), match => `${match.championKey}|${match.enemyKey}`)
    .forEach(rows => {
      if (rows.length < 3) return;
      const stats = summarize(rows);
      const base = championBase.get(rows[0].championKey);
      const shrunk = shrunkRate(stats.wins, stats.games, base.wr, 5);
      const deficit = base.wr - shrunk;
      if (deficit < 0.12 || stats.losses < 2) return;
      pairs.push({ rows, stats, base, deficit, z: twoProportionZ(base.wins - stats.wins, base.games - stats.games, stats.wins, stats.games) });
    });
  const pair = pairs.sort((a, b) => b.deficit * b.stats.games - a.deficit * a.stats.games)[0];
  if (!pair) return [];

  const first = pair.rows[0];
  const champion = first.champion;
  const enemy = first.enemy;
  const own = first.own;
  const enemyProfile = first.enemyProfile;
  const { known, exploitable, lead } = vulnerabilityPlan(own, enemyProfile);
  const habits = ctx.buildHabits.get(first.championKey);
  const items = own ? itemsGoodAgainst(ctx.catalog, own, enemy, { preferredTypes: habits?.damageTypes || [] }) : [];
  const boughtInMatchup = items.filter(item => pair.rows.some(row => row.itemKeys.has(keyOf(item))));
  const counter = poolAnswer(ctx, first.enemyKey, first.championKey, first.lane);

  const parts = [tr('coachEngine.matchup.record', {
    champion, enemy, wins: pair.stats.wins, losses: pair.stats.losses, base: pct(pair.base.wr),
  })];
  if (known.length) {
    parts.push(tr('coachEngine.matchup.weakTo', { enemy, list: vulnList(exploitable.length ? exploitable : known) }));
    parts.push(exploitable.length
      ? tr('coachEngine.matchup.hasTools', { champion })
      : tr('coachEngine.matchup.noTools', { champion }));
  }
  if (items.length) {
    parts.push(tr(boughtInMatchup.length ? 'coachEngine.matchup.itemsBought' : 'coachEngine.matchup.itemsNotBought', {
      items: items.join(tr('coachEngine.and')), enemy,
    }));
  }

  const actions = [];
  if (lead) actions.push(tr(`coachEngine.vulnAction.${lead}`, { enemy }));
  if (items.length && !boughtInMatchup.length) actions.push(tr('coachEngine.matchup.buyAction', { item: items[0], enemy }));
  if (counter) actions.push(tr('coachEngine.matchup.counterAction', { counter: counter.name, enemy, wr: pct(counter.stats.wr), games: counter.stats.games }));
  if (!actions.length) actions.push(tr('coachEngine.matchup.fallbackAction', { enemy }));

  return [makeInsight({
    key: `matchup-${first.championKey}-${first.enemyKey}`,
    family: FAMILY.MATCHUP,
    tone: 'critical',
    title: tr('coachEngine.matchup.title', { champion, enemy }),
    thesis: parts.join(' '),
    action: actions.join(' '),
    evidence: [
      tr('coachEngine.matchup.evidenceRecord', { champion, enemy, wins: pair.stats.wins, losses: pair.stats.losses }),
      tr('coachEngine.matchup.evidenceBase', { champion, wr: pct(pair.base.wr) }),
      counter && tr('coachEngine.matchup.evidenceCounter', { counter: counter.name }),
    ],
    z: pair.z, sample: pair.stats.games, corroborated: known.length > 0 || items.length > 0,
    priority: 80, impact: pair.stats.losses * 2,
    entities: [champion, enemy],
    track: { kind: 'matchup', champion: first.championKey, enemy: first.enemyKey, championName: champion, enemyName: enemy },
  })];
}

/** Pool: rendimiento fuera de tus 3 campeones, o un campeón que te resta frente a otro que te suma. */
export function detectPool(ctx) {
  const groups = [...groupBy(ctx.matches.filter(match => match.championKey), match => match.championKey)]
    .map(([key, rows]) => ({ key, name: rows[0].champion, rows, stats: summarize(rows), lane: rows[0].lane }))
    .sort((a, b) => b.stats.games - a.stats.games);
  if (!groups.length) return [];
  const cards = [];

  // Fuera del núcleo.
  const core = groups.slice(0, 3);
  const coreRows = core.flatMap(group => group.rows);
  const outsideRows = groups.slice(3).flatMap(group => group.rows);
  if (ctx.matches.length >= 15 && outsideRows.length >= 6) {
    const inside = summarize(coreRows);
    const outside = summarize(outsideRows);
    const gap = shrunkRate(inside.wins, inside.games, ctx.base.wr) - shrunkRate(outside.wins, outside.games, ctx.base.wr);
    const z = twoProportionZ(inside.wins, inside.games, outside.wins, outside.games);
    if (gap >= 0.12 && z >= 1.2) {
      const names = core.map(group => group.name).join(', ');
      cards.push(makeInsight({
        key: 'pool-focus',
        family: FAMILY.POOL,
        tone: 'warning',
        title: tr('coachEngine.pool.focusTitle'),
        thesis: tr('coachEngine.pool.focusThesis', {
          names, wrIn: pct(inside.wr), gamesIn: inside.games, wrOut: pct(outside.wr), gamesOut: outside.games, picks: groups.length - 3,
        }),
        action: tr('coachEngine.pool.focusAction', { names }),
        evidence: [
          tr('coachEngine.pool.evidenceIn', { wr: pct(inside.wr), games: inside.games }),
          tr('coachEngine.pool.evidenceOut', { wr: pct(outside.wr), games: outside.games }),
        ],
        z, sample: ctx.matches.length, priority: 66, impact: summarize(outsideRows).losses,
        entities: core.map(group => group.name),
        track: { kind: 'outsideCore', core: core.map(group => group.key) },
      }));
    }
  }

  // Un campeón muy jugado que rinde por debajo, con una alternativa de la misma línea que rinde por encima.
  const under = groups.find(group => group.stats.games >= 8
    && ctx.base.wr - shrunkRate(group.stats.wins, group.stats.games, ctx.base.wr) >= 0.1);
  if (under) {
    const alternative = groups.find(group => group !== under && group.stats.games >= 4 && group.lane === under.lane
      && shrunkRate(group.stats.wins, group.stats.games, ctx.base.wr) >= ctx.base.wr + 0.06);
    const underDeaths = under.stats.avgDeaths;
    const deathGap = underDeaths !== null && ctx.base.avgDeaths !== null ? underDeaths - ctx.base.avgDeaths : 0;
    if (alternative || deathGap >= 1) {
      cards.push(makeInsight({
        key: `pool-under-${under.key}`,
        family: FAMILY.POOL,
        tone: 'warning',
        title: tr('coachEngine.pool.underTitle', { name: under.name }),
        thesis: tr('coachEngine.pool.underThesis', {
          name: under.name, games: under.stats.games, wr: pct(under.stats.wr), base: pct(ctx.base.wr),
          deaths: deathGap >= 1 ? tr('coachEngine.pool.underDeaths', { deaths: fixed(underDeaths), base: fixed(ctx.base.avgDeaths) }) : '',
        }),
        action: alternative
          ? tr('coachEngine.pool.underActionAlt', { name: under.name, alt: alternative.name, wr: pct(alternative.stats.wr), games: alternative.stats.games })
          : tr('coachEngine.pool.underActionDeaths', { name: under.name }),
        evidence: [
          tr('coachEngine.pool.evidenceChampion', { name: under.name, wr: pct(under.stats.wr), games: under.stats.games }),
          tr('coachEngine.pool.evidenceBase', { wr: pct(ctx.base.wr) }),
          alternative && tr('coachEngine.pool.evidenceChampion', { name: alternative.name, wr: pct(alternative.stats.wr), games: alternative.stats.games }),
        ],
        z: twoProportionZ(ctx.base.wins - under.stats.wins, ctx.base.games - under.stats.games, under.stats.wins, under.stats.games),
        sample: under.stats.games, priority: 64, impact: under.stats.losses,
        entities: [under.name, alternative?.name],
        track: { kind: 'championWr', champion: under.key, championName: under.name },
      }));
    }
  }
  return cards;
}
