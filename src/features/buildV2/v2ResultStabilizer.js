const normalizeText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const STOP_WORDS = new Set(['para', 'como', 'esta', 'este', 'build', 'runa', 'objeto', 'daño', 'dano', 'enemigo', 'aliado', 'desde', 'entre']);

const relevanceTokens = result => [...new Set(normalizeText([
  result?.build_theme,
  result?.win_condition,
  result?.matchup_read,
  result?.build_plan?.primary_archetype,
  result?.build_plan?.target_damage_profile,
].filter(Boolean).join(' ')).split(/[^a-z0-9]+/).filter(token => token.length > 3 && !STOP_WORDS.has(token)))];

const searchableEntity = entity => normalizeText([
  entity?.name,
  entity?.description,
  entity?.effect,
  entity?.stats,
  entity?.tags,
  entity?.effect_tags,
  entity?.trigger_tags,
  entity?.benefit_tags,
].flat().filter(Boolean).join(' '));

function bestCandidate(candidates, result, usedIds = new Set()) {
  const tokens = relevanceTokens(result);
  return candidates
    .filter(candidate => !usedIds.has(String(candidate.id)))
    .map((candidate, index) => ({
      candidate,
      index,
      score: tokens.reduce((total, token) => total + (searchableEntity(candidate).includes(token) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.candidate;
}

const fallbackReason = (entity, purpose, result) => {
  const detail = String(entity?.description || entity?.effect || '').trim();
  if (detail) return `${purpose} ${detail}`;
  return `${purpose} Mantiene la selección coherente con ${result?.build_theme || 'el plan de la build'}.`;
};

function stabilizeCoreItems(result, snapshot) {
  const itemMap = new Map(snapshot.coreItems.map(item => [String(item.id), item]));
  const used = new Set();
  const selected = [];
  for (const selection of result.core_items || []) {
    const id = String(selection?.id || '');
    if (!itemMap.has(id) || used.has(id)) continue;
    used.add(id);
    selected.push(selection);
  }
  while (selected.length < 5) {
    const item = bestCandidate(snapshot.coreItems, result, used);
    if (!item) break;
    const id = String(item.id);
    used.add(id);
    selected.push({ id, reason: fallbackReason(item, 'Completa el núcleo sin repetir objetos.', result) });
  }
  const ordered = selected.slice(0, 5);
  const deferred = itemMap.size
    ? ordered.filter(selection => {
        const item = itemMap.get(String(selection.id));
        const role = normalizeText(item?.situational_role);
        return role.includes('late') || role.includes('tardio') || role.includes('tardío');
      })
    : [];
  const immediate = ordered.filter(selection => !deferred.includes(selection));
  let stabilized = [...immediate, ...deferred];

  const infinityIndex = stabilized.findIndex(selection =>
    normalizeText(itemMap.get(String(selection.id))?.name) === 'filo del infinito'
  );
  if (infinityIndex >= 0 && infinityIndex !== 2) {
    const [infinityEdge] = stabilized.splice(infinityIndex, 1);
    stabilized.splice(Math.min(2, stabilized.length), 0, {
      ...infinityEdge,
      reason: 'Se reserva para el tercer objeto, cuando la build ya acumuló una base de crítico que permite aprovechar su multiplicador.',
    });
  }
  return stabilized;
}

function stabilizeRunes(result, snapshot) {
  const runeMap = new Map(snapshot.runes.map(rune => [String(rune.id), rune]));
  const keystones = snapshot.runes.filter(rune => rune.branch === 'Clave');
  const regular = snapshot.runes.filter(rune => rune.branch !== 'Clave');
  const viableBranches = [...new Set(regular.map(rune => rune.branch))]
    .filter(branch => [1, 2, 3].every(group => regular.some(rune => rune.branch === branch && Number(rune.group) === group)));
  const originalPrimary = (result.primary_runes || []).map(selection => ({
    selection,
    rune: runeMap.get(String(selection?.id)),
  }));
  const preferredBranch = viableBranches
    .map((branch, index) => ({
      branch,
      index,
      matches: originalPrimary.filter(entry => entry.rune?.branch === branch).length,
      firstMatch: originalPrimary.findIndex(entry => entry.rune?.branch === branch),
    }))
    .sort((a, b) => b.matches - a.matches || (a.firstMatch < 0 ? 99 : a.firstMatch) - (b.firstMatch < 0 ? 99 : b.firstMatch) || a.index - b.index)[0]?.branch;

  const used = new Set();
  const primaryRunes = [1, 2, 3].map(group => {
    const existing = originalPrimary.find(entry =>
      entry.rune?.branch === preferredBranch &&
      Number(entry.rune?.group) === group &&
      !used.has(String(entry.rune.id))
    );
    if (existing) {
      used.add(String(existing.rune.id));
      return existing.selection;
    }
    const rune = bestCandidate(
      regular.filter(candidate => candidate.branch === preferredBranch && Number(candidate.group) === group),
      result,
      used,
    );
    if (!rune) return null;
    used.add(String(rune.id));
    return {
      id: String(rune.id),
      reason: fallbackReason(rune, `Completa el grupo ${group} de ${preferredBranch}.`, result),
    };
  }).filter(Boolean);

  const currentSecondary = runeMap.get(String(result.secondary_rune?.id));
  const alternateOriginal = originalPrimary.find(entry =>
    entry.rune?.branch !== 'Clave' &&
    entry.rune?.branch !== preferredBranch &&
    !used.has(String(entry.rune.id))
  );
  const secondaryRune = currentSecondary &&
    currentSecondary.branch !== 'Clave' &&
    currentSecondary.branch !== preferredBranch &&
    !used.has(String(currentSecondary.id))
    ? result.secondary_rune
    : alternateOriginal?.selection || (() => {
        const rune = bestCandidate(regular.filter(candidate => candidate.branch !== preferredBranch), result, used);
        return rune ? { id: String(rune.id), reason: fallbackReason(rune, 'Aporta una rama secundaria diferente.', result) } : result.secondary_rune;
      })();

  const currentKeystone = runeMap.get(String(result.keystone?.id));
  const keystone = currentKeystone?.branch === 'Clave'
    ? result.keystone
    : (() => {
        const rune = bestCandidate(keystones, result);
        return rune ? { id: String(rune.id), reason: fallbackReason(rune, 'Define la runa clave del plan.', result) } : result.keystone;
      })();

  return { keystone, primaryRunes, secondaryRune };
}

function stabilizeSpells(result, snapshot, role) {
  const spellMap = new Map(snapshot.spells.map(spell => [String(spell.id), spell]));
  const smite = snapshot.spells.find(spell => normalizeText(spell.name) === 'castigo');
  const isJungler = normalizeText(role) === 'jungler';
  const used = new Set();
  const selected = [];

  for (const selection of result.spells || []) {
    const spell = spellMap.get(String(selection?.id));
    if (!spell || used.has(String(spell.id))) continue;
    if (!isJungler && smite && String(spell.id) === String(smite.id)) continue;
    used.add(String(spell.id));
    selected.push(selection);
  }
  if (isJungler && smite && !used.has(String(smite.id))) {
    used.add(String(smite.id));
    selected.unshift({ id: String(smite.id), reason: fallbackReason(smite, 'Es obligatorio para la posición de jungla.', result) });
  }
  while (selected.length < 2) {
    const spell = bestCandidate(
      snapshot.spells.filter(candidate => isJungler || !smite || String(candidate.id) !== String(smite.id)),
      result,
      used,
    );
    if (!spell) break;
    used.add(String(spell.id));
    selected.push({ id: String(spell.id), reason: fallbackReason(spell, 'Complementa los hechizos de la build.', result) });
  }
  return selected.slice(0, 2);
}

export function stabilizeV2Result(value, snapshot, context = {}) {
  if (!value || typeof value !== 'object') return value;
  const result = {
    ...value,
    core_items: Array.isArray(value.core_items) ? value.core_items.map(item => ({ ...item })) : value.core_items,
    primary_runes: Array.isArray(value.primary_runes) ? value.primary_runes.map(rune => ({ ...rune })) : value.primary_runes,
    spells: Array.isArray(value.spells) ? value.spells.map(spell => ({ ...spell })) : value.spells,
  };
  const runes = stabilizeRunes(result, snapshot);
  const coreItems = stabilizeCoreItems(result, snapshot);
  const itemMap = new Map(snapshot.coreItems.map(item => [String(item.id), item]));
  const firstItem = itemMap.get(String(coreItems[0]?.id));
  const infinitySlot = coreItems.findIndex(selection =>
    normalizeText(itemMap.get(String(selection.id))?.name) === 'filo del infinito'
  );
  const buildPlan = infinitySlot >= 2
    ? {
        ...result.build_plan,
        first_item_rationale: `${firstItem?.name || 'El primer objeto'} abre la curva por su valor inmediato; Filo del Infinito se reserva para el slot ${infinitySlot + 1}, después de acumular una base de crítico.`,
      }
    : result.build_plan;

  return {
    ...result,
    build_plan: buildPlan,
    core_items: coreItems,
    keystone: runes.keystone,
    primary_runes: runes.primaryRunes,
    secondary_rune: runes.secondaryRune,
    spells: stabilizeSpells(result, snapshot, context.role),
  };
}
