// Carga con capturas: pasa los campos extraídos (respuesta de extract-match-capture, con
// códigos de la lámina de campeones) y los íconos identificados por comparación de
// píxeles (objetos, runas, hechizos) a la precarga del formulario manual
// (MatchBuilder `initialMatch`). Todo queda completo salvo el lado del mapa.
// Sin dependencias de React ni de alias (@/) para poder testearlo con node --test.

export const LANES = ['top', 'jungler', 'mid', 'adc', 'support'];
const MATCH_TYPE_VALUES = ['ranked', 'legendary_ranked', 'casual'];

// Campo extraído → clave de texto (matchCapture.fields.*) para el aviso de "revisá".
export const REVIEW_LABEL_KEYS = {
  champion: 'champion',
  lane: 'lane',
  result: 'result',
  match_type: 'type',
  kills: 'kills',
  deaths: 'deaths',
  assists: 'assists',
  duration_seconds: 'duration',
  gold: 'gold',
  allies: 'allies',
  enemies: 'enemies',
};

/**
 * Equipo leído (códigos C) → [{ name, role }] con roles únicos: respeta la línea leída si
 * está libre y reparte el resto en las líneas libres, en orden.
 * @param {Array<{ champion: string, lane: string | null }> | null} members
 * @param {Map<string, { id: any, name: string }>} championsByCode
 * @param {{ takenRoles?: string[], excludeNames?: string[] }} options
 */
export function teamToSlots(members, championsByCode, { takenRoles = [], excludeNames = [] } = {}) {
  const taken = new Set(takenRoles);
  const seen = new Set(excludeNames);
  const resolved = [];
  for (const member of members || []) {
    const champion = championsByCode.get(member.champion);
    if (!champion || seen.has(champion.name)) continue;
    seen.add(champion.name);
    resolved.push({ name: champion.name, lane: member.lane });
  }
  const slots = [];
  const pending = [];
  for (const entry of resolved) {
    if (entry.lane && LANES.includes(entry.lane) && !taken.has(entry.lane)) {
      taken.add(entry.lane);
      slots.push({ name: entry.name, role: entry.lane });
    } else {
      pending.push(entry);
    }
  }
  const free = LANES.filter(lane => !taken.has(lane));
  pending.slice(0, free.length).forEach((entry, index) => slots.push({ name: entry.name, role: free[index] }));
  return slots;
}

/** Códigos → nombres del catálogo (sin repetidos ni códigos desconocidos). */
export function codesToNames(codes, byCode) {
  const names = (codes || []).map(code => byCode.get(code)?.name).filter(Boolean);
  return [...new Set(names)];
}

/** Segundos → minutos enteros (la tabla guarda duration_minutes). */
export const secondsToMinutes = seconds =>
  Number.isFinite(seconds) && seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : null;

const pad = number => String(number).padStart(2, '0');

const ICON_KINDS = ['items', 'runes', 'spells'];
const LOCAL_TEXT_KEYS = ['kills', 'deaths', 'assists', 'gold', 'result', 'match_type', 'duration_seconds'];

/**
 * Suma la lectura local del texto del marcador (K/D/A, oro, resultado: ver
 * scoreboardText.js) a lo que leyó el modelo. Si la lectura local es segura, manda;
 * si es dudosa, solo completa lo que el modelo no leyó y queda para revisar.
 */
export function mergeLocalText(modelFields, localText) {
  const fields = { ...(modelFields || {}) };
  if (!localText) return fields;
  for (const key of LOCAL_TEXT_KEYS) {
    const local = localText[key];
    if (!local || local.value === null || local.value === undefined) continue;
    const model = fields[key];
    if (local.confidence === 'high') {
      fields[key] = { value: local.value, confidence: 'high', needsReview: false, conflict: false };
    } else if (!model || model.value === null) {
      fields[key] = { value: local.value, confidence: local.confidence, needsReview: true, conflict: false };
    }
  }
  return fields;
}

/**
 * Precarga del formulario manual a partir de los campos unificados y los íconos.
 * Fecha y hora: las de ahora (la pantalla de resultados no las muestra); parche: el
 * actual; tipo: el leído o, si no, clasificatoria. El lado queda vacío.
 * Un tipo de ícono se marca para revisar si no se encontró o si alguno no tiene
 * confianza alta.
 * @param {Record<string, { value: any, needsReview?: boolean }>} fields
 * @param {{ champions: Map }} codeMaps  (ver buildCodeMaps)
 * @param {{ defaultPatch?: string, now?: Date, icons?: { items?: any[], runes?: any[], spells?: any[] }, scoreboard?: object | null }} options
 *   icons: [{ name, confidence }] por tipo (runas: runesFromModelNames / identifyRunesIn).
 *   scoreboard: lectura local del marcador (identifyScoreboard). Si está, manda sobre lo
 *   que leyó el modelo para campeones, líneas, objetos y hechizos (es más precisa).
 */
