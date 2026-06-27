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
function games(value) { return `${value} ${value === 1 ? 'partida' : 'partidas'}`; }

function confidence(sample, effect = 0, corroboration = 0) {
  const volume = Math.min(1, Math.sqrt(sample / 12));
  const strength = Math.min(1, Math.abs(effect) / 25);
  return Math.max(0.12, Math.min(0.98, volume * 0.65 + strength * 0.25 + corroboration * 0.1));
}

function confidenceLabel(value) {
  if (value >= 0.76) return 'Confianza alta';
  if (value >= 0.48) return 'Confianza media';
  return 'Señal inicial';
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
    reading = `En tus últimas ${window} partidas tu winrate fue de ${percent(recent.wr)}, frente al ${percent(previous.wr)} del bloque anterior. En el mismo período, tus muertes promedio subieron de ${previous.avgDeaths.toFixed(1)} a ${recent.avgDeaths.toFixed(1)} por partida. La coincidencia no demuestra una causa, pero señala la supervivencia como la primera variable que conviene revisar.`;
    action = 'Durante las próximas 5 partidas, registrá el minuto y el motivo de tu primera muerte —pelea, emboscada, objetivo o sobreextensión— para comprobar qué situación está generando la diferencia.';
  } else if (deathDelta <= -1.25) {
    reading = `En tus últimas ${window} partidas tu winrate fue de ${percent(recent.wr)}, frente al ${percent(previous.wr)} del bloque anterior. Al mismo tiempo, tus muertes promedio bajaron de ${previous.avgDeaths.toFixed(1)} a ${recent.avgDeaths.toFixed(1)} por partida. Ambos cambios avanzan juntos, por lo que tu mayor estabilidad es una explicación concreta que vale la pena validar.`;
    action = 'Mantené el mismo pool y evitá cambiar la build principal durante 5 partidas; así vas a poder comprobar si el menor número de muertes sigue acompañando el resultado.';
  } else {
    reading = `En tus últimas ${window} partidas tu winrate fue de ${percent(recent.wr)}, frente al ${percent(previous.wr)} del bloque anterior. Sin embargo, tus muertes promedio casi no cambiaron: pasaron de ${previous.avgDeaths.toFixed(1)} a ${recent.avgDeaths.toFixed(1)} por partida. Por eso, esta variación no se explica bien por supervivencia y conviene buscarla en el draft, las builds o el cierre de las partidas.`;
    action = improving
      ? 'Repetí durante 5 partidas la combinación de campeón y build más usada en el tramo reciente para aislar si esa decisión está sosteniendo la mejora.'
      : 'Compará las 5 derrotas más recientes por campeón, build y tag; descartá las muertes como explicación principal y buscá qué decisión sí se repite.';
  }

  return [makeCard({
    id: 'recent-form', domain: 'forma', tone: improving ? 'positive' : 'warning',
    title: improving ? 'Tu rendimiento reciente mejoró' : 'Tu rendimiento reciente bajó',
    thesis: reading, action, sample: recent.games + previous.games, effect: delta,
    evidence: [`Últimas ${window}: ${percent(recent.wr)}`, `Anteriores: ${percent(previous.wr)}`, `${recent.avgDeaths.toFixed(1)} muertes por partida`],
    score: 90, sources: ['partidas'],
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
    ? `El tag “${tags.name}” aparece en ${tags.games} de tus ${losses.length} derrotas registradas${deathGap >= 1.2 ? `. Además, promediás ${lossStats.avgDeaths.toFixed(1)} muertes en las derrotas y ${winStats.avgDeaths.toFixed(1)} en las victorias` : ''}. El tag no explica por sí solo la derrota, pero identifica un grupo concreto de partidas que comparte el mismo contexto.`
    : `En tus victorias promediás ${winStats.avgDeaths.toFixed(1)} muertes por partida; en tus derrotas, ${lossStats.avgDeaths.toFixed(1)}. La diferencia se repite en una muestra suficiente como para tratar las muertes como una señal de riesgo, no como una prueba de causalidad.`;
  return [makeCard({
    id: `loss-fingerprint-${keyOf(tags?.name || 'deaths')}`, domain: 'diagnóstico', tone: 'critical',
    title: tags ? `Patrón de derrota: ${tags.name}` : 'Las muertes separan victorias y derrotas', thesis: hook,
    action: tags
      ? `Revisá las 3 derrotas más recientes con “${tags.name}” y anotá qué evento concreto se repite antes de que la partida se descontrole.`
      : 'Durante las próximas 5 partidas, fijá como objetivo llegar al juego medio con 2 muertes menos y compará si cambia el resultado.',
    sample: losses.length, effect: deathGap * 8, evidence: [
      `Derrotas: ${lossStats.avgDeaths.toFixed(1)} muertes`,
      `Victorias: ${winStats.avgDeaths.toFixed(1)} muertes`,
      tags && `${tags.games}/${losses.length} con “${tags.name}”`,
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
      title: under ? `${main.name} es tu pick principal, pero rinde por debajo de tu promedio` : `${main.name} combina volumen y buen rendimiento`,
      thesis: under
        ? `${main.name} es tu campeón más usado, con ${games(main.games)} y ${percent(main.wr)} de winrate. Tu promedio general es ${percent(overall.wr)}, de modo que el pick al que más volumen dedicás está aportando menos resultados que el resto de tu historial.`
        : `${main.name} es tu campeón más usado, con ${games(main.games)} y ${percent(main.wr)} de winrate, mientras que tu promedio general es ${percent(overall.wr)}.${mainTier?.tier ? ` La tierlist actual también lo ubica en tier ${mainTier.tier}, por lo que tu rendimiento personal y el estado del meta apuntan en la misma dirección.` : ' El volumen y el resultado personal apuntan en la misma dirección.'}`,
      action: under
        ? `Jugá 5 partidas con una única build y registrá los matchups; si el winrate continúa debajo de tu promedio, reducí su prioridad en ranked.`
        : `Mantenelo como pick principal y elegí un segundo campeón específicamente para cubrir los matchups en los que no querés seleccionarlo.`,
      sample: main.games, effect: mainDelta, evidence: [
        `${games(main.games)} · ${percent(main.wr)}`,
        `Tu base: ${percent(overall.wr)}`,
        mainTier?.tier && `Meta: tier ${mainTier.tier}`,
      ], entities: [main.name], score: 84, sources: ['partidas', mainTier ? 'tierlist' : null],
    }));
  }

  const pocket = champs.filter(champ => champ.games >= 4 && champ.wr >= overall.wr + 14)
    .sort((a, b) => (b.wr - overall.wr) - (a.wr - overall.wr))[0];
  if (pocket && keyOf(pocket.name) !== keyOf(main.name)) {
    const tier = tierByChampion.get(keyOf(pocket.name));
    cards.push(makeCard({
      id: `identity-pocket-${keyOf(pocket.name)}`, domain: 'pool', tone: 'opportunity',
      title: `${pocket.name} muestra potencial para ganar espacio en tu pool`,
      thesis: `Con ${pocket.name} registrás ${percent(pocket.wr)} de winrate en ${games(pocket.games)}, frente a tu ${percent(overall.wr)} general.${tier?.tier ? ` Actualmente aparece en tier ${tier.tier}.` : ''} La muestra todavía es menor que la de tu pick principal, así que el dato justifica una prueba más amplia, no una promoción automática.`,
      action: `Jugalo 5 veces más manteniendo una build estable; si continúa por encima de tu promedio, incorporalo como segundo pick.`,
      sample: pocket.games, effect: pocket.wr - overall.wr,
      evidence: [`${games(pocket.games)} · ${percent(pocket.wr)}`, `Promedio general: ${percent(overall.wr)}`, tier?.tier && `Meta: ${tier.tier}`],
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
  if (topShare < 0.72 && laneCount <= 2) return [];
  const scattered = topShare < 0.72;
  const coreNames = champs.slice(0, 3).map(champ => champ.name);
  return [makeCard({
    id: 'pool-shape', domain: 'pool', tone: scattered ? 'warning' : 'neutral',
    title: scattered
      ? 'Tu pool está repartido entre demasiados campeones'
      : `Tu pool está concentrado en ${coreNames.length} ${coreNames.length === 1 ? 'campeón' : 'campeones'}`,
    thesis: scattered
      ? `Usaste ${champs.length} campeones en ${games(matches.length)}, y tus 3 picks más frecuentes sólo reúnen el ${percent(topShare * 100)} de la muestra. Esa dispersión reduce la cantidad de repeticiones comparables para cada campeón y hace más difícil separar aprendizaje de variación.`
      : `${coreNames.join(', ')} ${coreNames.length === 1 ? 'concentra' : 'concentran'} el ${percent(topShare * 100)} de tus ${games(matches.length)}.${damageTypes.length === 1 ? ` Además, ${coreNames.length === 1 ? 'usa' : 'comparten'} daño ${damageTypes[0]}, por lo que el núcleo puede ofrecer respuestas similares frente al draft rival.` : ' La concentración favorece la práctica, pero también vuelve importante que el resto del pool cubra situaciones diferentes.'}`,
    action: scattered
      ? 'Limitá las próximas 10 partidas a 3 campeones: uno principal, uno para cubrir su peor matchup y uno que aporte un tipo de daño o función diferente.'
      : `Antes de sumar otro pick similar, elegí un campeón que aporte otro tipo de daño o que responda al peor matchup de ${champs[0]?.name}.`,
    sample: matches.length, effect: (topShare - 0.6) * 100,
    evidence: [`Top 3: ${percent(topShare * 100)}`, `${champs.length} picks usados`, `${laneCount} roles jugados`],
    score: 67, sources: ['partidas', championCatalog.size ? 'campeones' : null],
  })];
}

function detectChoiceLeverage(ctx, type) {
  const config = {
    item: { values: row => row.items, label: 'objeto', domain: 'build', min: 4 },
    rune: { values: row => row.runes, label: 'runa', domain: 'runas', min: 4 },
    spell: { values: row => row.spells.length === 2 ? [row.spells.slice().sort().join(' + ')] : [], label: 'dupla de hechizos', domain: 'hechizos', min: 4 },
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
  const recommended = relationNames(championData, [
    'recommended_items', 'recommendedItems', 'core_items', 'coreItems', 'suggested_items',
  ]).some(name => keyOf(name) === keyOf(best.right));
  const goodAgainst = relationNames(itemData, ['good_against', 'goodAgainst', 'strong_against', 'recommended_against']);
  const avoidAgainst = relationNames(itemData, ['avoid_against', 'avoidAgainst', 'weak_against', 'bad_against']);
  const encountered = unique(best.rows.flatMap(row => row.enemies));
  const corroboratedGood = goodAgainst.find(name => encountered.some(enemy => keyOf(enemy) === keyOf(name)));
  const corroboratedBad = avoidAgainst.find(name => encountered.some(enemy => keyOf(enemy) === keyOf(name)));
  const context = corroboratedGood
    ? ` El catálogo también lo recomienda contra ${corroboratedGood}.`
    : corroboratedBad ? ` El catálogo lo desaconseja contra ${corroboratedBad}; separá ese matchup antes de concluir.`
      : recommended ? ` También figura entre los objetos recomendados de ${best.left}.` : '';

  return [makeCard({
    id: `${type}-${keyOf(best.left)}-${keyOf(best.right)}`, domain: config.domain,
    tone: positive ? 'opportunity' : 'critical',
    title: `${best.right} está asociado a un cambio importante con ${best.left}`,
    thesis: `Con ${best.left}, registrás ${percent(best.wr)} de winrate en ${games(best.games)} usando ${best.right}, frente a ${percent(best.baseline.wr)} en ${games(best.baseline.games)} sin esa elección. La comparación muestra una asociación, pero no demuestra que ${best.right} sea la causa: los matchups y el resto de la build también pueden ser distintos.${context}`,
    action: positive
      ? `Repetí ${best.right} en 5 partidas con matchups similares y registrá el motivo de la elección; así vas a comprobar si la ventaja se mantiene bajo un contexto comparable.`
      : `Quitá ${best.right} de tu opción predeterminada durante 5 partidas y volvé a usarlo únicamente cuando puedas identificar qué problema específico del draft resuelve.`,
    sample: best.games + best.baseline.games, effect: best.delta,
    corroboration: corroboratedGood || corroboratedBad || recommended ? 1 : 0,
    evidence: [`Con: ${percent(best.wr)} (${best.games})`, `Sin: ${percent(best.baseline.wr)} (${best.baseline.games})`, corroboratedGood ? `Buena vs ${corroboratedGood}` : recommended && 'Recomendado para el campeón'],
    entities: [best.left, best.right], score: type === 'item' ? 82 : 72,
    sources: ['partidas', type === 'item' && itemData ? 'objetos' : type === 'rune' ? 'runas' : 'hechizos', recommended ? 'campeones' : null],
  })];
}

function detectAllySynergy(ctx) {
  const pairs = pairedGroups(ctx.matches, row => row.champion, row => row.allies)
    .filter(pair => pair.games >= 3)
    .map(pair => {
      const baseline = summarize(ctx.matches.filter(row => keyOf(row.champion) === keyOf(pair.left)));
      return { ...pair, baseline, delta: pair.wr - baseline.wr };
    })
    .filter(pair => Math.abs(pair.delta) >= 20)
    .sort((a, b) => Math.abs(b.delta) * b.games - Math.abs(a.delta) * a.games);
  const pair = pairs[0];
  if (!pair) return [];
  return [makeCard({
    id: `synergy-${pair.id}`, domain: 'draft', tone: pair.delta > 0 ? 'opportunity' : 'warning',
    title: `${pair.right} cambia tus resultados cuando jugás ${pair.left}`,
    thesis: `Cuando ${pair.right} aparece como aliado, tu winrate con ${pair.left} es ${percent(pair.wr)} en ${games(pair.games)}. Tu promedio general con ${pair.left} es ${percent(pair.baseline.wr)}. La diferencia puede estar en la interacción entre ambos campeones o en el tipo de composición en la que suelen aparecer, por lo que todavía necesita una validación más específica.`,
    action: pair.delta > 0
      ? `Cuando vuelvas a jugar la dupla, registrá qué aporta ${pair.right} —iniciación, daño, control o protección— y cuál de esos recursos falta cuando jugás sin él.`
      : 'Revisá las composiciones de esas partidas y determiná si a la dupla le falta iniciación, primera línea, protección o variedad de daño antes de evitarla por completo.',
    sample: pair.games, effect: pair.delta,
    evidence: [`Juntos: ${percent(pair.wr)} (${pair.games})`, `${pair.left}: ${percent(pair.baseline.wr)}`],
    entities: [pair.left, pair.right], score: 74, sources: ['partidas', 'composiciones'],
  })];
}

function patchParts(value) {
  return clean(value).split(/[^0-9]+/).filter(Boolean).map(Number);
}

function comparePatch(a, b) {
  const left = patchParts(a);
  const right = patchParts(b);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff) return diff;
  }
  return clean(a).localeCompare(clean(b));
}

function detectMetaMovement(ctx) {
  const played = groupBy(ctx.matches, row => row.champion).filter(champ => champ.games >= 3);
  const movements = played.flatMap(champ => {
    const entries = ctx.tierlist
      .filter(entry => keyOf(entry.champion_name) === keyOf(champ.name))
      .sort((a, b) => comparePatch(b.patch, a.patch));
    const latest = entries[0];
    const previous = entries.find(entry => clean(entry.patch) !== clean(latest?.patch));
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
    title: `${move.champ.name} cambió de posición en la tierlist reciente`,
    thesis: `${move.champ.name} pasó de tier ${move.previous.tier || 'sin clasificación'} en el parche ${move.previous.patch} a tier ${move.latest.tier || 'sin clasificación'} en ${move.latest.patch}. En tu historial tiene ${percent(move.champ.wr)} de winrate en ${games(move.champ.games)}, frente a tu ${percent(summarize(ctx.matches).wr)} general. La tierlist describe el meta; tu muestra personal indica si ese cambio también es relevante para vos.`,
    action: agrees
      ? `Priorizá ${move.champ.name} durante las próximas 5 partidas manteniendo la misma build para validar la coincidencia entre meta y rendimiento personal.`
      : 'No cambies todavía su lugar en tu pool: probá una build estable y registrá al menos dos matchups antes de tomar la decisión.',
    sample: move.champ.games, effect: move.rankDelta,
    evidence: [`${move.previous.patch}: ${move.previous.tier}`, `${move.latest.patch}: ${move.latest.tier}`, `Personal: ${percent(move.champ.wr)}`],
    entities: [move.champ.name], score: 76, sources: ['partidas', 'tierlists'],
  })];
}

function detectMatchup(ctx) {
  const pairs = pairedGroups(ctx.matches, row => row.champion, row => row.enemies)
    .filter(pair => pair.games >= 3)
    .map(pair => {
      const championRows = ctx.matches.filter(row => keyOf(row.champion) === keyOf(pair.left));
      return { ...pair, baseline: summarize(championRows), delta: pair.wr - summarize(championRows).wr };
    })
    .filter(pair => Math.abs(pair.delta) >= 18)
    .sort((a, b) => Math.abs(b.delta) * b.games - Math.abs(a.delta) * a.games);
  const pair = pairs[0];
  if (!pair) return [];
  const champion = ctx.championCatalog.get(keyOf(pair.left));
  const good = relationNames(champion, ['good_against', 'goodAgainst', 'strong_against', 'counters']);
  const avoid = relationNames(champion, ['avoid_against', 'avoidAgainst', 'weak_against', 'countered_by']);
  const catalogGood = good.some(name => keyOf(name) === keyOf(pair.right));
  const catalogBad = avoid.some(name => keyOf(name) === keyOf(pair.right));
  const conflict = (pair.delta > 0 && catalogBad) || (pair.delta < 0 && catalogGood);
  const corroborates = (pair.delta > 0 && catalogGood) || (pair.delta < 0 && catalogBad);
  return [makeCard({
    id: `matchup-${pair.id}`, domain: 'draft', tone: pair.delta > 0 ? 'positive' : 'critical',
    title: `${pair.right} modifica el rendimiento de tus partidas con ${pair.left}`,
    thesis: `Cuando ${pair.right} aparece en el equipo enemigo, tu winrate con ${pair.left} es ${percent(pair.wr)} en ${games(pair.games)}; tu promedio general con ${pair.left} es ${percent(pair.baseline.wr)}. Este cálculo incluye tanto al rival directo como al resto de la composición enemiga, por lo que no debe leerse automáticamente como un counter de línea.${conflict ? ' Además, el resultado contradice la referencia del catálogo y requiere más partidas antes de sacar una conclusión.' : corroborates ? ' El catálogo y tus resultados personales señalan la misma dirección, lo que refuerza la señal sin convertirla en una certeza.' : ''}`,
    action: pair.delta > 0
      ? `En las próximas partidas, separá cuándo ${pair.right} es tu rival directo y cuándo sólo forma parte del equipo enemigo; compará ambos grupos antes de usarlo como respuesta de draft.`
      : `En tus próximas partidas contra ${pair.right}, compará la runa principal, el primer objeto y las muertes antes del minuto 10 para identificar dónde comienza la desventaja.`,
    sample: pair.games, effect: pair.delta, corroboration: corroborates ? 1 : 0,
    evidence: [`Cruce: ${percent(pair.wr)} (${pair.games})`, `Promedio de ${pair.left}: ${percent(pair.baseline.wr)}`, corroborates && 'Catálogo: coincide'],
    entities: [pair.left, pair.right], score: 83, sources: ['partidas', champion ? 'campeones' : null],
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
      title: `La build “${entry.build.name || entry.build.champion_name}” ya tiene una muestra medible`,
      thesis: entry.inferred
        ? `La build aparece asociada a ${games(entry.games)} con ${percent(entry.wr)} de winrate. Como esas partidas no tenían una build vinculada, la relación se estimó por una coincidencia mínima del 66% de sus objetos; el dato es orientativo y puede mezclar variantes diferentes.`
        : `La build está vinculada directamente a ${games(entry.games)} y registra ${percent(entry.wr)} de winrate. La asociación es precisa, aunque la muestra todavía debe leerse junto con los campeones rivales y el parche en que se jugó.`,
      action: entry.wr >= 55
        ? 'Conservá sus objetos principales y creá una única variante para un matchup concreto; evitá cambiar varias piezas a la vez porque impediría comparar resultados.'
        : 'Compará sus primeros 3 objetos con los de tus victorias usando el mismo campeón y modificá una sola pieza durante las próximas 5 partidas.',
      sample: entry.games, effect: entry.wr - summarize(ctx.matches).wr,
      evidence: [`${entry.build.champion_name}`, `${percent(entry.wr)} de winrate`, entry.inferred ? 'Vínculo estimado' : 'Vínculo directo'],
      entities: [entry.build.champion_name, entry.build.name], score: 79, sources: ['partidas', 'builds'],
    }));
  } else if (unused.length >= 2) {
    cards.push(makeCard({
      id: 'unused-builds', domain: 'build', tone: 'neutral', title: 'Tus builds guardadas todavía no tienen evidencia de uso',
      thesis: `${unused.length} de tus ${ctx.builds.length} builds guardadas no tienen partidas vinculadas ni una coincidencia suficiente de objetos. Por ese motivo, el Coach puede leer su contenido, pero todavía no puede comparar su rendimiento real.`,
      action: 'Elegí una build, vinculala explícitamente al registrar la partida y usala al menos 3 veces antes de crear otra variante.',
      sample: ctx.builds.length, evidence: [`${unused.length} sin uso medible`, `${ctx.builds.length} guardadas`],
      score: 60, sources: ['builds', 'partidas'],
    }));
  }
  if (stale.length >= 2) {
    cards.push(makeCard({
      id: 'stale-builds', domain: 'meta', tone: 'warning', title: 'Parte de tus builds pertenece a un parche anterior',
      thesis: `${stale.length} builds fueron guardadas en un parche diferente del ${ctx.latestPatch}, que es el parche más reciente disponible en la tierlist. Esto no significa que sean inválidas, pero sí que sus objetos y runas deben volver a comprobarse antes de tratarlas como opciones actuales.`,
      action: 'Revisá primero las builds de tus 2 campeones más usados y actualizá únicamente las piezas afectadas por el parche.',
      sample: stale.length, evidence: [`Parche actual: ${ctx.latestPatch}`, `${stale.length} builds anteriores`],
      score: 70, sources: ['builds', 'tierlist'],
    }));
  }
  return cards;
}

function selectEditorially(candidates, limit) {
  const sorted = candidates.sort((a, b) => b.score - a.score);
  const selected = [];
  const domainCount = new Map();
  const entityCount = new Map();
  for (const card of sorted) {
    if ((domainCount.get(card.domain) || 0) >= 1) continue;
    if (card.entities.some(entity => (entityCount.get(entity) || 0) >= 2)) continue;
    selected.push(card);
    domainCount.set(card.domain, (domainCount.get(card.domain) || 0) + 1);
    card.entities.forEach(entity => entityCount.set(entity, (entityCount.get(entity) || 0) + 1));
    if (selected.length >= limit) break;
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
} = {}) {
  const normalizedMatches = matches.map(normalizeMatch).sort((a, b) => b.timestamp - a.timestamp);
  if (!normalizedMatches.length) return { insights: [], coverage: {}, generatedAt: new Date().toISOString() };

  const patches = [...new Set((tierlist || []).map(row => clean(row.patch)).filter(Boolean))];
  const latestPatch = patches.sort(comparePatch).at(-1) || '';
  const latestTierlist = latestPatch
    ? tierlist.filter(entry => clean(entry.patch) === clean(latestPatch))
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
    ...detectLossFingerprint(ctx),
    ...detectChampionIdentity(ctx),
    ...detectPoolShape(ctx),
    ...detectChoiceLeverage(ctx, 'item'),
    ...detectChoiceLeverage(ctx, 'rune'),
    ...detectChoiceLeverage(ctx, 'spell'),
    ...detectMatchup(ctx),
    ...detectAllySynergy(ctx),
    ...detectMetaMovement(ctx),
    ...detectSavedBuilds(ctx),
  ];

  if (!candidates.length) {
    candidates.push(makeCard({
      id: 'learning-mode', domain: 'calidad', tone: 'neutral', title: 'Todavía no hay un patrón suficientemente consistente',
      thesis: `El Coach analizó ${games(normalizedMatches.length)}, pero no encontró una diferencia que combine suficiente tamaño de muestra y contraste entre decisiones. En lugar de convertir una variación pequeña en una recomendación, mantiene el resultado abierto hasta contar con más contexto.`,
      action: 'En las próximas partidas completá build, runas, hechizos, matchup y tags; esos datos permiten comparar decisiones similares bajo contextos equivalentes.',
      sample: normalizedMatches.length, evidence: [`${games(normalizedMatches.length)}`, 'Sin patrón robusto'], score: 50,
      sources: ['partidas'],
    }));
  }

  const insights = selectEditorially(candidates, Math.max(1, limit));
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
