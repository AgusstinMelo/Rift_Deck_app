// Fórmulas estadísticas compartidas. Puras y sin dependencias para poder
// usarlas desde páginas, el motor de objetivos y los tests de Node.

/** Winrate en porcentaje (0–100). Sin partidas devuelve 0. */
export function winratePct(wins, games) {
  return games > 0 ? (wins / games) * 100 : 0;
}

/** Proporción en porcentaje (0–100). Sin total devuelve 0. */
export function percentageOf(part, total) {
  return total > 0 ? (part / total) * 100 : 0;
}

/** Suma de una lista de números. */
export function sumOf(values) {
  return values.reduce((sum, value) => sum + value, 0);
}

/** Promedio de una lista de números; null si la lista está vacía. */
export function averageOf(values) {
  return values.length > 0 ? sumOf(values) / values.length : null;
}

/** KDA de una partida; con 0 muertes devuelve K + A. */
export function matchKda(kills, deaths, assists) {
  return deaths === 0 ? kills + assists : (kills + assists) / deaths;
}

/** KDA de una fila de `matches`. Un dato no registrado cuenta como 0 (criterio de Estadísticas). */
export function matchRowKda(match) {
  return matchKda(Number(match?.kills) || 0, Number(match?.deaths) || 0, Number(match?.assists) || 0);
}

/**
 * KDA promedio: el promedio del KDA de cada partida. Es la fórmula de Estadísticas y la
 * usan todas las pantallas (Dashboard, ficha de campeón, tarjeta compartible) para que el
 * número coincida. null sin partidas.
 */
export function averageMatchKda(matches) {
  return matches?.length ? sumOf(matches.map(matchRowKda)) / matches.length : null;
}

/**
 * Pool de campeones de un grupo de partidas (el Dashboard lo usa con las de los últimos
 * 7 días): los más jugados primero y, a igual cantidad, el de mejor winrate.
 * @returns {{ champion: string, games: number, wins: number, wr: number, kda: number }[]}
 */
export function championPool(matches, limit = 4) {
  const byChampion = new Map();
  (matches || []).forEach(match => {
    const champion = String(match?.own_champion_name || '').trim();
    if (!champion) return;
    const key = champion.toLowerCase();
    const entry = byChampion.get(key) || { champion, rows: [] };
    entry.rows.push(match);
    byChampion.set(key, entry);
  });
  return [...byChampion.values()]
    .map(({ champion, rows }) => {
      const wins = rows.filter(row => row.result === 'win').length;
      return { champion, games: rows.length, wins, wr: winratePct(wins, rows.length), kda: averageMatchKda(rows) };
    })
    .sort((a, b) => b.games - a.games || b.wr - a.wr || b.kda - a.kda)
    .slice(0, limit);
}

/**
 * Récord de cada build guardada con las partidas vinculadas (matches.build_id):
 * Map(id de la build → { games, wins, losses }).
 */
export function recordsByBuild(matches) {
  const records = new Map();
  (matches || []).forEach(match => {
    if (match?.build_id == null || (match.result !== 'win' && match.result !== 'loss')) return;
    const key = String(match.build_id);
    const record = records.get(key) || { games: 0, wins: 0, losses: 0 };
    record.games += 1;
    if (match.result === 'win') record.wins += 1;
    else record.losses += 1;
    records.set(key, record);
  });
  return records;
}
