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
