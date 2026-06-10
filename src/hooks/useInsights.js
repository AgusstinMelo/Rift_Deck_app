// Shared insights logic used by both Stats and Dashboard pages

function calcwinrate(matches) {
  const wins = matches.filter(m => m.result === 'win').length;
  return matches.length > 0 ? (wins / matches.length) * 100 : 0;
}

export function computeInsights({ matches, tierlist, wrItems }) {
  if (!matches || matches.length === 0) return [];

  const normalizeVal = (value) => String(value || '').trim().toLowerCase();

  const normalizeLaneVal = (lane) => {
    const raw = normalizeVal(lane).replace(/\s+/g, '');
    const aliases = {
      adc: 'dragonline',
      bot: 'dragonline',
      bottom: 'dragonline',
      dragonlane: 'dragonline',
      dragonline: 'dragonline',
      duo: 'dragonline',
      mid: 'mid',
      middle: 'mid',
      top: 'top',
      baron: 'top',
      baronlane: 'top',
      support: 'support',
      supp: 'support',
      jungler: 'jungler',
      jungle: 'jungler',
    };
    return aliases[raw] || raw;
  };

  const formatLane = (lane) => {
    const normalized = normalizeLaneVal(lane);
    const labels = {
      dragonline: 'DragonLine',
      mid: 'Mid',
      top: 'Top',
      support: 'Support',
      jungler: 'Jungler',
    };
    return labels[normalized] || lane || 'sin línea';
  };

  const displayName = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value.trim() || null;
    if (typeof value === 'object') {
      return (
        value.name ||
        value.champion_name ||
        value.item_name ||
        value.rune_name ||
        value.label ||
        value.title ||
        value.value ||
        null
      );
    }
    return String(value).trim() || null;
  };

  const normalizeList = (rawList) => {
    if (!rawList) return [];

    if (typeof rawList === 'string') {
      const trimmed = rawList.trim();
      if (!trimmed) return [];

      try {
        return normalizeList(JSON.parse(trimmed));
      } catch {
        return trimmed
          .split(/[,|;>\n]+/)
          .map(item => item.trim())
          .filter(Boolean);
      }
    }

    if (Array.isArray(rawList)) {
      return rawList
        .map(displayName)
        .filter(Boolean);
    }

    if (typeof rawList === 'object') {
      if (Array.isArray(rawList.items)) return normalizeList(rawList.items);
      if (Array.isArray(rawList.runes)) return normalizeList(rawList.runes);
      if (Array.isArray(rawList.champions)) return normalizeList(rawList.champions);
      if (Array.isArray(rawList.enemy_champions)) return normalizeList(rawList.enemy_champions);
      if (Array.isArray(rawList.ally_champions)) return normalizeList(rawList.ally_champions);

      const singleValue = displayName(rawList);
      return singleValue ? [singleValue] : [];
    }

    return [];
  };

  const uniqueByName = (list) => {
    const seen = new Set();
    const result = [];

    list.forEach(item => {
      const name = displayName(item);
      const key = normalizeVal(name);
      if (!name || seen.has(key)) return;
      seen.add(key);
      result.push(name);
    });

    return result;
  };

  const normalizeChampionName = (champion) => displayName(champion);

  const normalizeChampionList = (rawList) => {
    return uniqueByName(normalizeList(rawList).map(normalizeChampionName));
  };

  const getOwnChampion = (m) => normalizeChampionName(m.own_champion_name || m.champion_name || m.champion);

  const getDirectEnemyChampion = (m) => normalizeChampionName(m.enemy_champion_name || m.enemy_champion);

  const getAllyChampions = (m) => {
    const ownChampion = normalizeVal(getOwnChampion(m));
    return normalizeChampionList(m.ally_champions || m.allies || m.ally_team)
      .filter(champ => normalizeVal(champ) !== ownChampion);
  };

  const getEnemyTeamChampions = (m) => {
    const enemyTeam = normalizeChampionList(m.enemy_champions || m.enemies || m.enemy_team);
    const directEnemy = getDirectEnemyChampion(m);
    const ownChampion = normalizeVal(getOwnChampion(m));

    return uniqueByName([...enemyTeam, directEnemy].filter(Boolean))
      .filter(champ => normalizeVal(champ) !== ownChampion);
  };

  const improvedItemNameByNorm = new Map(
    (wrItems || [])
      .filter(i => i.category === 'Mejorado')
      .map(i => [normalizeVal(i.name), i.name])
  );

  const normalizeBuildItems = (m) => {
    const rawItems =
      m.items_used ||
      m.build_items ||
      m.items ||
      m.item_names ||
      m.build ||
      m.build_used ||
      [];

    const parsedItems = uniqueByName(normalizeList(rawItems));

    return parsedItems
      .map(item => improvedItemNameByNorm.get(normalizeVal(item)) || item)
      .filter(item => {
        if (improvedItemNameByNorm.size === 0) return true;
        return improvedItemNameByNorm.has(normalizeVal(item));
      });
  };

  const normalizeRunes = (m) => {
    const runeSources = [
      m.runes_used,
      m.runes,
      m.rune_names,
      m.selected_runes,
      m.build_runes,
      m.rune_build,
      m.keystone,
      m.rune_keystone,
      m.main_rune,
      m.primary_rune,
      m.secondary_runes,
    ];

    return uniqueByName(runeSources.flatMap(normalizeList));
  };

  const getKeystoneRune = (m) => {
    const direct =
      displayName(m.keystone) ||
      displayName(m.rune_keystone) ||
      displayName(m.main_rune) ||
      displayName(m.primary_rune);

    if (direct) return direct;

    // No usar runes[0] como fallback — si no hay keystone explícito, no inferir.
    return null;
  };

  const formatPct = (value) => `${Number(value || 0).toFixed(0)}%`;

  const gamesLabel = (games) => `${games} ${games === 1 ? 'partida' : 'partidas'}`;

  const getMatchTimestamp = (match) => {
    const cleanDate = match?.date ? String(match.date).slice(0, 10) : null;
    const cleanHour = match?.hour ? String(match.hour).slice(0, 5) : '00:00';

    if (cleanDate) {
      const [year, month, day] = cleanDate.split('-').map(Number);
      const [hours, minutes] = cleanHour.split(':').map(Number);

      if (year && month && day) {
        return new Date(
          year,
          month - 1,
          day,
          Number.isNaN(hours) ? 0 : hours,
          Number.isNaN(minutes) ? 0 : minutes
        ).getTime();
      }
    }

    return new Date(match?.created_date || match?.updated_date || 0).getTime() || 0;
  };

  const getMatchTieTimestamp = (match) => {
    return new Date(match?.created_date || match?.updated_date || 0).getTime() || 0;
  };

  const totalMatches = matches.length;
  const wins = matches.filter(m => m.result === 'win').length;
  const winrate = calcwinrate(matches);

  const blueMatches = matches.filter(m => m.side === 'blue');
  const redMatches = matches.filter(m => m.side === 'red');
  const bluewinrate = calcwinrate(blueMatches);
  const redwinrate = calcwinrate(redMatches);

  const sortedMatches = matches
    .map((match, index) => ({ match, index }))
    .sort((a, b) => {
      const timeDiff = getMatchTimestamp(b.match) - getMatchTimestamp(a.match);
      const tieDiff = getMatchTieTimestamp(b.match) - getMatchTieTimestamp(a.match);
      return timeDiff || tieDiff || b.index - a.index;
    })
    .map(({ match }) => match);

  const avgStat = (arr, field) => {
    return arr.length
      ? arr.reduce((sum, m) => sum + (Number(m[field]) || 0), 0) / arr.length
      : 0;
  };

  const calcKDAGroup = (arr) => {
    const kills = arr.reduce((sum, m) => sum + (Number(m.kills) || 0), 0);
    const deaths = arr.reduce((sum, m) => sum + (Number(m.deaths) || 0), 0);
    const assists = arr.reduce((sum, m) => sum + (Number(m.assists) || 0), 0);
    return deaths === 0 ? kills + assists : (kills + assists) / deaths;
  };

  const getTierEntry = (champName, lane = null) => {
    const champKey = normalizeVal(champName);
    const laneKey = lane ? normalizeLaneVal(lane) : null;

    const entries = (tierlist || []).filter(t => normalizeVal(t.champion_name) === champKey);
    if (entries.length === 0) return null;

    if (laneKey) {
      const laneMatch = entries.find(t => normalizeLaneVal(t.lane) === laneKey);
      if (laneMatch) return laneMatch;
    }

    return [...entries].sort((a, b) => Number(b.ranking_final || 0) - Number(a.ranking_final || 0))[0];
  };

  const insightPool = [];

  const addInsight = (text, priority = 3, options = {}) => {
    if (!text) return;

    const {
      family = 'general',
      entity = text,
      specificity = 1,
      polarity = 'neutral',
      freshness = 1,
    } = options;

    insightPool.push({
      text,
      priority,
      family,
      entity: normalizeVal(entity),
      specificity,
      polarity,
      freshness,
    });
  };

  // 1. Stats por campeón
  const champStats = {};

  matches.forEach(m => {
    const champ = getOwnChampion(m);
    if (!champ) return;

    if (!champStats[champ]) {
      champStats[champ] = {
        name: champ,
        games: 0,
        wins: 0,
        losses: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
      };
    }

    champStats[champ].games++;
    if (m.result === 'win') champStats[champ].wins++;
    if (m.result === 'loss') champStats[champ].losses++;

    champStats[champ].kills += Number(m.kills) || 0;
    champStats[champ].deaths += Number(m.deaths) || 0;
    champStats[champ].assists += Number(m.assists) || 0;
  });

  const champArr = Object.values(champStats)
    .map(c => ({
      ...c,
      wr: c.games > 0 ? (c.wins / c.games) * 100 : 0,
      avgDeaths: c.games > 0 ? c.deaths / c.games : 0,
      kda: c.deaths === 0 ? c.kills + c.assists : (c.kills + c.assists) / c.deaths,
    }))
    .sort((a, b) => b.games - a.games);

  const getChampionwinrate = (champName) => {
    const champ = champArr.find(c => normalizeVal(c.name) === normalizeVal(champName));
    return champ?.wr ?? null;
  };

  const getChampionGames = (champName) => {
    const champ = champArr.find(c => normalizeVal(c.name) === normalizeVal(champName));
    return champ?.games ?? 0;
  };

  // 2. Stats por línea
  const laneStats = {};

  matches.forEach(m => {
    const lane = m.lane;
    if (!lane) return;

    const key = normalizeLaneVal(lane);
    if (!laneStats[key]) {
      laneStats[key] = {
        lane: formatLane(lane),
        games: 0,
        wins: 0,
      };
    }

    laneStats[key].games++;
    if (m.result === 'win') laneStats[key].wins++;
  });

  const laneArr = Object.values(laneStats)
    .map(s => ({
      ...s,
      wr: s.games > 0 ? (s.wins / s.games) * 100 : 0,
    }));

  // 3. Stats por campeón + línea
  const champLaneStats = {};

  matches.forEach(m => {
    const champ = getOwnChampion(m);
    const lane = m.lane;
    if (!champ || !lane) return;

    const key = `${champ}|||${normalizeLaneVal(lane)}`;

    if (!champLaneStats[key]) {
      champLaneStats[key] = {
        champion: champ,
        lane: formatLane(lane),
        games: 0,
        wins: 0,
      };
    }

    champLaneStats[key].games++;
    if (m.result === 'win') champLaneStats[key].wins++;
  });

  const champLaneArr = Object.values(champLaneStats)
    .map(s => ({
      ...s,
      wr: s.games > 0 ? (s.wins / s.games) * 100 : 0,
    }))
    .filter(s => s.games >= 3);

  // 4. Confiabilidad general
  if (totalMatches < 10) {
    addInsight(
      'Todavía hay pocas partidas cargadas. Usá estos insights como señales iniciales, no como conclusiones definitivas.',
      5,
      { family: 'sample_size', entity: 'low_sample', specificity: 1 }
    );
  }

  if (totalMatches >= 10 && totalMatches < 25) {
    addInsight(
      `Ya tenés una muestra inicial útil de ${gamesLabel(totalMatches)}, pero los insights por campeón, runa u objeto todavía pueden moverse bastante.`,
      2,
      { family: 'sample_size', entity: 'medium_sample', specificity: 1 }
    );
  }

  // 5. Tendencia reciente
  const recentMatches = sortedMatches.slice(0, 10);
  const previousMatches = sortedMatches.slice(10, 20);

  if (recentMatches.length >= 6 && previousMatches.length >= 6) {
    const recentwinrate = calcwinrate(recentMatches);
    const previouswinrate = calcwinrate(previousMatches);

    if (recentwinrate >= previouswinrate + 15) {
      addInsight(
        `Venís en mejora clara: ${formatPct(recentwinrate)} winrate en las últimas ${gamesLabel(recentMatches.length)}, contra ${formatPct(previouswinrate)} en el tramo anterior.`,
        5,
        { family: 'recent_trend', entity: 'up', specificity: 2 }
      );
    }

    if (recentwinrate <= previouswinrate - 15) {
      addInsight(
        `Tu rendimiento reciente cayó: ${formatPct(recentwinrate)} winrate en las últimas ${gamesLabel(recentMatches.length)}, contra ${formatPct(previouswinrate)} en el tramo anterior. Revisá si estás forzando picks, jugando cansado o cambiando demasiado de rol.`,
        5,
        { family: 'recent_trend', entity: 'down', specificity: 2 }
      );
    }

    if (recentwinrate >= 65) {
      addInsight(
        `Tu tramo reciente es fuerte: ${formatPct(recentwinrate)} winrate en tus últimas ${gamesLabel(recentMatches.length)}. Es buen momento para priorizar ranked con tus picks más sólidos.`,
        4,
        { family: 'recent_form', entity: 'positive', specificity: 2 }
      );
    }

    if (recentwinrate <= 35) {
      addInsight(
        `Tus últimas partidas vienen difíciles: ${formatPct(recentwinrate)} winrate reciente. Antes de seguir ranked, conviene revisar patrones de derrota, picks repetidos y muertes tempranas.`,
        4,
        { family: 'recent_form', entity: 'negative', specificity: 2 }
      );
    }
  }

  // 6. Racha actual
  if (sortedMatches.length >= 3) {
    const currentResult = sortedMatches[0]?.result;
    let streak = 0;

    for (const match of sortedMatches) {
      if (match.result === currentResult) streak++;
      else break;
    }

    if (currentResult === 'win' && streak >= 4) {
      const streakChamps = uniqueByName(sortedMatches.slice(0, streak).map(getOwnChampion));
      const champText = streakChamps.length === 1 ? ` con ${streakChamps[0]}` : '';

      addInsight(
        `Llevás ${streak} victorias seguidas${champText}. Tu tendencia inmediata es positiva; intentá repetir el patrón antes de cambiar demasiado el pool.`,
        4,
        { family: 'streak', entity: `win_${streak}_${streakChamps.join('_')}`, specificity: 2 }
      );
    }

    if (currentResult === 'loss' && streak >= 3) {
      const streakChamps = uniqueByName(sortedMatches.slice(0, streak).map(getOwnChampion));
      const champText = streakChamps.length === 1 ? ` con ${streakChamps[0]}` : '';

      addInsight(
        `Llevás ${streak} derrotas seguidas${champText}. Puede convenir cortar ranked, cambiar de pick o revisar si estás repitiendo el mismo error de draft.`,
        5,
        { family: 'streak', entity: `loss_${streak}_${streakChamps.join('_')}`, specificity: 2 }
      );
    }
  }

  // 7. Pool de campeones
  if (totalMatches >= 20 && champArr.length > 0) {
    const top3 = champArr.slice(0, 3);
    const top3Games = top3.reduce((sum, c) => sum + c.games, 0);
    const top3Share = (top3Games / totalMatches) * 100;

    if (top3Share >= 75) {
      addInsight(
        `Tu pool está muy concentrado: ${top3.map(c => c.name).join(', ')} representan el ${formatPct(top3Share)} de tus partidas. Es bueno para subir si esos picks rinden, pero te vuelve más predecible en draft.`,
        3,
        { family: 'pool', entity: 'top3_concentration', specificity: 3 }
      );
    }

    const lowSampleChamps = champArr.filter(c => c.games <= 2).length;

    if (lowSampleChamps >= 6) {
      addInsight(
        `Estás probando muchos campeones con poca muestra: ${lowSampleChamps} campeones tienen 2 partidas o menos. Para mejorar más rápido, reducí el pool y repetí tus picks clave.`,
        4,
        { family: 'pool', entity: 'too_many_low_sample_champs', specificity: 2 }
      );
    }

    const mostPlayedChamp = champArr[0];

    if (mostPlayedChamp && mostPlayedChamp.games >= 8 && mostPlayedChamp.wr < winrate - 10) {
      addInsight(
        `${mostPlayedChamp.name} es tu campeón más usado, pero tiene ${formatPct(mostPlayedChamp.wr)} winrate contra ${formatPct(winrate)} general. Puede estar arrastrando tus resultados aunque sea tu pick principal.`,
        5,
        { family: 'champ_underperforming_main', entity: mostPlayedChamp.name, specificity: 4 }
      );
    }
  }

  // 8. Mejor y peor campeón
  const bestChamp = [...champArr]
    .filter(c => c.games >= 5 && c.wr >= 60)
    .sort((a, b) => b.wr - a.wr || b.games - a.games)[0];

  if (bestChamp) {
    addInsight(
      `Tu mejor rendimiento real es con ${bestChamp.name}: ${formatPct(bestChamp.wr)} winrate en ${gamesLabel(bestChamp.games)}. Es uno de tus candidatos más fuertes para ranked.`,
      4,
      { family: 'best_champ', entity: bestChamp.name, specificity: 3 }
    );
  }

  const worstChamp = [...champArr]
    .filter(c => c.games >= 5 && c.wr <= 35)
    .sort((a, b) => a.wr - b.wr || b.games - a.games)[0];

  if (worstChamp) {
    addInsight(
      `Tu rendimiento con ${worstChamp.name} es bajo: ${formatPct(worstChamp.wr)} winrate en ${gamesLabel(worstChamp.games)}. Evitalo en ranked hasta revisar build, runas o matchups concretos.`,
      5,
      { family: 'worst_champ', entity: worstChamp.name, specificity: 3 }
    );
  }

  // 9. Campeón + línea
  const bestChampLane = [...champLaneArr]
    .filter(c => c.wr >= 65)
    .sort((a, b) => b.wr - a.wr || b.games - a.games)[0];

  if (bestChampLane) {
    addInsight(
      `Tu combinación más rentable de campeón + línea es ${bestChampLane.champion} en ${bestChampLane.lane}: ${formatPct(bestChampLane.wr)} winrate en ${gamesLabel(bestChampLane.games)}.`,
      4,
      {
        family: 'best_champ_lane',
        entity: `${bestChampLane.champion}|||${bestChampLane.lane}`,
        specificity: 4,
      }
    );
  }

  const worstChampLane = [...champLaneArr]
    .filter(c => c.wr <= 35)
    .sort((a, b) => a.wr - b.wr || b.games - a.games)[0];

  if (worstChampLane) {
    addInsight(
      `${worstChampLane.champion} en ${worstChampLane.lane} viene rindiendo bajo: ${formatPct(worstChampLane.wr)} winrate en ${gamesLabel(worstChampLane.games)}. Puede ser problema de matchup, rol o ejecución del pick en esa línea.`,
      4,
      {
        family: 'worst_champ_lane',
        entity: `${worstChampLane.champion}|||${worstChampLane.lane}`,
        specificity: 4,
      }
    );
  }

  // 10. Ranked pick: rendimiento personal + meta
  const rankedPick = [...champArr]
    .filter(c => c.games >= 3 && c.wr >= 55)
    .map(c => ({ ...c, tierEntry: getTierEntry(c.name) }))
    .filter(c => ['S+', 'S'].includes(c.tierEntry?.tier))
    .sort((a, b) => b.wr - a.wr || b.games - a.games)[0];

  if (rankedPick) {
    addInsight(
      `${rankedPick.name} combina buen meta (${rankedPick.tierEntry.tier}) con buen rendimiento personal (${formatPct(rankedPick.wr)} winrate en ${gamesLabel(rankedPick.games)}). Es candidato fuerte para priorizar en ranked.`,
      5,
      { family: 'ranked_pick', entity: rankedPick.name, specificity: 4 }
    );
  }

  // 11. Meta vs rendimiento personal
  champArr.forEach(c => {
    if (c.games < 5) return;

    const tierEntry = getTierEntry(c.name);
    if (!tierEntry) return;

    if (['S+', 'S'].includes(tierEntry.tier) && c.wr < 45) {
      addInsight(
        `${c.name} está fuerte en meta (${tierEntry.tier}), pero tu winrate personal es ${formatPct(c.wr)} en ${gamesLabel(c.games)}. No alcanza con que el pick esté fuerte: revisá matchups, build y plan de partida.`,
        4,
        { family: 'meta_underperform', entity: c.name, specificity: 4 }
      );
    }

    if (['C', 'D'].includes(tierEntry.tier) && c.wr >= 65) {
      addInsight(
        `${c.name} no está alto en tierlist (${tierEntry.tier}), pero vos tenés ${formatPct(c.wr)} winrate en ${gamesLabel(c.games)}. Puede ser tu pocket pick si entendés bien cuándo elegirlo.`,
        4,
        { family: 'pocket_pick', entity: c.name, specificity: 4 }
      );
    }

    if (['C', 'D'].includes(tierEntry.tier) && c.wr <= 40) {
      addInsight(
        `${c.name} está bajo en la tierlist (${tierEntry.tier}) y además tu rendimiento personal es bajo (${formatPct(c.wr)}). Ahora mismo parece un pick poco rentable para ranked.`,
        5,
        { family: 'bad_meta_bad_personal', entity: c.name, specificity: 4 }
      );
    }
  });

  // 12. Línea general
  const validLanes = laneArr.filter(l => l.games >= 5);

  if (validLanes.length >= 2) {
    const mostPlayedLane = [...validLanes].sort((a, b) => b.games - a.games)[0];
    const bestLane = [...validLanes].sort((a, b) => b.wr - a.wr)[0];

    if (
      mostPlayedLane &&
      bestLane &&
      normalizeLaneVal(mostPlayedLane.lane) !== normalizeLaneVal(bestLane.lane) &&
      bestLane.wr >= mostPlayedLane.wr + 12
    ) {
      addInsight(
        `Jugás más ${mostPlayedLane.lane}, pero tu mejor rendimiento está en ${bestLane.lane}: ${formatPct(bestLane.wr)} winrate contra ${formatPct(mostPlayedLane.wr)}. Para subir ranked, podrías priorizar ${bestLane.lane}.`,
        4,
        { family: 'lane_mismatch', entity: `${mostPlayedLane.lane}_${bestLane.lane}`, specificity: 3 }
      );
    }

    const weakLane = [...validLanes].sort((a, b) => a.wr - b.wr)[0];

    if (weakLane && weakLane.wr <= 40) {
      addInsight(
        `${weakLane.lane} parece ser tu línea más débil: ${formatPct(weakLane.wr)} winrate en ${gamesLabel(weakLane.games)}. Revisá picks, matchups y decisiones de macro específicas de esa línea.`,
        4,
        { family: 'weak_lane', entity: weakLane.lane, specificity: 3 }
      );
    }
  }

  // 13. Muertes y KDA
  const winMatchesArr = matches.filter(m => m.result === 'win');
  const lossMatchesArr = matches.filter(m => m.result === 'loss');

  if (winMatchesArr.length >= 5 && lossMatchesArr.length >= 5) {
    const avgDeathsWins = avgStat(winMatchesArr, 'deaths');
    const avgDeathsLosses = avgStat(lossMatchesArr, 'deaths');

    if (avgDeathsLosses >= avgDeathsWins + 2) {
      addInsight(
        `En tus derrotas morís bastante más: ${avgDeathsLosses.toFixed(1)} muertes promedio contra ${avgDeathsWins.toFixed(1)} en victorias. El foco principal debería ser reducir muertes evitables antes de objetivos.`,
        5,
        { family: 'deaths', entity: 'loss_deaths_high', specificity: 2 }
      );
    }

    const lossKDA = calcKDAGroup(lossMatchesArr);

    if (lossKDA >= 3 && winrate < 50) {
      addInsight(
        `Incluso en derrotas mantenés buen KDA (${lossKDA.toFixed(2)}). El problema puede no ser mecánico, sino cierre de partidas, toma de objetivos o rotaciones después de ganar peleas.`,
        4,
        { family: 'macro', entity: 'good_kda_bad_wr', specificity: 2 }
      );
    }
  }

  // 14. Lado azul / rojo
  if (blueMatches.length >= 5 && redMatches.length >= 5 && bluewinrate > redwinrate + 10) {
    addInsight(
      `Tenés mejor rendimiento del lado azul: ${formatPct(bluewinrate)} winrate contra ${formatPct(redwinrate)} del lado rojo. Revisá si en rojo te cuesta más jugar visión, dragón/barón o pathing inicial.`,
      3,
      { family: 'side', entity: 'blue_better', specificity: 2 }
    );
  }

  if (blueMatches.length >= 5 && redMatches.length >= 5 && redwinrate > bluewinrate + 10) {
    addInsight(
      `Tenés mejor rendimiento del lado rojo: ${formatPct(redwinrate)} winrate contra ${formatPct(bluewinrate)} del lado azul. Puede haber una diferencia de comodidad en cámara, rutas o forma de plantear objetivos.`,
      3,
      { family: 'side', entity: 'red_better', specificity: 2 }
    );
  }

  // 15. Matchup directo: tu campeón vs campeón rival de línea
  const directMatchupStats = {};

  matches.forEach(m => {
    const own = getOwnChampion(m);
    const enemy = getDirectEnemyChampion(m);
    if (!own || !enemy) return;

    const key = `${own}|||${enemy}`;

    if (!directMatchupStats[key]) {
      directMatchupStats[key] = {
        own,
        enemy,
        games: 0,
        wins: 0,
      };
    }

    directMatchupStats[key].games++;
    if (m.result === 'win') directMatchupStats[key].wins++;
  });

  const directMatchupArr = Object.values(directMatchupStats)
    .map(s => ({
      ...s,
      wr: s.games > 0 ? (s.wins / s.games) * 100 : 0,
    }))
    .filter(s => s.games >= 2);

  const worstDirectMatchup = [...directMatchupArr]
    .filter(m => m.wr <= 35)
    .sort((a, b) => a.wr - b.wr || b.games - a.games)[0];

  if (worstDirectMatchup) {
    addInsight(
      `Con ${worstDirectMatchup.own}, ${worstDirectMatchup.enemy} aparece como matchup directo problemático: ${formatPct(worstDirectMatchup.wr)} winrate en ${gamesLabel(worstDirectMatchup.games)}. Puede ser ban situacional o matchup para practicar.`,
      5,
      {
        family: 'direct_matchup_bad',
        entity: `${worstDirectMatchup.own}|||${worstDirectMatchup.enemy}`,
        specificity: 5,
      }
    );
  }

  const bestDirectMatchup = [...directMatchupArr]
    .filter(m => m.wr >= 70)
    .sort((a, b) => b.wr - a.wr || b.games - a.games)[0];

  if (bestDirectMatchup) {
    addInsight(
      `Con ${bestDirectMatchup.own}, te va muy bien contra ${bestDirectMatchup.enemy}: ${formatPct(bestDirectMatchup.wr)} winrate en ${gamesLabel(bestDirectMatchup.games)}. Es un matchup que podrías buscar cuando aparezca en draft.`,
      3,
      {
        family: 'direct_matchup_good',
        entity: `${bestDirectMatchup.own}|||${bestDirectMatchup.enemy}`,
        specificity: 4,
      }
    );
  }

  // 16. Campeón enemigo en composición rival, asociado a tu campeón
  const ownVsEnemyTeamStats = {};

  matches.forEach(m => {
    const own = getOwnChampion(m);
    if (!own) return;

    const enemies = getEnemyTeamChampions(m);

    enemies.forEach(enemy => {
      const key = `${own}|||${enemy}`;

      if (!ownVsEnemyTeamStats[key]) {
        ownVsEnemyTeamStats[key] = {
          own,
          enemy,
          games: 0,
          wins: 0,
        };
      }

      ownVsEnemyTeamStats[key].games++;
      if (m.result === 'win') ownVsEnemyTeamStats[key].wins++;
    });
  });

  const ownVsEnemyTeamArr = Object.values(ownVsEnemyTeamStats)
    .map(s => ({
      ...s,
      wr: s.games > 0 ? (s.wins / s.games) * 100 : 0,
      ownwinrate: getChampionwinrate(s.own),
    }))
    .filter(s => s.games >= 3);

  const enemyProblemPick = [...ownVsEnemyTeamArr]
    .filter(s => {
      const baseline = s.ownwinrate ?? winrate;
      return s.wr <= Math.min(40, baseline - 10);
    })
    .sort((a, b) => a.wr - b.wr || b.games - a.games)[0];

  if (enemyProblemPick) {
    addInsight(
      `Cuando jugás ${enemyProblemPick.own} y ${enemyProblemPick.enemy} aparece en el equipo enemigo, tu winrate baja a ${formatPct(enemyProblemPick.wr)} en ${gamesLabel(enemyProblemPick.games)}. Revisá cómo jugar alrededor de ese pick o consideralo ban situacional.`,
      5,
      {
        family: 'enemy_team_problem_by_own_champ',
        entity: `${enemyProblemPick.own}|||${enemyProblemPick.enemy}`,
        specificity: 5,
      }
    );
  }

  const enemyFavorablePick = [...ownVsEnemyTeamArr]
    .filter(s => {
      const baseline = s.ownwinrate ?? winrate;
      return s.wr >= Math.max(65, baseline + 10);
    })
    .sort((a, b) => b.wr - a.wr || b.games - a.games)[0];

  if (enemyFavorablePick) {
    addInsight(
      `Cuando jugás ${enemyFavorablePick.own} y ${enemyFavorablePick.enemy} está en el equipo enemigo, te va especialmente bien: ${formatPct(enemyFavorablePick.wr)} winrate en ${gamesLabel(enemyFavorablePick.games)}. Puede ser un rival que sabés castigar con ese campeón.`,
      3,
      {
        family: 'enemy_team_good_by_own_champ',
        entity: `${enemyFavorablePick.own}|||${enemyFavorablePick.enemy}`,
        specificity: 4,
      }
    );
  }

  // 17b. Matchups generales: contra cualquier campeón enemigo (sin importar tu campeón)
  const generalEnemyStats = {};

  matches.forEach(m => {
    const allEnemies = [
      ...(Array.isArray(m.enemy_champions) ? m.enemy_champions : []),
      m.enemy_champion_name,
    ].filter(Boolean);

    const unique = [...new Set(allEnemies.map(e => normalizeChampionName(e)).filter(Boolean))];

    unique.forEach(enemy => {
      if (!generalEnemyStats[enemy]) generalEnemyStats[enemy] = { games: 0, wins: 0 };
      generalEnemyStats[enemy].games++;
      if (m.result === 'win') generalEnemyStats[enemy].wins++;
    });
  });

  const generalEnemyArr = Object.entries(generalEnemyStats)
    .map(([enemy, s]) => ({
      enemy,
      games: s.games,
      wr: s.games > 0 ? (s.wins / s.games) * 100 : 0,
    }))
    .filter(s => s.games > 3);

  const bestGeneralEnemy = [...generalEnemyArr]
    .filter(s => s.wr > 50)
    .sort((a, b) => b.wr - a.wr || b.games - a.games)[0];

  if (bestGeneralEnemy) {
    addInsight(
      `${bestGeneralEnemy.enemy} es el campeón enemigo contra el que mejor te va en general: ${formatPct(bestGeneralEnemy.wr)} winrate en ${gamesLabel(bestGeneralEnemy.games)} partidas donde apareció en el equipo rival.`,
      3,
      {
        family: 'best_general_enemy',
        entity: bestGeneralEnemy.enemy,
        specificity: 4,
      }
    );
  }

  const worstGeneralEnemy = [...generalEnemyArr]
    .filter(s => s.wr < 50)
    .sort((a, b) => a.wr - b.wr || b.games - a.games)[0];

  if (worstGeneralEnemy) {
    addInsight(
      `${worstGeneralEnemy.enemy} es el campeón enemigo con el que peor te va en general: ${formatPct(worstGeneralEnemy.wr)} winrate en ${gamesLabel(worstGeneralEnemy.games)} partidas donde apareció en el equipo rival. Considerá banearlo o adaptá tu pick cuando aparezca.`,
      4,
      {
        family: 'worst_general_enemy',
        entity: worstGeneralEnemy.enemy,
        specificity: 4,
      }
    );
  }

  // 17. Sinergias: tu campeón + aliado
  const synergyStats = {};

  matches.forEach(m => {
    const own = getOwnChampion(m);
    if (!own) return;

    getAllyChampions(m).forEach(ally => {
      const key = `${own}|||${ally}`;

      if (!synergyStats[key]) {
        synergyStats[key] = {
          own,
          ally,
          games: 0,
          wins: 0,
        };
      }

      synergyStats[key].games++;
      if (m.result === 'win') synergyStats[key].wins++;
    });
  });

  const synergyArr = Object.values(synergyStats)
    .map(s => ({
      ...s,
      wr: s.games > 0 ? (s.wins / s.games) * 100 : 0,
      ownwinrate: getChampionwinrate(s.own),
    }))
    .filter(s => s.games >= 3);

  const bestSynergy = [...synergyArr]
    .filter(s => {
      const baseline = s.ownwinrate ?? winrate;
      return s.wr >= Math.max(70, baseline + 10);
    })
    .sort((a, b) => b.wr - a.wr || b.games - a.games)[0];

  if (bestSynergy) {
    addInsight(
      `La dupla ${bestSynergy.own} + ${bestSynergy.ally} te está funcionando muy bien: ${formatPct(bestSynergy.wr)} winrate en ${gamesLabel(bestSynergy.games)}. Buscá composiciones que repitan ese estilo de juego.`,
      4,
      {
        family: 'best_synergy_by_own_champ',
        entity: `${bestSynergy.own}|||${bestSynergy.ally}`,
        specificity: 5,
      }
    );
  }

  const worstSynergy = [...synergyArr]
    .filter(s => {
      const baseline = s.ownwinrate ?? winrate;
      return s.wr <= Math.min(35, baseline - 10);
    })
    .sort((a, b) => a.wr - b.wr || b.games - a.games)[0];

  if (worstSynergy) {
    addInsight(
      `La combinación ${worstSynergy.own} + ${worstSynergy.ally} viene rindiendo bajo: ${formatPct(worstSynergy.wr)} winrate en ${gamesLabel(worstSynergy.games)}. Puede haber mala sinergia de engage, peel, escalado o prioridad de línea.`,
      3,
      {
        family: 'worst_synergy_by_own_champ',
        entity: `${worstSynergy.own}|||${worstSynergy.ally}`,
        specificity: 5,
      }
    );
  }

  // 18. Objetos: SIEMPRE asociados al campeón
  const matchesWithBuild = matches
    .map(m => ({
      ...m,
      ownChampion: getOwnChampion(m),
      buildItems: normalizeBuildItems(m),
    }))
    .filter(m => m.ownChampion && m.buildItems.length > 0);

  if (matchesWithBuild.length >= 6) {
    const championItemStats = {};

    matchesWithBuild.forEach(m => {
      uniqueByName(m.buildItems).forEach(item => {
        const key = `${m.ownChampion}|||${item}`;

        if (!championItemStats[key]) {
          championItemStats[key] = {
            champion: m.ownChampion,
            item,
            games: 0,
            wins: 0,
          };
        }

        championItemStats[key].games++;
        if (m.result === 'win') championItemStats[key].wins++;
      });
    });

    const championItemArr = Object.values(championItemStats)
      .map(s => ({
        ...s,
        wr: s.games > 0 ? (s.wins / s.games) * 100 : 0,
        championwinrate: getChampionwinrate(s.champion),
        championGames: getChampionGames(s.champion),
      }))
      .filter(s => s.games >= 3 && s.championGames >= 4);

    const bestChampionItem = [...championItemArr]
      .filter(s => {
        const baseline = s.championwinrate ?? winrate;
        return s.wr >= Math.max(65, baseline + 10);
      })
      .sort((a, b) => b.wr - a.wr || b.games - a.games)[0];

    if (bestChampionItem) {
      addInsight(
        `Con ${bestChampionItem.champion}, ${bestChampionItem.item} está asociado a muy buen rendimiento: ${formatPct(bestChampionItem.wr)} winrate en ${gamesLabel(bestChampionItem.games)}, contra ${formatPct(bestChampionItem.championwinrate)} winrate general con el campeón.`,
        5,
        {
          family: 'good_item_by_champion',
          entity: `${bestChampionItem.champion}|||${bestChampionItem.item}`,
          specificity: 5,
        }
      );
    }

    const worstChampionItem = [...championItemArr]
      .filter(s => {
        const baseline = s.championwinrate ?? winrate;
        return s.wr <= Math.min(40, baseline - 10);
      })
      .sort((a, b) => a.wr - b.wr || b.games - a.games)[0];

    if (worstChampionItem) {
      addInsight(
        `Con ${worstChampionItem.champion}, ${worstChampionItem.item} viene rindiendo bajo: ${formatPct(worstChampionItem.wr)} winrate en ${gamesLabel(worstChampionItem.games)}, por debajo de tu ${formatPct(worstChampionItem.championwinrate)} general con ese campeón. Revisá si lo estás comprando en partidas equivocadas.`,
        5,
        {
          family: 'bad_item_by_champion',
          entity: `${worstChampionItem.champion}|||${worstChampionItem.item}`,
          specificity: 5,
        }
      );
    }

    // Primer objeto por campeón
    const firstItemStats = {};

    matchesWithBuild.forEach(m => {
      const firstItem = m.buildItems[0];
      if (!firstItem) return;

      const key = `${m.ownChampion}|||${firstItem}`;

      if (!firstItemStats[key]) {
        firstItemStats[key] = {
          champion: m.ownChampion,
          item: firstItem,
          games: 0,
          wins: 0,
        };
      }

      firstItemStats[key].games++;
      if (m.result === 'win') firstItemStats[key].wins++;
    });

    const firstItemArr = Object.values(firstItemStats)
      .map(s => ({
        ...s,
        wr: s.games > 0 ? (s.wins / s.games) * 100 : 0,
        championwinrate: getChampionwinrate(s.champion),
      }))
      .filter(s => s.games >= 3);

    const bestFirstItem = [...firstItemArr]
      .filter(s => {
        const baseline = s.championwinrate ?? winrate;
        return s.wr >= Math.max(65, baseline + 10);
      })
      .sort((a, b) => b.wr - a.wr || b.games - a.games)[0];

    if (bestFirstItem) {
      addInsight(
        `Como primer objeto con ${bestFirstItem.champion}, ${bestFirstItem.item} parece ser tu arranque más confiable: ${formatPct(bestFirstItem.wr)} winrate en ${gamesLabel(bestFirstItem.games)}.`,
        4,
        {
          family: 'best_first_item_by_champion',
          entity: `${bestFirstItem.champion}|||${bestFirstItem.item}`,
          specificity: 5,
        }
      );
    }

    const worstFirstItem = [...firstItemArr]
      .filter(s => {
        const baseline = s.championwinrate ?? winrate;
        return s.wr <= Math.min(40, baseline - 10);
      })
      .sort((a, b) => a.wr - b.wr || b.games - a.games)[0];

    if (worstFirstItem) {
      addInsight(
        `Como primer objeto con ${worstFirstItem.champion}, ${worstFirstItem.item} no te está dando buenos resultados: ${formatPct(worstFirstItem.wr)} winrate en ${gamesLabel(worstFirstItem.games)}. Podría ser un mal spike inicial para tu estilo o para esos matchups.`,
        4,
        {
          family: 'worst_first_item_by_champion',
          entity: `${worstFirstItem.champion}|||${worstFirstItem.item}`,
          specificity: 5,
        }
      );
    }

    // Núcleo de build por campeón
    const buildCoreStats = {};

    matchesWithBuild.forEach(m => {
      const coreItems = m.buildItems.slice(0, 3);
      if (coreItems.length < 2) return;

      const core = coreItems.join(' + ');
      const key = `${m.ownChampion}|||${core}`;

      if (!buildCoreStats[key]) {
        buildCoreStats[key] = {
          champion: m.ownChampion,
          core,
          games: 0,
          wins: 0,
        };
      }

      buildCoreStats[key].games++;
      if (m.result === 'win') buildCoreStats[key].wins++;
    });

    const buildCoreArr = Object.values(buildCoreStats)
      .map(s => ({
        ...s,
        wr: s.games > 0 ? (s.wins / s.games) * 100 : 0,
        championwinrate: getChampionwinrate(s.champion),
      }))
      .filter(c => c.games >= 3);

    const bestCoreBuild = [...buildCoreArr]
      .filter(c => {
        const baseline = c.championwinrate ?? winrate;
        return c.wr >= Math.max(65, baseline + 10);
      })
      .sort((a, b) => b.wr - a.wr || b.games - a.games)[0];

    if (bestCoreBuild) {
      addInsight(
        `Con ${bestCoreBuild.champion}, tu mejor núcleo de build es ${bestCoreBuild.core}: ${formatPct(bestCoreBuild.wr)} winrate en ${gamesLabel(bestCoreBuild.games)}. Es una base sólida para repetir cuando el draft sea similar.`,
        5,
        {
          family: 'good_core_build',
          entity: `${bestCoreBuild.champion}|||${bestCoreBuild.core}`,
          specificity: 6,
        }
      );
    }

    const worstCoreBuild = [...buildCoreArr]
      .filter(c => {
        const baseline = c.championwinrate ?? winrate;
        return c.wr <= Math.min(35, baseline - 10);
      })
      .sort((a, b) => a.wr - b.wr || b.games - a.games)[0];

    if (worstCoreBuild) {
      addInsight(
        `Con ${worstCoreBuild.champion}, el núcleo ${worstCoreBuild.core} viene rindiendo bajo: ${formatPct(worstCoreBuild.wr)} winrate en ${gamesLabel(worstCoreBuild.games)}. Revisá si esa build encaja con tu rol en la partida o si la estás armando por costumbre.`,
        5,
        {
          family: 'bad_core_build',
          entity: `${worstCoreBuild.champion}|||${worstCoreBuild.core}`,
          specificity: 6,
        }
      );
    }
  }

  // 19. Runas: SIEMPRE asociadas al campeón
  const matchesWithRunes = matches
    .map(m => ({
      ...m,
      ownChampion: getOwnChampion(m),
      runes: normalizeRunes(m),
      keystone: getKeystoneRune(m),
    }))
    .filter(m => m.ownChampion && (m.runes.length > 0 || m.keystone));

  if (matchesWithRunes.length >= 6) {
    // Runa individual por campeón
    const championRuneStats = {};

    matchesWithRunes.forEach(m => {
      uniqueByName(m.runes).forEach(rune => {
        const key = `${m.ownChampion}|||${rune}`;

        if (!championRuneStats[key]) {
          championRuneStats[key] = {
            champion: m.ownChampion,
            rune,
            games: 0,
            wins: 0,
          };
        }

        championRuneStats[key].games++;
        if (m.result === 'win') championRuneStats[key].wins++;
      });
    });

    const championRuneArr = Object.values(championRuneStats)
      .map(s => ({
        ...s,
        wr: s.games > 0 ? (s.wins / s.games) * 100 : 0,
        championwinrate: getChampionwinrate(s.champion),
        championGames: getChampionGames(s.champion),
      }))
      .filter(s => s.games >= 3 && s.championGames >= 4);

    const bestChampionRune = [...championRuneArr]
      .filter(s => {
        const baseline = s.championwinrate ?? winrate;
        return s.wr >= Math.max(65, baseline + 10);
      })
      .sort((a, b) => b.wr - a.wr || b.games - a.games)[0];

    if (bestChampionRune) {
      addInsight(
        `Con ${bestChampionRune.champion}, la runa ${bestChampionRune.rune} está asociada a muy buen rendimiento: ${formatPct(bestChampionRune.wr)} winrate en ${gamesLabel(bestChampionRune.games)}, por encima de tu ${formatPct(bestChampionRune.championwinrate)} general con el campeón.`,
        5,
        {
          family: 'good_rune_by_champion',
          entity: `${bestChampionRune.champion}|||${bestChampionRune.rune}`,
          specificity: 5,
        }
      );
    }

    const worstChampionRune = [...championRuneArr]
      .filter(s => {
        const baseline = s.championwinrate ?? winrate;
        return s.wr <= Math.min(40, baseline - 10);
      })
      .sort((a, b) => a.wr - b.wr || b.games - a.games)[0];

    if (worstChampionRune) {
      addInsight(
        `Con ${worstChampionRune.champion}, la runa ${worstChampionRune.rune} viene rindiendo bajo: ${formatPct(worstChampionRune.wr)} winrate en ${gamesLabel(worstChampionRune.games)}. Revisá si esa runa realmente acompaña tu plan de partida con ese campeón.`,
        4,
        {
          family: 'bad_rune_by_champion',
          entity: `${worstChampionRune.champion}|||${worstChampionRune.rune}`,
          specificity: 5,
        }
      );
    }

    // Keystone por campeón
    const keystoneStats = {};

    matchesWithRunes.forEach(m => {
      if (!m.keystone) return;

      const key = `${m.ownChampion}|||${m.keystone}`;

      if (!keystoneStats[key]) {
        keystoneStats[key] = {
          champion: m.ownChampion,
          keystone: m.keystone,
          games: 0,
          wins: 0,
        };
      }

      keystoneStats[key].games++;
      if (m.result === 'win') keystoneStats[key].wins++;
    });

    const keystoneArr = Object.values(keystoneStats)
      .map(s => ({
        ...s,
        wr: s.games > 0 ? (s.wins / s.games) * 100 : 0,
        championwinrate: getChampionwinrate(s.champion),
      }))
      .filter(s => s.games >= 3);

    const bestKeystone = [...keystoneArr]
      .filter(s => {
        const baseline = s.championwinrate ?? winrate;
        return s.wr >= Math.max(65, baseline + 10);
      })
      .sort((a, b) => b.wr - a.wr || b.games - a.games)[0];

    if (bestKeystone) {
      addInsight(
        `Con ${bestKeystone.champion}, ${bestKeystone.keystone} parece ser tu runa clave más efectiva: ${formatPct(bestKeystone.wr)} winrate en ${gamesLabel(bestKeystone.games)}.`,
        5,
        {
          family: 'best_keystone_by_champion',
          entity: `${bestKeystone.champion}|||${bestKeystone.keystone}`,
          specificity: 6,
        }
      );
    }

    const worstKeystone = [...keystoneArr]
      .filter(s => {
        const baseline = s.championwinrate ?? winrate;
        return s.wr <= Math.min(40, baseline - 10);
      })
      .sort((a, b) => a.wr - b.wr || b.games - a.games)[0];

    if (worstKeystone) {
      addInsight(
        `Con ${worstKeystone.champion}, ${worstKeystone.keystone} no está funcionando bien como runa clave: ${formatPct(worstKeystone.wr)} winrate en ${gamesLabel(worstKeystone.games)}. Probá si otra clave acompaña mejor tu forma de jugar ese pick.`,
        4,
        {
          family: 'worst_keystone_by_champion',
          entity: `${worstKeystone.champion}|||${worstKeystone.keystone}`,
          specificity: 6,
        }
      );
    }

    // Página de runas completa por campeón
    const runePageStats = {};

    matchesWithRunes.forEach(m => {
      const runePage = uniqueByName(m.runes).slice(0, 5);
      if (runePage.length < 3) return;

      const page = runePage.join(' + ');
      const key = `${m.ownChampion}|||${page}`;

      if (!runePageStats[key]) {
        runePageStats[key] = {
          champion: m.ownChampion,
          page,
          games: 0,
          wins: 0,
        };
      }

      runePageStats[key].games++;
      if (m.result === 'win') runePageStats[key].wins++;
    });

    const runePageArr = Object.values(runePageStats)
      .map(s => ({
        ...s,
        wr: s.games > 0 ? (s.wins / s.games) * 100 : 0,
        championwinrate: getChampionwinrate(s.champion),
      }))
      .filter(s => s.games >= 2);

    const bestRunePage = [...runePageArr]
      .filter(s => {
        const baseline = s.championwinrate ?? winrate;
        return s.games >= 3 && s.wr >= Math.max(65, baseline + 10);
      })
      .sort((a, b) => b.wr - a.wr || b.games - a.games)[0];

    if (bestRunePage) {
      addInsight(
        `Con ${bestRunePage.champion}, tu página de runas más efectiva viene siendo ${bestRunePage.page}: ${formatPct(bestRunePage.wr)} winrate en ${gamesLabel(bestRunePage.games)}.`,
        5,
        {
          family: 'best_rune_page_by_champion',
          entity: `${bestRunePage.champion}|||${bestRunePage.page}`,
          specificity: 6,
        }
      );
    }

    const worstRunePage = [...runePageArr]
      .filter(s => {
        const baseline = s.championwinrate ?? winrate;
        return s.games >= 3 && s.wr <= Math.min(40, baseline - 10);
      })
      .sort((a, b) => a.wr - b.wr || b.games - a.games)[0];

    if (worstRunePage) {
      addInsight(
        `Con ${worstRunePage.champion}, la página ${worstRunePage.page} viene rindiendo bajo: ${formatPct(worstRunePage.wr)} winrate en ${gamesLabel(worstRunePage.games)}. Revisá si esas runas encajan con el matchup o si estás perdiendo valor en early/mid game.`,
        4,
        {
          family: 'worst_rune_page_by_champion',
          entity: `${worstRunePage.champion}|||${worstRunePage.page}`,
          specificity: 6,
        }
      );
    }
  }

    // 20. Orden, deduplicación temática y salida final
    const getInsightTopic = (item) => {
      const family = item.family || '';

      // Todo lo relacionado a runas cuenta como un solo tema.
      // Así evitamos que aparezcan al mismo tiempo:
      // - runa individual
      // - runa clave
      // - página completa de runas
      if (
        family.includes('rune') ||
        family.includes('keystone')
      ) {
        return 'runes';
      }

      // Todo lo que combine campeones cuenta como un solo tema.
      // Incluye:
      // - tu campeón vs rival directo
      // - tu campeón vs campeón enemigo en composición
      // - tu campeón + aliado
      if (
        family.includes('synergy') ||
        family.includes('matchup') ||
        family.includes('enemy_team')
      ) {
        return 'champion_combinations';
      }

      return family;
    };

    const topicLimits = {
      runes: 1,
      champion_combinations: 1,
    };

    const inferPolarity = (item) => {
      if (item.polarity && item.polarity !== 'neutral') return item.polarity;

      const family = item.family || '';
      const entity = item.entity || '';

      if (family === 'streak') {
        if (entity.startsWith('win_')) return 'positive';
        if (entity.startsWith('loss_')) return 'negative';
      }

      if (family === 'recent_trend') return entity === 'up' ? 'positive' : 'negative';
      if (family === 'recent_form') return entity === 'positive' ? 'positive' : 'negative';

      if (
        family.startsWith('best_') ||
        family.startsWith('good_') ||
        family === 'best_champ' ||
        family === 'ranked_pick' ||
        family === 'pocket_pick'
      ) {
        return 'positive';
      }

      if (
        family.startsWith('worst_') ||
        family.startsWith('bad_') ||
        family.startsWith('weak_') ||
        family.includes('_bad') ||
        family.includes('underperform')
      ) {
        return 'negative';
      }

      return 'neutral';
    };

    const getRecentSupportMatches = (item) => {
      const family = item.family || '';
      const entityParts = String(item.entity || '').split('|||');
      const mainEntity = entityParts[0];
      const secondaryEntity = entityParts[1];

      if (!mainEntity) return recentMatches;

      if (family === 'side') {
        const side = mainEntity.startsWith('blue') ? 'blue' : mainEntity.startsWith('red') ? 'red' : null;
        return side ? recentMatches.filter(m => normalizeVal(m.side) === side) : recentMatches;
      }

      if (family.includes('lane')) {
        return recentMatches.filter(m => {
          const champMatches = family.includes('champ') ? normalizeVal(getOwnChampion(m)) === mainEntity : true;
          const laneEntity = family.includes('champ') ? secondaryEntity : mainEntity;
          const laneMatches = laneEntity ? normalizeLaneVal(m.lane) === normalizeLaneVal(laneEntity) : true;
          return champMatches && laneMatches;
        });
      }

      if (
        family.includes('champ') ||
        family.includes('meta') ||
        family.includes('pick') ||
        family.includes('item') ||
        family.includes('rune') ||
        family.includes('keystone') ||
        family.includes('matchup') ||
        family.includes('synergy') ||
        family.includes('enemy_team')
      ) {
        return recentMatches.filter(m => normalizeVal(getOwnChampion(m)) === mainEntity);
      }

      return recentMatches;
    };

    const getDynamicState = (item) => {
      const polarity = inferPolarity(item);
      const supportMatches = getRecentSupportMatches(item);
      const supportGames = supportMatches.length;
      const supportWr = supportGames > 0 ? calcwinrate(supportMatches) : null;
      const state = {
        isContradicted: false,
        freshness: item.freshness || 1,
      };

      if (item.family === 'streak') state.freshness = 5;
      if (item.family === 'recent_trend' || item.family === 'recent_form') state.freshness = 4;

      if (supportGames >= 3 && supportWr !== null) {
        if (polarity === 'negative' && supportWr >= 60) {
          state.isContradicted = true;
        }

        if (polarity === 'positive' && supportWr <= 40) {
          state.isContradicted = true;
        }

        if (!state.isContradicted) {
          if (polarity === 'positive' && supportWr >= 60) state.freshness += 2;
          if (polarity === 'negative' && supportWr <= 40) state.freshness += 2;
        }
      }

      return state;
    };

    const usedExactInsights = new Set();
    const usedFamilyEntities = new Set();
    const usedTopicsCount = {};

    const finalInsights = insightPool
      .map(item => ({
        ...item,
        dynamicState: getDynamicState(item),
      }))
      .sort((a, b) => {
        const priorityDiff =
          (b.priority + b.dynamicState.freshness * 0.2) -
          (a.priority + a.dynamicState.freshness * 0.2);
        if (priorityDiff !== 0) return priorityDiff;
        return b.specificity - a.specificity;
      })
      .filter(item => {
        const familyEntityKey = `${item.family}|||${item.entity}`;
        const topic = getInsightTopic(item);
        const topicLimit = topicLimits[topic];

        // Si las últimas partidas ya contradicen un patrón histórico, no lo mostramos.
        if (item.dynamicState.isContradicted) return false;

        // Evita duplicado exacto por family + entity
        if (usedFamilyEntities.has(familyEntityKey)) return false;

        // Evita texto repetido
        if (usedExactInsights.has(item.text)) return false;

        // Limita temas específicos: runas, combinaciones de campeones, etc.
        if (topicLimit && (usedTopicsCount[topic] || 0) >= topicLimit) {
          return false;
        }

        usedFamilyEntities.add(familyEntityKey);
        usedExactInsights.add(item.text);
        usedTopicsCount[topic] = (usedTopicsCount[topic] || 0) + 1;

        return true;
      })
      .slice(0, 8)
      .map(item => item.text);

  if (finalInsights.length === 0) {
    return [
      'Todavía no hay patrones suficientemente claros. Cargá más partidas con campeón, línea, resultado, build y runas para generar insights más específicos.',
    ];
  }

  return finalInsights;
}
