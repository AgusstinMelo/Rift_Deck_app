import { tr } from '../i18n/uiI18n.js';
// Rift Deck insight engine
//
// The engine deliberately returns editorial cards instead of isolated stats. Every
// card must answer three questions: what is happening, why it may be happening,
// and what the player can try next. It is intentionally tolerant of partially
// populated catalog fields so future champion/item knowledge works without a
// rewrite.

const clean = value => String(value ?? '').trim();
const keyOf = value => clean(value).toLocaleLowerCase('es').replace(/\s+/g, ' ');

const laneAliases = {
  adc: 'dragonline', bot: 'dragonline', bottom: 'dragonline', dragonlane: 'dragonline',
  dragonline: 'dragonline', duo: 'dragonline', mid: 'mid', middle: 'mid', top: 'top',
  baron: 'top', baronlane: 'top', support: 'support', supp: 'support', jungle: 'jungler',
  jungler: 'jungler',
};

function laneOf(value) {
  const raw = keyOf(value).replace(/\s+/g, '');
  return laneAliases[raw] || raw;
}

function nameOf(value) {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number') return clean(value) || null;
  if (typeof value === 'object') {
    return clean(
      value.name || value.champion_name || value.item_name || value.rune_name ||
      value.spell_name || value.label || value.title || value.value,
    ) || null;
  }
  return null;
}

function listOf(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.flatMap(listOf);
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return [];
    try { return listOf(JSON.parse(text)); } catch {
      return text.split(/[,|;>\n]+/).map(part => part.trim()).filter(Boolean);
    }
  }
  if (typeof value === 'object') {
    for (const field of ['items', 'champions', 'runes', 'spells', 'values', 'names']) {
      if (Array.isArray(value[field])) return listOf(value[field]);
    }
  }
  const name = nameOf(value);
  return name ? [name] : [];
}