export function fieldsToPrefill(modelFields, codeMaps, { defaultPatch = '', now = new Date(), icons: modelIcons = {}, scoreboard = null } = {}) {
  const fields = mergeLocalText(modelFields, scoreboard?.text);
  const value = key => fields?.[key]?.value ?? null;
  const known = list => (list || []).filter(entry => entry && !entry.empty && entry.name);
  const allHigh = list => list.length > 0 && list.every(entry => entry.confidence === 'high');

  let own = codeMaps.champions.get(value('champion')) || null;
  let lane = LANES.includes(value('lane')) ? value('lane') : '';
  let allies = teamToSlots(value('allies'), codeMaps.champions, {
    takenRoles: lane ? [lane] : [],
    excludeNames: own ? [own.name] : [],
  });
  let enemies = teamToSlots(value('enemies'), codeMaps.champions);
  const icons = { ...modelIcons };
  // Qué revisar según la lectura local del marcador (clave → necesita revisión).
  const localReview = {};

  if (scoreboard) {
    if (scoreboard.own?.name) own = { name: scoreboard.own.name };
    lane = scoreboard.ownLane || lane;
    allies = known(scoreboard.allies).map(entry => ({ name: entry.name, role: entry.lane }));
    enemies = known(scoreboard.enemies).map(entry => ({ name: entry.name, role: entry.lane }));
    icons.items = known(scoreboard.items);
    icons.spells = known(scoreboard.spells);
    localReview.champion = !scoreboard.own?.name || scoreboard.own.confidence !== 'high';
    localReview.lane = false;
    localReview.allies = !allHigh(known(scoreboard.allies));
    localReview.enemies = !allHigh(known(scoreboard.enemies));
  }
  const numberOrNull = key => (Number.isInteger(value(key)) ? value(key) : null);

  const review = Object.keys(REVIEW_LABEL_KEYS).filter(key => {
    if (key in localReview) return localReview[key];
    const field = fields?.[key];
    if (key === 'champion' && !own) return true;
    return !field || field.value === null || field.needsReview;
  }).map(key => REVIEW_LABEL_KEYS[key]);
  for (const kind of ICON_KINDS) {
    const list = icons[kind] || [];
    if (!list.length || list.some(icon => icon.confidence !== 'high')) review.push(kind);
  }
  const iconNames = kind => [...new Set((icons[kind] || []).map(icon => icon.name).filter(Boolean))];

  return {
    patch: defaultPatch,
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    hour: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    type: MATCH_TYPE_VALUES.includes(value('match_type')) ? value('match_type') : 'ranked',
    lane,
    own_champion_name: own?.name || '',
    allies,
    enemies,
    // Objetos: se permiten repetidos (por ejemplo, dos Espadas Largas).
    items_used: (icons.items || []).map(icon => icon.name).filter(Boolean),
    runes_used: iconNames('runes'),
    spells_used: iconNames('spells').slice(0, 2),
    result: value('result') === 'loss' ? 'loss' : 'win',
    kills: numberOrNull('kills'),
    deaths: numberOrNull('deaths'),
    assists: numberOrNull('assists'),
    gold: numberOrNull('gold'),
    duration_minutes: secondsToMinutes(value('duration_seconds')),
    review,
  };
}

/**
 * Ramas de runas a partir de las runas elegidas: la principal es la que más runas
 * tiene (sin contar la clave) y la secundaria, la otra.
 * @param {Array<{ branch: string }>} runes
 * @param {string[]} branches  ramas posibles, en orden
 */
export function runeBranchesFor(runes, branches) {
  const counts = new Map();
  for (const rune of runes) {
    if (rune.branch && rune.branch !== 'Clave') counts.set(rune.branch, (counts.get(rune.branch) || 0) + 1);
  }
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([branch]) => branch);
  const primary = ordered[0] || branches[0];
  const secondary = ordered.find(branch => branch !== primary) || branches.find(branch => branch !== primary);
  return { primary, secondary };
}