function unique(values) {
  const seen = new Set();
  return values.map(nameOf).filter(value => {
    const key = keyOf(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function firstList(source, fields) {
  for (const field of fields) {
    const values = unique(listOf(source?.[field]));
    if (values.length) return values;
  }
  return [];
}

function timestampOf(match) {
  const date = clean(match?.date).slice(0, 10);
  const hour = clean(match?.hour).slice(0, 5) || '00:00';
  if (date) {
    const value = new Date(`${date}T${hour}:00`).getTime();
    if (Number.isFinite(value)) return value;
  }
  return new Date(match?.created_at || match?.created_date || match?.updated_at || 0).getTime() || 0;
}

function normalizeMatch(match, index) {
  const champion = nameOf(match.own_champion_name || match.champion_name || match.champion);
  const directEnemy = nameOf(match.enemy_champion_name || match.enemy_champion);
  const enemies = unique([
    ...firstList(match, ['enemy_champions', 'enemies', 'enemy_team']),
    directEnemy,
  ]).filter(name => keyOf(name) !== keyOf(champion));

  return {
    raw: match,
    id: match.id || `match-${index}`,
    timestamp: timestampOf(match),
    result: keyOf(match.result),
    won: keyOf(match.result) === 'win',
    champion,
    lane: laneOf(match.lane),
    side: keyOf(match.side),
    directEnemy,
    allies: unique(firstList(match, ['ally_champions', 'allies', 'ally_team']))
      .filter(name => keyOf(name) !== keyOf(champion)),
    enemies,
    items: unique(firstList(match, ['items_used', 'build_items', 'items', 'item_names', 'build'])),
    runes: unique(firstList(match, ['runes_used', 'runes', 'rune_names', 'selected_runes', 'build_runes'])),
    spells: unique(firstList(match, ['spells_used', 'spells', 'spell_names'])),
    tags: unique(firstList(match, ['tags', 'match_tags'])),
    buildId: match.build_id || null,
    kills: Number(match.kills) || 0,
    deaths: Number(match.deaths) || 0,
    assists: Number(match.assists) || 0,
    gold: Number(match.gold) || 0,
    duration: Number(match.duration_minutes || match.duration) || 0,
    patch: clean(match.patch),
  };
}

function summarize(rows) {
  const games = rows.length;
  const wins = rows.filter(row => row.won).length;
  const deaths = rows.reduce((sum, row) => sum + row.deaths, 0);
  const kills = rows.reduce((sum, row) => sum + row.kills, 0);
  const assists = rows.reduce((sum, row) => sum + row.assists, 0);
  return {
    games,
    wins,
    wr: games ? (wins / games) * 100 : 0,
    avgDeaths: games ? deaths / games : 0,
    kda: deaths ? (kills + assists) / deaths : kills + assists,
  };
}

function groupBy(rows, getKeys) {
  const groups = new Map();
  rows.forEach(row => {
    const values = Array.isArray(getKeys(row)) ? getKeys(row) : [getKeys(row)];
    unique(values).forEach(value => {
      const key = keyOf(value);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, { name: value, rows: [] });
      groups.get(key).rows.push(row);
    });
  });
  return [...groups.values()].map(group => ({ ...group, ...summarize(group.rows) }));
}

function pairedGroups(rows, getLeft, getRight) {
  const groups = new Map();
  rows.forEach(row => {
    const left = nameOf(getLeft(row));
    const rights = Array.isArray(getRight(row)) ? getRight(row) : [getRight(row)];
    unique(rights).forEach(right => {
      const id = `${keyOf(left)}|||${keyOf(right)}`;
      if (!left || !right) return;
      if (!groups.has(id)) groups.set(id, { id, left, right, rows: [] });
      groups.get(id).rows.push(row);
    });
  });
  return [...groups.values()].map(group => ({ ...group, ...summarize(group.rows) }));
}

function percent(value) { return `${Math.round(value)}%`; }
function games(value) { return `${value} ${tr(value === 1 ? 'stats.partidaOne' : 'goals.unit.partidas')}`; }

function confidence(sample, effect = 0, corroboration = 0) {
  const volume = Math.min(1, Math.sqrt(sample / 12));
  const strength = Math.min(1, Math.abs(effect) / 25);
  return Math.max(0.12, Math.min(0.98, volume * 0.65 + strength * 0.25 + corroboration * 0.1));
}

function confidenceLabel(value) {
  if (value >= 0.76) return tr('home.confianzaAlta');
  if (value >= 0.48) return tr('home.confianzaMedia');
  return tr('insights.senalInicial');
}

function catalogMap(rows) {
  return new Map((rows || []).map(row => [keyOf(row.name || row.champion_name), row]));
}

function latestTierMap(tierlist) {
  const result = new Map();
  [...(tierlist || [])]
    .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
    .forEach(entry => {
      const id = `${keyOf(entry.champion_name)}|||${laneOf(entry.lane)}`;
      if (!result.has(id)) result.set(id, entry);
      const championId = keyOf(entry.champion_name);
      const current = result.get(championId);
      if (!current || Number(entry.ranking_final || 0) > Number(current.ranking_final || 0)) {
        result.set(championId, entry);
      }
    });
  return result;
}

function relationNames(entity, fields) {
  return unique(fields.flatMap(field => listOf(entity?.[field])));
}

const itemStatGuidance = [
  { key: 'armor', get label() { return tr('itemStats.armor').toLowerCase(); }, get useful() { return tr('insights.danoFisicoSostenido'); }, get weak() { return tr('insights.unaComposicionMayormenteMagica'); } },
  { key: 'magic_res', get label() { return tr('insights.resistenciaMagica'); }, get useful() { return tr('insights.danoMagicoRelevante'); }, get weak() { return tr('insights.unaComposicionMayormenteFisica'); } },
  { key: 'tenacity', get label() { return tr('itemStats.tenacity').toLowerCase(); }, get useful() { return tr('insights.muchoControlDeMasas'); }, get weak() { return tr('insights.pocoControlOLevantamientos'); } },
  { key: 'life', get label() { return tr('itemStats.life').toLowerCase(); }, get useful() { return tr('insights.danoMixtoOBurst'); }, get weak() { return tr('insights.danoPorcentualDeVida'); } },
  { key: 'attack_damage', get label() { return tr('insights.danoDeAtaque'); }, get useful() { return tr('insights.potenciarTuDanoFisico'); }, get weak() { return tr('insights.unaPartidaDondeNecesitas'); } },
  { key: 'ability_power', get label() { return tr('insights.poderDeHabilidad'); }, get useful() { return tr('insights.potenciarEscaladosMagicos'); }, get weak() { return tr('insights.unaPartidaDondeNecesitas'); } },
  { key: 'attack_speed', get label() { return tr('insights.velocidadDeAtaque'); }, get useful() { return tr('insights.peleasLargasEnLas'); }, get weak() { return tr('insights.composicionesQueNoTe'); } },
  { key: 'critical_impact', get label() { return tr('insights.probabilidadDeCritico'); }, get useful() { return tr('insights.unaBuildQueYa'); }, get weak() { return tr('insights.unaBuildOrientadaA'); } },
  { key: 'percentage_armor_penetration', get label() { return tr('insights.penetracionDeArmadura'); }, get useful() { return tr('insights.rivalesQueAcumulanArmadura'); }, get weak() { return tr('insights.equiposFragilesConPoca'); } },
  { key: 'flat_armor_penetration', get label() { return tr('insights.penetracionDeArmadura'); }, get useful() { return tr('insights.objetivosFragilesConPoca'); }, get weak() { return tr('insights.variosRivalesQueAcumulan'); } },
  { key: 'percentage_magic_penetration', get label() { return tr('insights.penetracionMagica'); }, get useful() { return tr('insights.rivalesQueAcumulanResistencia'); }, get weak() { return tr('insights.equiposConPocaResistencia'); } },
  { key: 'flat_magic_penetration', get label() { return tr('insights.penetracionMagica'); }, get useful() { return tr('insights.objetivosFragilesConPoca2'); }, get weak() { return tr('insights.variosRivalesQueAcumulan2'); } },
  { key: 'ability_haste', get label() { return tr('insights.aceleracionDeHabilidad'); }, get useful() { return tr('insights.peleasDondePodesLanzar'); }, get weak() { return tr('insights.intercambiosQueSeDeciden'); } },
  { key: 'lifesteal', get label() { return tr('insights.roboDeVida'); }, get useful() { return tr('insights.peleasExtendidasEnLas'); }, get weak() { return tr('insights.burstOControlQue'); } },
  { key: 'physic_vamp', get label() { return tr('insights.vampirismoFisico'); }, get useful() { return tr('insights.peleasExtendidasEnLas2'); }, get weak() { return tr('insights.burstOControlQue2'); } },
  { key: 'magic_vamp', get label() { return tr('insights.vampirismoMagico'); }, get useful() { return tr('insights.peleasExtendidasEnLas3'); }, get weak() { return tr('insights.burstOControlQue3'); } },
  { key: 'healing_and_shield', get label() { return tr('insights.potenciaDeCuracionesY'); }, get useful() { return tr('insights.unaBuildConCuraciones'); }, get weak() { return tr('insights.unKitQueCasi'); } },
];

function describeItemStats(item) {
  const stats = itemStatGuidance
    .filter(stat => Number(item?.[stat.key]) > 0)
    .sort((a, b) => Number(item?.[b.key]) - Number(item?.[a.key]));
  if (!stats.length) return null;
  const primary = stats[0];
  const labels = stats.slice(0, 2).map(stat => stat.label);
  return {
    summary: labels.length === 2 ? `${labels[0]} y ${labels[1]}` : labels[0],
    useful: primary.useful,
    weak: primary.weak,
  };
}

function championRelations(champion) {
  return {
    strong: relationNames(champion, ['strong_against', 'strongAgainst', 'good_against', 'goodAgainst', 'counters']),
    weak: relationNames(champion, ['weak_against', 'weakAgainst', 'avoid_against', 'avoidAgainst', 'countered_by']),
    synergies: relationNames(champion, ['synergies', 'synergy', 'good_with', 'goodWith', 'best_allies']),
  };
}

function recommendedItems(champion) {
  return relationNames(champion, [
    'recommended_items', 'recommendedItems', 'core_items', 'coreItems', 'suggested_items',
  ]);
}

function championRoles(champion) {
  return unique([...listOf(champion?.roles), ...listOf(champion?.role), champion?.lane, champion?.position]).map(laneOf);
}

function poolCounterFor(ctx, enemy, excludedChampion, lane) {
  return groupBy(ctx.matches, row => row.champion)
    .filter(entry => keyOf(entry.name) !== keyOf(excludedChampion))
    .filter(entry => entry.rows.some(row => !lane || row.lane === lane))
    .filter(entry => championRelations(ctx.championCatalog.get(keyOf(entry.name))).strong.some(name => keyOf(name) === keyOf(enemy)))
    .sort((a, b) => (b.games * 2 + b.wr / 10) - (a.games * 2 + a.wr / 10))[0] || null;
}

function makeCard({ id, domain, tone = 'neutral', title, thesis, action, evidence = [], sample = 0,
  effect = 0, corroboration = 0, score = 50, entities = [], sources = [] }) {
  const certainty = confidence(sample, effect, corroboration);
  return {
    id, domain, tone, title, thesis, action,
    evidence: evidence.filter(Boolean).slice(0, 3),
    confidence: certainty,
    confidenceLabel: confidenceLabel(certainty),
    sampleSize: sample,
    score: score + certainty * 18,
    entities: entities.map(keyOf).filter(Boolean),
    sources: unique(sources),
  };
}

function detectRecentForm(ctx) {
  const { matches } = ctx;
  if (matches.length < 12) return [];
  const window = Math.min(10, Math.floor(matches.length / 2));
  const recentRows = matches.slice(0, window);
  const previousRows = matches.slice(window, window * 2);
  if (previousRows.length < 6) return [];
  const recent = summarize(recentRows);
  const previous = summarize(previousRows);
  const delta = recent.wr - previous.wr;
  const deathDelta = recent.avgDeaths - previous.avgDeaths;
  if (Math.abs(delta) < 14 && Math.abs(deathDelta) < 1.25) return [];

  const improving = delta > 0;
  let reading;
  let action;
  if (deathDelta >= 1.25) {
    reading = tr('insights.enTusUltimasPartidas', { window, percent: percent(recent.wr), percent2: percent(previous.wr), value: previous.avgDeaths.toFixed(1), value2: recent.avgDeaths.toFixed(1) });
    action = tr('insights.duranteLasProximas5');
  } else if (deathDelta <= -1.25) {
    reading = tr('insights.enTusUltimasPartidas2', { window, percent: percent(recent.wr), percent2: percent(previous.wr), value: previous.avgDeaths.toFixed(1), value2: recent.avgDeaths.toFixed(1) });
    action = tr('insights.manteneElMismoPool');
  } else {
    reading = tr('insights.enTusUltimasPartidas3', { window, percent: percent(recent.wr), percent2: percent(previous.wr), value: previous.avgDeaths.toFixed(1), value2: recent.avgDeaths.toFixed(1) });
    action = improving
      ? tr('insights.repetiDurante5Partidas')
      : tr('insights.comparaLas5Derrotas');
  }

  return [makeCard({
    id: 'recent-form', domain: 'forma', tone: improving ? 'positive' : 'warning',
    title: improving ? tr('insights.tuRendimientoRecienteMejoro') : tr('insights.tuRendimientoRecienteBajo'),
    thesis: reading, action, sample: recent.games + previous.games, effect: delta,
    evidence: [tr('insights.ultimas', { window, percent: percent(recent.wr) }), tr('insights.anteriores', { percent: percent(previous.wr) }), tr('insights.muertesPorPartida', { value: recent.avgDeaths.toFixed(1) })],
    score: 90, sources: ['partidas'],
  })];
}

function detectCloseGamePattern(ctx) {
  const shortGames = ctx.matches.filter(match => match.duration > 0 && match.duration < 10);
  const longGames = ctx.matches.filter(match => match.duration >= 20);
  if (shortGames.length < 4 || longGames.length < 4) return [];

  const shortSummary = summarize(shortGames);
  const longSummary = summarize(longGames);
  const gap = longSummary.wr - shortSummary.wr;
  if (Math.abs(gap) < 18) return [];

  const longGamesAreWorse = gap < 0;
  return [makeCard({
    id: 'close-game-pattern', domain: 'cierre', tone: longGamesAreWorse ? 'warning' : 'positive',
    title: longGamesAreWorse
      ? tr('insights.tuRendimientoBajaCuando')
      : tr('insights.tuRendimientoMejoraCuando'),
    thesis: tr('insights.enLasPartidasDe', { percent: percent(shortSummary.wr), games: games(shortSummary.games), percent2: percent(longSummary.wr), games2: games(longSummary.games), percent3: percent(Math.abs(gap)) }),
    action: longGamesAreWorse
      ? tr('insights.enLasProximasPartidas')
      : tr('insights.enLasProximasPartidas2'),
    sample: shortSummary.games + longSummary.games,
    effect: gap,
    evidence: [
      tr('insights.menosDe10Min', { percent: percent(shortSummary.wr), games: shortSummary.games }),
      tr('insights.20MinOMas', { percent: percent(longSummary.wr), games: longSummary.games }),
      tr('insights.diferencia', { percent: percent(Math.abs(gap)) }),
    ],
    score: 82,
    sources: ['partidas'],
  })];
}

function detectLossFingerprint(ctx) {
  const losses = ctx.matches.filter(row => !row.won);
  const wins = ctx.matches.filter(row => row.won);
  if (losses.length < 5 || wins.length < 4) return [];
  const lossStats = summarize(losses);
  const winStats = summarize(wins);
  const deathGap = lossStats.avgDeaths - winStats.avgDeaths;
  const tags = groupBy(losses, row => row.tags).filter(group => group.games >= 3)
    .sort((a, b) => b.games - a.games)[0];
  if (deathGap < 1.2 && !tags) return [];

  const hook = tags
    ? tr('insights.elTagApareceEn', { name: tags.name, games: tags.games, length: losses.length, value: deathGap >= 1.2 ? `. Además, promediás ${lossStats.avgDeaths.toFixed(1)} muertes en las derrotas y ${winStats.avgDeaths.toFixed(1)} en las victorias` : '' })
    : tr('insights.enTusVictoriasPromedias', { value: winStats.avgDeaths.toFixed(1), value2: lossStats.avgDeaths.toFixed(1) });
  return [makeCard({
    id: `loss-fingerprint-${keyOf(tags?.name || 'deaths')}`, domain: tr('insights.diagnostico'), tone: 'critical',
    title: tags ? tr('insights.patronDeDerrota', { name: tags.name }) : tr('insights.lasMuertesSeparanVictorias'), thesis: hook,
    action: tags
      ? tr('insights.revisaLas3Derrotas', { name: tags.name })
      : tr('insights.duranteLasProximas52'),
    sample: losses.length, effect: deathGap * 8, evidence: [
      tr('insights.derrotasMuertes', { value: lossStats.avgDeaths.toFixed(1) }),
      tr('insights.victoriasMuertes', { value: winStats.avgDeaths.toFixed(1) }),
      tags && tr('insights.con', { games: tags.games, length: losses.length, name: tags.name }),
    ], score: 86, sources: ['partidas', tags ? 'tags' : null],
  })];
}

function detectChampionIdentity(ctx) {
  const { matches, tierByChampion } = ctx;
  const overall = summarize(matches);
  const champs = groupBy(matches, row => row.champion).sort((a, b) => b.games - a.games);
  if (!champs.length) return [];
  const cards = [];
  const main = champs[0];
  const mainDelta = main.wr - overall.wr;
  const mainTier = tierByChampion.get(keyOf(main.name));
  if (main.games >= 7 && Math.abs(mainDelta) >= 9) {
    const under = mainDelta < 0;
    cards.push(makeCard({
      id: `identity-main-${keyOf(main.name)}`, domain: 'pool', tone: under ? 'warning' : 'positive',
      title: under ? tr('insights.esTuPickPrincipal', { name: main.name }) : tr('insights.combinaVolumenYBuen', { name: main.name }),
      thesis: under
        ? tr('insights.esTuCampeonMas', { name: main.name, games: games(main.games), percent: percent(main.wr), percent2: percent(overall.wr) })
        : tr('insights.esTuCampeonMas2', { name: main.name, games: games(main.games), percent: percent(main.wr), percent2: percent(overall.wr), value: mainTier?.tier ? tr('insights.laTierlistActualTambien', { tier: mainTier.tier }) : tr('insights.elVolumenYEl') }),
      action: under
        ? tr('insights.juga5PartidasCon')
        : tr('insights.manteneloComoPickPrincipal'),
      sample: main.games, effect: mainDelta, evidence: [
        `${games(main.games)} · ${percent(main.wr)}`,
        tr('insights.tuBase', { percent: percent(overall.wr) }),
        mainTier?.tier && tr('insights.metaTier', { tier: mainTier.tier }),
      ], entities: [main.name], score: 84, sources: ['partidas', mainTier ? 'tierlist' : null],
    }));
  }

  const pocket = champs.filter(champ => champ.games >= 4 && champ.wr >= overall.wr + 14)
    .sort((a, b) => (b.wr - overall.wr) - (a.wr - overall.wr))[0];
  if (pocket && keyOf(pocket.name) !== keyOf(main.name)) {
    const tier = tierByChampion.get(keyOf(pocket.name));
    cards.push(makeCard({
      id: `identity-pocket-${keyOf(pocket.name)}`, domain: 'pool', tone: 'opportunity',
      title: tr('insights.muestraPotencialParaGanar', { name: pocket.name }),
      thesis: tr('insights.conRegistrasDeWinrate', { name: pocket.name, percent: percent(pocket.wr), games: games(pocket.games), percent2: percent(overall.wr), value: tier?.tier ? tr('insights.actualmenteApareceEnTier', { tier: tier.tier }) : '' }),
      action: tr('insights.jugalo5VecesMas'),
      sample: pocket.games, effect: pocket.wr - overall.wr,
      evidence: [`${games(pocket.games)} · ${percent(pocket.wr)}`, tr('insights.promedioGeneral', { percent: percent(overall.wr) }), tier?.tier && tr('insights.meta', { tier: tier.tier })],
      entities: [pocket.name], score: 78, sources: ['partidas', tier ? 'tierlist' : null],
    }));
  }
  return cards;
}

function detectPoolShape(ctx) {
  const { matches, championCatalog } = ctx;
  if (matches.length < 15) return [];
  const champs = groupBy(matches, row => row.champion).sort((a, b) => b.games - a.games);
  const topShare = champs.slice(0, 3).reduce((sum, champ) => sum + champ.games, 0) / matches.length;
  const laneCount = new Set(matches.map(row => row.lane).filter(Boolean)).size;
  const damageTypes = unique(champs.slice(0, 4).map(champ => championCatalog.get(keyOf(champ.name))?.damage_type));
  const scaledSampleSize = Math.min(matches.length, 60);
  const scatteredThreshold = Math.max(0.54, 0.72 - (scaledSampleSize - 15) * 0.003);
  if (topShare < scatteredThreshold && laneCount <= 2) return [];
  const scattered = topShare < scatteredThreshold;
  const coreNames = champs.slice(0, 3).map(champ => champ.name);
  const coreRelations = coreNames.map(name => ({
    name,
    ...championRelations(championCatalog.get(keyOf(name))),
  }));
  const sharedWeaknesses = unique(coreRelations.flatMap(entry => entry.weak))
    .filter(enemy => coreRelations.filter(entry => entry.weak.some(name => keyOf(name) === keyOf(enemy))).length >= 2);
  const uncoveredEnemy = sharedWeaknesses[0];
  const coverPick = champs.slice(3).find(champ => {
    const relations = championRelations(championCatalog.get(keyOf(champ.name)));
    return uncoveredEnemy && relations.strong.some(name => keyOf(name) === keyOf(uncoveredEnemy));
  });
  return [makeCard({
    id: 'pool-shape', domain: 'pool', tone: scattered ? 'warning' : 'neutral',
    title: scattered
      ? tr('insights.tuPoolEstaRepartido')
      : tr('insights.tuPoolEstaConcentrado', { length: coreNames.length, value: tr(coreNames.length === 1 ? 'goals.filterNames.champions' : 'insights.words.champions') }),
    thesis: scattered
      ? tr('insights.usasteCampeonesEnY', { length: champs.length, games: games(matches.length), percent: percent(topShare * 100) })
      : tr('insights.elDeTus', { value: coreNames.join(', '), value2: tr(coreNames.length === 1 ? 'insights.words.concentraOne' : 'insights.words.concentraOther'), percent: percent(topShare * 100), games: games(matches.length), value3: damageTypes.length === 1 ? tr('insights.ademasDanoPorLo', { value: tr(coreNames.length === 1 ? 'insights.words.usaOne' : 'insights.words.usaOther'), value2: damageTypes[0] }) : tr('insights.laConcentracionFavoreceLa'), value4: uncoveredEnemy ? tr('insights.figuraComoDebilidadDe', { uncoveredEnemy, value: coverPick ? tr('insights.mientrasQueApareceComo', { name: coverPick.name }) : '' }) : '' }),
    action: scattered
      ? tr('insights.limitaLasProximas10')
      : coverPick
        ? tr('insights.usaAComoPick', { name: coverPick.name, uncoveredEnemy, name2: champs[0]?.name })
        : uncoveredEnemy
          ? tr('insights.tuSiguientePickDebe', { uncoveredEnemy, value: damageTypes.length === 1 })
          : tr('insights.manteneEsteNucleoPara', { name: champs[0]?.name }),
    sample: matches.length, effect: (topShare - 0.6) * 100,
    evidence: [tr('insights.top3', { percent: percent(topShare * 100) }), tr('insights.umbral', { percent: percent(scatteredThreshold * 100) }), tr('insights.picksUsados', { length: champs.length })],
    score: uncoveredEnemy ? 81 : 67, sources: ['partidas', championCatalog.size ? 'campeones' : null],
  })];
}

function detectChoiceLeverage(ctx, type) {
  const config = {
    item: { values: row => row.items, label: 'objeto', domain: 'build', min: 4 },
    rune: { values: row => row.runes, label: 'runa', domain: 'runas', min: 4 },
    spell: { values: row => row.spells.length === 2 ? [row.spells.slice().sort().join(' + ')] : [], label: tr('insights.duplaDeHechizos'), domain: 'hechizos', min: 4 },
  }[type];
  const candidates = pairedGroups(ctx.matches, row => row.champion, config.values)
    .filter(group => group.games >= config.min)
    .map(group => {
      const championRows = ctx.matches.filter(row => keyOf(row.champion) === keyOf(group.left));
      const without = championRows.filter(row => !group.rows.includes(row));
      return { ...group, baseline: summarize(without), championGames: championRows.length };
    })
    .filter(group => group.baseline.games >= 3)
    .map(group => ({ ...group, delta: group.wr - group.baseline.wr }))
    .filter(group => Math.abs(group.delta) >= 16)
    .sort((a, b) => (Math.abs(b.delta) * Math.min(b.games, 10)) - (Math.abs(a.delta) * Math.min(a.games, 10)));
  const best = candidates[0];
  if (!best) return [];
  const positive = best.delta > 0;
  const itemData = type === 'item' ? ctx.itemCatalog.get(keyOf(best.right)) : null;
  const championData = type === 'item' ? ctx.championCatalog.get(keyOf(best.left)) : null;
  const recommended = recommendedItems(championData).some(name => keyOf(name) === keyOf(best.right));
  const goodAgainst = relationNames(itemData, ['good_against', 'goodAgainst', 'strong_against', 'recommended_against']);
  const avoidAgainst = relationNames(itemData, ['avoid_against', 'avoidAgainst', 'weak_against', 'bad_against']);
  const encountered = unique(best.rows.flatMap(row => row.enemies));
  const corroboratedGood = goodAgainst.find(name => encountered.some(enemy => keyOf(enemy) === keyOf(name)));
  const corroboratedBad = avoidAgainst.find(name => encountered.some(enemy => keyOf(enemy) === keyOf(name)));
  const statProfile = describeItemStats(itemData);
  const context = corroboratedGood
    ? tr('insights.ademasElCatalogoLo', { corroboratedGood })
    : corroboratedBad ? tr('insights.sinEmbargoElCatalogo', { corroboratedBad })
      : recommended ? tr('insights.tambienFiguraEntreLos', { left: best.left }) : '';
  const itemContext = type === 'item' && statProfile
    ? tr('insights.elObjetoAportaPrincipalmente', { summary: statProfile.summary, useful: statProfile.useful, weak: statProfile.weak })
    : '';
  const cautiousItemTitle = positive
    ? tr('insights.revisaCuandoTeConviene', { right: best.right, left: best.left })
    : tr('insights.revisaSiEncajaEn', { right: best.right, left: best.left });
  const itemAction = corroboratedBad
    ? tr('insights.revisaEspecialmenteSuCompra', { corroboratedBad, right: best.right })
    : corroboratedGood
      ? tr('insights.tomaElCruceContra', { corroboratedGood })
      : statProfile
        ? tr('insights.antesDeComprarloComproba', { summary: statProfile.summary, useful: statProfile.useful, weak: statProfile.weak })
        : tr('insights.noDescartesElObjeto');
  const choiceTitle = type === 'rune'
    ? positive
      ? tr('insights.revisaCuandoTeConviene2', { right: best.right, left: best.left })
      : tr('insights.dejaDeEquiparPor', { right: best.right, left: best.left })
    : positive
      ? tr('insights.revisaCuandoTeConviene3', { right: best.right, left: best.left })
      : tr('insights.dejaDeUsarPor', { right: best.right, left: best.left });
  const choiceAction = type === 'rune'
    ? positive
      ? tr('insights.conservalaComoUnaOpcion', { left: best.left })
      : tr('insights.sacalaDeLaPagina')
    : positive
      ? tr('insights.conservalaComoUnaOpcion2', { left: best.left })
      : tr('insights.dejaDeSeleccionarlaPor');

  return [makeCard({
    id: `${type}-${keyOf(best.left)}-${keyOf(best.right)}`, domain: config.domain,
    tone: positive ? 'opportunity' : 'critical',
    title: type === 'item' ? cautiousItemTitle : choiceTitle,
    thesis: tr('insights.conRegistrasDeWinrate2', { left: best.left, percent: percent(best.wr), games: games(best.games), right: best.right, percent2: percent(best.baseline.wr), games2: games(best.baseline.games), percent3: percent(Math.abs(best.delta)), value: type === 'item' ? tr('insights.elObjeto') : tr('insights.estaEleccion'), context, itemContext }),
    action: type === 'item' ? itemAction : choiceAction,
    sample: best.games + best.baseline.games, effect: best.delta,
    corroboration: corroboratedGood || corroboratedBad || recommended ? 1 : 0,
    evidence: [tr('insights.con2', { percent: percent(best.wr), games: best.games }), tr('insights.sin', { percent: percent(best.baseline.wr), games: best.baseline.games }), corroboratedGood ? tr('insights.buenaVs', { corroboratedGood }) : recommended && tr('insights.recomendadoParaElCampeon')],
    entities: [best.left, best.right], score: type === 'item' ? 82 : 72,
    sources: ['partidas', type === 'item' && itemData ? 'objetos' : type === 'rune' ? 'runas' : 'hechizos', recommended ? 'campeones' : null],
  })];
}

function detectRecommendedItemFit(ctx) {
  const candidates = groupBy(ctx.matches, row => row.champion).flatMap(champion => {
    const wanted = recommendedItems(ctx.championCatalog.get(keyOf(champion.name)));
    if (!wanted.length || champion.games < 2) return [];
    const withRows = champion.rows.filter(row => row.items.some(item => wanted.some(value => keyOf(value) === keyOf(item))));
    const withoutRows = champion.rows.filter(row => !withRows.includes(row));
    const missing = wanted.filter(item => !champion.rows.some(row => row.items.some(used => keyOf(used) === keyOf(item))));
    return [{ champion, wanted, missing, adherence: withRows.length / champion.games, withStats: summarize(withRows), withoutStats: summarize(withoutRows) }];
  }).sort((a, b) => (b.champion.games * (1 - b.adherence)) - (a.champion.games * (1 - a.adherence)));
  const pick = candidates[0];
  if (!pick) return [];
  const comparison = pick.withStats.games >= 2 && pick.withoutStats.games >= 2;
  const delta = comparison ? pick.withStats.wr - pick.withoutStats.wr : 0;
  return [makeCard({
    id: `recommended-items-${keyOf(pick.champion.name)}`, domain: 'build', tone: pick.adherence < 0.5 ? 'warning' : 'neutral',
    title: tr('insights.contrastaTuBuildDe', { name: pick.champion.name }),
    thesis: tr('insights.tieneComoObjetosRecomendados', { name: pick.champion.name, value: pick.wanted.join(', '), games: pick.withStats.games, games2: pick.champion.games, percent: percent(pick.adherence * 100), value2: comparison ? tr('insights.conObjetosRecomendadosRegistras', { percent: percent(pick.withStats.wr), percent2: percent(pick.withoutStats.wr) }) : tr('insights.todaviaNoHayDos') }),
    action: pick.missing.length ? tr('insights.probaPrimeroCuandoSus', { value: pick.missing.slice(0, 2).join(' o ') }) : tr('insights.revisaEnQueMatchups'),
    sample: pick.champion.games, effect: delta,
    evidence: [tr('insights.recomendadosPresentes', { percent: percent(pick.adherence * 100) }), tr('insights.partidasCon', { games: pick.champion.games, name: pick.champion.name }), comparison && tr('insights.diferenciaObservada', { percent: percent(Math.abs(delta)) })],
    entities: [pick.champion.name, ...pick.wanted], score: 84, sources: ['partidas', 'campeones', 'objetos'],
  })];
}
function detectAllySynergy(ctx) {
  const pairs = pairedGroups(ctx.matches, row => row.champion, row => row.allies)
    .filter(pair => pair.games >= 3)
    .map(pair => {
      const baseline = summarize(ctx.matches.filter(row => keyOf(row.champion) === keyOf(pair.left)));
      return { ...pair, baseline, delta: pair.wr - baseline.wr };
    })
    .filter(pair => {
      const relations = championRelations(ctx.championCatalog.get(keyOf(pair.left)));
      return Math.abs(pair.delta) >= 20 || relations.synergies.some(name => keyOf(name) === keyOf(pair.right));
    })
    .sort((a, b) => Math.abs(b.delta) * b.games - Math.abs(a.delta) * a.games);
  const pair = pairs[0];
  if (!pair) return [];
  const catalogSynergy = championRelations(ctx.championCatalog.get(keyOf(pair.left))).synergies.some(name => keyOf(name) === keyOf(pair.right));
  const allyRoles = championRoles(ctx.championCatalog.get(keyOf(pair.right)));
  const allyRole = allyRoles.includes('dragonline') ? tr('lanes.adc') : allyRoles.includes('support') ? tr('lanes.support') : allyRoles[0];
  const roleContext = pair.rows[0]?.lane === 'support' && allyRole === 'ADC'
    ? tr('insights.estaEsAdemasTu')
    : allyRole ? tr('insights.laSenalTambienQueda', { allyRole, right: pair.right }) : '';
  return [makeCard({
    id: `synergy-${pair.id}`, domain: 'sinergia', tone: pair.delta > 0 ? 'opportunity' : 'warning',
    title: pair.delta > 0 ? tr('insights.buscaLaDuplaEn', { left: pair.left, right: pair.right }) : tr('insights.revisaLaSinergiaDe', { left: pair.left, right: pair.right }),
    thesis: tr('insights.cuandoApareceComoAliado', { right: pair.right, left: pair.left, percent: percent(pair.wr), games: games(pair.games), percent2: percent(pair.baseline.wr), left2: pair.left, value: catalogSynergy ? tr('insights.elCatalogoTambienIdentifica') : '', roleContext }),
    action: pair.delta > 0
      ? tr('insights.priorizaCuandoTuEquipo', { left: pair.left, right: pair.right })
      : tr('insights.noCompletesEstaDupla'),
    sample: pair.games, effect: pair.delta, corroboration: catalogSynergy ? 1 : 0,
    evidence: [tr('insights.juntos', { percent: percent(pair.wr), games: pair.games }), `${pair.left}: ${percent(pair.baseline.wr)}`, allyRole && tr('insights.rolAliado', { allyRole })],
    entities: [pair.left, pair.right], score: catalogSynergy ? 88 : 78,
    sources: ['partidas', 'composiciones', catalogSynergy ? 'campeones' : null],
  })];
}
function snapshotKeyOf(entry) {
  return clean(entry?.snapshot_key) ||
    `${keyOf(entry?.patch)}::${clean(entry?.snapshot_date || entry?.updated_at).slice(0, 10)}`;
}

function snapshotTime(entry) {
  const value = entry?.snapshot_date || entry?.updated_at || 0;
  return new Date(String(value).length === 10 ? `${value}T00:00:00` : value).getTime() || 0;
}

function snapshotLabel(entry) {
  const rawDate = clean(entry?.snapshot_date || entry?.updated_at).slice(0, 10);
  const dateLabel = rawDate ? rawDate.split('-').reverse().join('/') : tr('tierlist.sinFecha');
  return `${clean(entry?.patch) || tr('insights.sinParche')} · ${dateLabel}`;
}

function detectMetaMovement(ctx) {
  const played = groupBy(ctx.matches, row => row.champion).filter(champ => champ.games >= 3);
  const movements = played.flatMap(champ => {
    const bestBySnapshot = new Map();
    ctx.tierlist
      .filter(entry => keyOf(entry.champion_name) === keyOf(champ.name))
      .forEach(entry => {
        const snapshotKey = snapshotKeyOf(entry);
        const current = bestBySnapshot.get(snapshotKey);
        if (!current || Number(entry.ranking_final || 0) > Number(current.ranking_final || 0)) {
          bestBySnapshot.set(snapshotKey, entry);
        }
      });
    const entries = [...bestBySnapshot.values()].sort((a, b) => snapshotTime(b) - snapshotTime(a));
    const latest = entries[0];
    const previous = entries[1];
    if (!latest || !previous) return [];
    const rankDelta = Number(latest.ranking_final || 0) - Number(previous.ranking_final || 0);
    const tierChanged = clean(latest.tier) !== clean(previous.tier);
    if (!tierChanged && Math.abs(rankDelta) < 8) return [];
    return [{ champ, latest, previous, rankDelta }];
  }).sort((a, b) => Math.abs(b.rankDelta) - Math.abs(a.rankDelta));
  const move = movements[0];
  if (!move) return [];
  const personal = move.champ.wr - summarize(ctx.matches).wr;
  const rising = move.rankDelta > 0;
  const agrees = (rising && personal > 5) || (!rising && personal < -5);
  return [makeCard({
    id: `meta-move-${keyOf(move.champ.name)}`, domain: 'meta', tone: agrees ? 'opportunity' : 'neutral',
    title: tr('insights.cambioDePosicionEn', { name: move.champ.name }),
    thesis: tr('insights.pasoDeTierEn', { name: move.champ.name, value: move.previous.tier || tr('insights.sinClasificacion'), snapshotLabel: snapshotLabel(move.previous), value2: move.latest.tier || tr('insights.sinClasificacion'), snapshotLabel2: snapshotLabel(move.latest), percent: percent(move.champ.wr), games: games(move.champ.games), percent2: percent(summarize(ctx.matches).wr) }),
    action: agrees
      ? tr('insights.priorizaDuranteLasProximas', { name: move.champ.name })
      : tr('insights.noCambiesTodaviaSu'),
    sample: move.champ.games, effect: move.rankDelta,
    evidence: [`${snapshotLabel(move.previous)}: ${move.previous.tier}`, `${snapshotLabel(move.latest)}: ${move.latest.tier}`, tr('insights.personal', { percent: percent(move.champ.wr) })],
    entities: [move.champ.name], score: 76, sources: ['partidas', 'tierlists'],
  })];
}

function detectMatchup(ctx) {
  const pairs = pairedGroups(ctx.matches, row => row.champion, row => row.directEnemy)
    .filter(pair => pair.games >= 2)
    .map(pair => {
      const championRows = ctx.matches.filter(row => keyOf(row.champion) === keyOf(pair.left));
      const baseline = summarize(championRows);
      return { ...pair, baseline, delta: pair.wr - baseline.wr };
    })
    .filter(pair => {
      const relations = championRelations(ctx.championCatalog.get(keyOf(pair.left)));
      const catalogKnown = [...relations.strong, ...relations.weak].some(name => keyOf(name) === keyOf(pair.right));
      return Math.abs(pair.delta) >= 18 || catalogKnown;
    })
    .sort((a, b) => Math.abs(b.delta) * b.games - Math.abs(a.delta) * a.games);
  const pair = pairs[0];
  if (!pair) return [];
  const champion = ctx.championCatalog.get(keyOf(pair.left));
  const { strong, weak } = championRelations(champion);
  const catalogGood = strong.some(name => keyOf(name) === keyOf(pair.right));
  const catalogBad = weak.some(name => keyOf(name) === keyOf(pair.right));
  const conflict = (pair.delta > 0 && catalogBad) || (pair.delta < 0 && catalogGood);
  const corroborates = (pair.delta > 0 && catalogGood) || (pair.delta < 0 && catalogBad);
  const counter = poolCounterFor(ctx, pair.right, pair.left, pair.rows[0]?.lane);
  const unfavorable = catalogBad || pair.delta < 0;
  return [makeCard({
    id: `matchup-${pair.id}`, domain: tr('insights.matchupDirecto'), tone: unfavorable ? 'critical' : 'positive',
    title: unfavorable ? tr('insights.quedaExpuestoEnEl', { left: pair.left, right: pair.right }) : tr('insights.consideraComoRespuestaFrente', { left: pair.left, right: pair.right }),
    thesis: tr('insights.enElMatchupDirecto', { right: pair.right, left: pair.left, percent: percent(pair.wr), games: games(pair.games), percent2: percent(pair.baseline.wr), left2: pair.left, value: catalogBad ? tr('insights.elCatalogoMarcaA', { left: pair.left, right: pair.right }) : catalogGood ? tr('insights.elCatalogoMarcaA2', { left: pair.left, right: pair.right }) : '', value2: corroborates ? tr('insights.tuRendimientoPersonalCoincide') : conflict ? tr('insights.tuResultadoPersonalVa') : '', value3: counter ? tr('insights.dentroDeTuPool', { name: counter.name, right: pair.right }) : '' }),
    action: !unfavorable
      ? tr('insights.subiLaPrioridadDe', { left: pair.left, right: pair.right, value: catalogGood ? tr('insights.elHistorialYEl') : tr('insights.siElRestoDel') })
      : counter
        ? tr('insights.laProximaVezQue', { right: pair.right, name: counter.name, left: pair.left, left2: pair.left })
        : tr('insights.siElRivalMuestra', { right: pair.right, left: pair.left }),
    sample: pair.games, effect: pair.delta, corroboration: corroborates ? 1 : 0,
    evidence: [tr('insights.directo', { percent: percent(pair.wr), games: pair.games }), tr('insights.promedioDe', { left: pair.left, percent: percent(pair.baseline.wr) }), counter && tr('insights.alternativa', { name: counter.name })],
    entities: [pair.left, pair.right, counter?.name], score: unfavorable ? 91 : 83,
    sources: ['partidas', champion ? 'campeones' : null],
  })];
}
function buildSimilarity(match, build) {
  if (keyOf(match.champion) !== keyOf(build.champion_name)) return 0;
  const wanted = unique(listOf(build.items)).map(keyOf);
  if (!wanted.length) return 0;
  const actual = new Set(match.items.map(keyOf));
  return wanted.filter(item => actual.has(item)).length / wanted.length;
}

function detectSavedBuilds(ctx) {
  if (!ctx.builds.length) return [];
  const evaluated = ctx.builds.map(build => {
    const direct = ctx.matches.filter(match => String(match.buildId || '') === String(build.id || ''));
    const inferred = direct.length ? [] : ctx.matches.filter(match => buildSimilarity(match, build) >= 0.66);
    const rows = direct.length ? direct : inferred;
    return { build, rows, inferred: !direct.length && inferred.length > 0, ...summarize(rows) };
  });
  const used = evaluated.filter(entry => entry.games >= 3).sort((a, b) => b.games - a.games);
  const unused = evaluated.filter(entry => entry.games === 0);
  const stale = ctx.builds.filter(build => build.patch && ctx.latestPatch && clean(build.patch) !== ctx.latestPatch);
  const cards = [];
  if (used.length) {
    const entry = used.sort((a, b) => b.wr - a.wr || b.games - a.games)[0];
    cards.push(makeCard({
      id: `saved-build-${entry.build.id || keyOf(entry.build.name)}`, domain: 'build', tone: entry.wr >= 55 ? 'positive' : 'warning',
      title: tr('insights.laBuildYaTiene', { value: entry.build.name || entry.build.champion_name }),
      thesis: entry.inferred
        ? tr('insights.laBuildApareceAsociada', { games: games(entry.games), percent: percent(entry.wr) })
        : tr('insights.laBuildEstaVinculada', { games: games(entry.games), percent: percent(entry.wr) }),
      action: entry.wr >= 55
        ? tr('insights.conservaSusObjetosPrincipales')
        : tr('insights.comparaSusPrimeros3'),
      sample: entry.games, effect: entry.wr - summarize(ctx.matches).wr,
      evidence: [`${entry.build.champion_name}`, tr('insights.deWinrate', { percent: percent(entry.wr) }), entry.inferred ? tr('insights.vinculoEstimado') : tr('insights.vinculoDirecto')],
      entities: [entry.build.champion_name, entry.build.name], score: 79, sources: ['partidas', 'builds'],
    }));
  } else if (unused.length >= 2) {
    cards.push(makeCard({
      id: 'unused-builds', domain: 'build', tone: 'neutral', title: tr('insights.tusBuildsGuardadasTodavia'),
      thesis: tr('insights.deTusBuildsGuardadas', { length: unused.length, length2: ctx.builds.length }),
      action: tr('insights.elegiUnaBuildVinculala'),
      sample: ctx.builds.length, evidence: [tr('insights.sinUsoMedible', { length: unused.length }), tr('insights.guardadas', { length: ctx.builds.length })],
      score: 60, sources: ['builds', 'partidas'],
    }));
  }
  if (stale.length >= 2) {
    cards.push(makeCard({
      id: 'stale-builds', domain: 'meta', tone: 'warning', title: tr('insights.parteDeTusBuilds'),
      thesis: tr('insights.buildsFueronGuardadasEn', { length: stale.length, latestPatch: ctx.latestPatch }),
      action: tr('insights.revisaPrimeroLasBuilds'),
      sample: stale.length, evidence: [tr('insights.parcheActual', { latestPatch: ctx.latestPatch }), tr('insights.buildsAnteriores', { length: stale.length })],
      score: 70, sources: ['builds', 'tierlist'],
    }));
  }
  return cards;
}

function detectFoundationSignals(ctx) {
  const total = ctx.matches.length;
  if (!total) return [];

  const overall = summarize(ctx.matches);
  const recentRows = ctx.matches.slice(0, Math.min(5, total));
  const recent = summarize(recentRows);
  const champions = groupBy(ctx.matches, row => row.champion).sort((a, b) => b.games - a.games);
  const lanes = groupBy(ctx.matches, row => row.lane).sort((a, b) => b.games - a.games);
  const mainChampion = champions[0];
  const mainLane = lanes[0];
  const items = groupBy(ctx.matches, row => row.items).sort((a, b) => b.games - a.games);
  const runes = groupBy(ctx.matches, row => row.runes).sort((a, b) => b.games - a.games);
  const enemies = groupBy(ctx.matches, row => row.enemies).sort((a, b) => b.games - a.games);
  const spellPairs = groupBy(
    ctx.matches,
    row => row.spells.length ? [row.spells.slice().sort().join(' + ')] : []
  ).sort((a, b) => b.games - a.games);
  const sides = groupBy(ctx.matches, row => row.side).filter(side => side.games >= 2);
  const blue = sides.find(side => side.name === 'blue');
  const red = sides.find(side => side.name === 'red');
  const mostUsedItem = items[0];
  const mostUsedRune = runes[0];
  const mostFrequentEnemy = enemies[0];
  const mostUsedSpells = spellPairs[0];
  const laneLabels = { top: tr('insights.baronLane'), jungler: tr('lanes.jungler'), mid: tr('lanes.mid'), dragonline: tr('champion.lane.Dragonlane'), adc: tr('champion.lane.Dragonlane'), support: tr('lanes.support') };
  const mainLaneLabel = laneLabels[mainLane?.name] || mainLane?.name;
  const laneCombatSegments = lanes
    .filter(lane => lane.games >= 4)
    .map(lane => {
      const kills = lane.rows.reduce((sum, row) => sum + row.kills, 0) / lane.games;
      const deaths = lane.rows.reduce((sum, row) => sum + row.deaths, 0) / lane.games;
      const assists = lane.rows.reduce((sum, row) => sum + row.assists, 0) / lane.games;
      const totalDeaths = lane.rows.reduce((sum, row) => sum + row.deaths, 0);
      const totalKillsAndAssists = lane.rows.reduce((sum, row) => sum + row.kills + row.assists, 0);
      return {
        name: laneLabels[lane.name] || lane.name,
        games: lane.games,
        kills,
        deaths,
        assists,
        kda: totalDeaths ? totalKillsAndAssists / totalDeaths : totalKillsAndAssists,
      };
    });

  return [
    makeCard({
      id: 'foundation-overall-performance', domain: tr('insights.rendimientoGeneral'), tone: overall.wr >= 50 ? 'positive' : 'warning',
      title: tr('insights.tuRendimientoGeneralEs', { percent: percent(overall.wr) }),
      thesis: tr('insights.ganasteDeLasPartidas', { wins: overall.wins, total, value: total - overall.wins }),
      action: tr('insights.usaEstePromedioComo'),
      sample: total, evidence: [tr('insights.victorias', { wins: overall.wins }), tr('insights.derrotas', { value: total - overall.wins }), tr('insights.deWinrate', { percent: percent(overall.wr) })],
      score: 18, sources: ['partidas'],
    }),
    mainLane && makeCard({
      id: `foundation-lane-${keyOf(mainLane.name)}`, domain: 'rol', tone: 'neutral',
      title: tr('insights.esTuRolCon', { mainLaneLabel }),
      thesis: tr('insights.jugasteEnQueRepresentan', { games: games(mainLane.games), mainLaneLabel, percent: percent((mainLane.games / total) * 100), percent2: percent(mainLane.wr) }),
      action: tr('insights.comparaCualquierCambioDe', { percent: percent(mainLane.wr), mainLaneLabel }),
      sample: mainLane.games, evidence: [`${games(mainLane.games)}`, tr('insights.deWinrate', { percent: percent(mainLane.wr) }), tr('insights.delHistorial', { percent: percent((mainLane.games / total) * 100) })],
      score: 25, sources: ['partidas'],
    }),
    makeCard({
      id: 'foundation-recent-reference', domain: 'forma', tone: recent.wr >= overall.wr ? 'positive' : 'warning',
      title: tr('insights.tusUltimasPartidasEstan', { games: recent.games, percent: percent(recent.wr) }),
      thesis: tr('insights.elBloqueRecienteRegistra', { percent: percent(recent.wr), percent2: percent(overall.wr) }),
      action: tr('insights.completaOtrasPartidasSin', { games: recent.games }),
      sample: recent.games, evidence: [tr('insights.ultimas2', { games: recent.games, percent: percent(recent.wr) }), tr('insights.general', { percent: percent(overall.wr) })],
      score: 24, sources: ['partidas'],
    }),
    makeCard({
      id: 'foundation-survival', domain: 'supervivencia', tone: overall.avgDeaths <= 5 ? 'positive' : 'warning',
      title: tr('insights.promediasMuertesPorPartida', { value: overall.avgDeaths.toFixed(1) }),
      thesis: tr('insights.laCifraSeCalcula', { games: games(total) }),
      action: tr('insights.comparaEstePromedioCon'),
      sample: total, evidence: [tr('insights.muertes', { value: overall.avgDeaths.toFixed(1) }), `${games(total)}`],
      score: 20, sources: ['partidas'],
    }),
    laneCombatSegments.length > 0 && makeCard({
      id: 'foundation-offensive-profile', domain: tr('insights.produccionOfensiva'), tone: 'neutral',
      title: laneCombatSegments.length === 1
        ? tr('insights.tuPerfilOfensivoEn', { name: laneCombatSegments[0].name })
        : tr('insights.tuPerfilOfensivoCambia'),
      thesis: laneCombatSegments.map(segment => tr('insights.kdaEn', { name: segment.name, value: segment.kills.toFixed(1), value2: segment.deaths.toFixed(1), value3: segment.assists.toFixed(1), value4: segment.kda.toFixed(2), games: games(segment.games) })).join(' '),
      action: tr('insights.comparaCadaLineaPor'),
      sample: laneCombatSegments.reduce((sum, segment) => sum + segment.games, 0),
      evidence: laneCombatSegments.map(segment => tr('insights.kda', { name: segment.name, value: segment.kda.toFixed(2), games: segment.games })),
      score: 19, sources: ['partidas'],
    }),
    blue && red && makeCard({
      id: 'foundation-side-comparison', domain: tr('insights.ladoDelMapa'), tone: 'neutral',
      title: tr('insights.tuRendimientoCambiaSegun'),
      thesis: tr('insights.enLadoAzulTenes', { percent: percent(blue.wr), games: games(blue.games), percent2: percent(red.wr), games2: games(red.games) }),
      action: tr('insights.comparaEnCadaLado'),
      sample: blue.games + red.games, effect: blue.wr - red.wr,
      evidence: [tr('insights.azul', { percent: percent(blue.wr), games: blue.games }), tr('insights.rojo', { percent: percent(red.wr), games: red.games })],
      score: 27, sources: ['partidas'],
    }),
    mostUsedItem && makeCard({
      id: `foundation-item-${keyOf(mostUsedItem.name)}`, domain: tr('insights.objetoFrecuente'), tone: 'neutral',
      title: tr('insights.esTuObjetoMas', { name: mostUsedItem.name }),
      thesis: tr('insights.apareceEnQueRepresentan', { games: games(mostUsedItem.games), percent: percent((mostUsedItem.games / total) * 100), percent2: percent(mostUsedItem.wr) }),
      action: tr('insights.comparaDentroDelMismo', { name: mostUsedItem.name }),
      sample: mostUsedItem.games, evidence: [`${games(mostUsedItem.games)}`, tr('insights.deWinrate', { percent: percent(mostUsedItem.wr) })],
      entities: [mostUsedItem.name], score: 23, sources: ['partidas', 'objetos'],
    }),
    mostUsedRune && makeCard({
      id: `foundation-rune-${keyOf(mostUsedRune.name)}`, domain: tr('insights.runaFrecuente'), tone: 'neutral',
      title: tr('insights.esTuRunaMas', { name: mostUsedRune.name }),
      thesis: tr('insights.laUsasteEnY', { games: games(mostUsedRune.games), percent: percent(mostUsedRune.wr) }),
      action: tr('insights.manteneFijaDuranteUn', { name: mostUsedRune.name }),
      sample: mostUsedRune.games, evidence: [`${games(mostUsedRune.games)}`, tr('insights.deWinrate', { percent: percent(mostUsedRune.wr) })],
      entities: [mostUsedRune.name], score: 22, sources: ['partidas', 'runas'],
    }),
    mostFrequentEnemy && makeCard({
      id: `foundation-enemy-${keyOf(mostFrequentEnemy.name)}`, domain: tr('insights.rivalFrecuente'), tone: mostFrequentEnemy.wr >= overall.wr ? 'positive' : 'warning',
      title: tr('insights.esElRivalQue', { name: mostFrequentEnemy.name }),
      thesis: tr('insights.estuvoPresenteEnDel', { games: games(mostFrequentEnemy.games), percent: percent(mostFrequentEnemy.wr), percent2: percent(overall.wr) }),
      action: tr('insights.separaLasPartidasDonde', { name: mostFrequentEnemy.name }),
      sample: mostFrequentEnemy.games, evidence: [`${games(mostFrequentEnemy.games)}`, tr('insights.deWinrate', { percent: percent(mostFrequentEnemy.wr) })],
      entities: [mostFrequentEnemy.name], score: 21, sources: ['partidas', 'composiciones'],
    }),
    mostUsedSpells && makeCard({
      id: `foundation-spells-${keyOf(mostUsedSpells.name)}`, domain: tr('insights.hechizosFrecuentes'), tone: 'neutral',
      title: tr('insights.esTuCombinacionDe', { name: mostUsedSpells.name }),
      thesis: tr('insights.laCombinacionApareceEn', { games: games(mostUsedSpells.games), percent: percent(mostUsedSpells.wr) }),
      action: tr('insights.identificaEnQueMatchups'),
      sample: mostUsedSpells.games, evidence: [`${games(mostUsedSpells.games)}`, tr('insights.deWinrate', { percent: percent(mostUsedSpells.wr) })],
      score: 20, sources: ['partidas', 'hechizos'],
    }),
    mainChampion && makeCard({
      id: `foundation-champion-${keyOf(mainChampion.name)}`, domain: 'pool', tone: mainChampion.wr >= overall.wr ? 'positive' : 'warning',
      title: tr('insights.esTuCampeonMas3', { name: mainChampion.name }),
      thesis: tr('insights.acumulaEquivalentesAlDe', { games: games(mainChampion.games), percent: percent((mainChampion.games / total) * 100), percent2: percent(mainChampion.wr), percent3: percent(overall.wr) }),
      action: tr('insights.tomaElDeComo', { percent: percent(mainChampion.wr), name: mainChampion.name }),
      sample: mainChampion.games, evidence: [`${games(mainChampion.games)}`, tr('insights.deWinrate', { percent: percent(mainChampion.wr) })],
      entities: [mainChampion.name], score: 21, sources: ['partidas'],
    }),
  ].filter(Boolean);
}

function selectEditorially(candidates, limit) {
  const sorted = candidates.sort((a, b) => b.score - a.score);
  const selected = [];
  const domainCount = new Map();
  const entityCount = new Map();
  for (const card of sorted) {
    if ((domainCount.get(card.domain) || 0) >= 1) continue;
    if (card.entities.some(entity => (entityCount.get(entity) || 0) >= 3)) continue;
    selected.push(card);
    domainCount.set(card.domain, (domainCount.get(card.domain) || 0) + 1);
    card.entities.forEach(entity => entityCount.set(entity, (entityCount.get(entity) || 0) + 1));
    if (selected.length >= limit) break;
  }

  const floorTarget = Math.min(3, limit);
  if (selected.length < floorTarget) {
    const selectedIds = new Set(selected.map(card => card.id));
    const unusedFoundations = sorted
      .filter(card => card.id.startsWith('foundation-') && !selectedIds.has(card.id))
      .sort((a, b) => b.score - a.score);
    for (const card of unusedFoundations) {
      selected.push(card);
      selectedIds.add(card.id);
      if (selected.length >= floorTarget) break;
    }
  }
  return selected;
}

/**
 * Produces a structured coaching report from every dataset currently available.
 * Missing datasets are safe: future recommended_items, good_against and
 * avoid_against fields are picked up as soon as they are populated.
 */
export function computeInsightReport({
  matches = [], tierlist = [], wrItems = [], builds = [], champions = [], runes = [], spells = [], limit = 6,
  minimum = 6,
} = {}) {
  const normalizedMatches = matches.map(normalizeMatch).sort((a, b) => b.timestamp - a.timestamp);
  if (!normalizedMatches.length) return { insights: [], coverage: {}, generatedAt: new Date().toISOString() };

  const latestTierEntry = [...(tierlist || [])].sort((a, b) => snapshotTime(b) - snapshotTime(a))[0];
  const latestSnapshotKey = latestTierEntry ? snapshotKeyOf(latestTierEntry) : '';
  const latestPatch = clean(latestTierEntry?.patch);
  const latestTierlist = latestSnapshotKey
    ? tierlist.filter(entry => snapshotKeyOf(entry) === latestSnapshotKey)
    : tierlist;
  const tierByChampion = latestTierMap(latestTierlist);
  const ctx = {
    matches: normalizedMatches,
    builds: builds || [],
    championCatalog: catalogMap(champions),
    itemCatalog: catalogMap(wrItems),
    runeCatalog: catalogMap(runes),
    spellCatalog: catalogMap(spells),
    tierlist: tierlist || [],
    tierByChampion,
    latestPatch: clean(latestPatch),
  };

  const candidates = [
    ...detectRecentForm(ctx),
    ...detectCloseGamePattern(ctx),
    ...detectLossFingerprint(ctx),
    ...detectChampionIdentity(ctx),
    ...detectPoolShape(ctx),
    ...detectRecommendedItemFit(ctx),
    ...detectChoiceLeverage(ctx, 'item'),
    ...detectChoiceLeverage(ctx, 'rune'),
    ...detectChoiceLeverage(ctx, 'spell'),
    ...detectMatchup(ctx),
    ...detectAllySynergy(ctx),
    ...detectMetaMovement(ctx),
    ...detectSavedBuilds(ctx),
    ...detectFoundationSignals(ctx),
  ];

  if (!candidates.length) {
    candidates.push(makeCard({
      id: 'learning-mode', domain: 'calidad', tone: 'neutral', title: tr('insights.todaviaNoHayUn'),
      thesis: tr('insights.elCoachAnalizoPero', { games: games(normalizedMatches.length) }),
      action: tr('insights.enLasProximasPartidas3'),
      sample: normalizedMatches.length, evidence: [`${games(normalizedMatches.length)}`, tr('insights.sinPatronRobusto')], score: 50,
      sources: ['partidas'],
    }));
  }

  const targetLimit = Math.max(1, Number(limit) || 6, Number(minimum) || 0);
  const insights = selectEditorially(candidates, targetLimit);
  return {
    insights,
    coverage: {
      matches: normalizedMatches.length,
      builds: builds.length,
      champions: champions.length,
      items: wrItems.length,
      runes: runes.length,
      spells: spells.length,
      tierEntries: tierlist.length,
    },
    generatedAt: new Date().toISOString(),
  };
}

// Kept as the public entry point used by the app. Consumers now receive cards.
export function computeInsights(input) {
  return computeInsightReport(input).insights;
}
