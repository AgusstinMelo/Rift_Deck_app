import { tr } from '../../i18n/uiI18n.js';
import { runeBranchLabel } from '../../utils/runeBranches.js';
import { fitOf } from './v2DraftProfile.js';
import { auditCoreItems, auditRunesAndSpells } from './v2BuildAudit.js';

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

/**
 * Encaje de una runa o un hechizo con el campeón y el draft (`fit` sale de
 * draftFitContext): su clase y su línea pesan más que coincidir palabras con el plan, y
 * suma cada señal del rival a la que responde.
 */
function fitBonus(candidate, fit) {
  if (!fit) return 0;
  const { fitsClass, fitsLane, answers } = fitOf(candidate, fit);
  return (fitsClass === true ? 2 : fitsClass === false ? -2 : 0)
    + (fitsLane === true ? 1 : fitsLane === false ? -3 : 0)
    + answers.length * 1.5;
}

function bestCandidate(candidates, result, usedIds = new Set(), fit = null) {
  const tokens = relevanceTokens(result);
  return candidates
    .filter(candidate => !usedIds.has(String(candidate.id)))
    .map((candidate, index) => ({
      candidate,
      index,
      score: tokens.reduce((total, token) => total + (searchableEntity(candidate).includes(token) ? 1 : 0), 0)
        + fitBonus(candidate, fit),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.candidate;
}

// Las piezas reemplazadas pierden la razón que escribió la IA. No se rellena con la
// descripción del catálogo: se explica el motivo del reemplazo y su encaje con el plan.
const fallbackReason = (entity, purpose, result) => {
  const plan = result?.build_plan?.primary_archetype || result?.build_theme;
  return plan
    ? `${purpose} ${tr('buildV2.stabilizer.bestFitPlan', { plan })}`
    : `${purpose} ${tr('buildV2.stabilizer.bestFitBuild')}`;
};

const MAX_ITEM_EXPLANATION_LENGTH = 220;

function cleanCatalogText(value, entityName = '') {
  let text = String(value || '')
    .replace(/\\[nr]+/gi, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const escapedName = String(entityName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (escapedName) text = text.replace(new RegExp(`^${escapedName}\\s*:\\s*`, 'i'), '');
  if (text.length <= MAX_ITEM_EXPLANATION_LENGTH) return text;

  const shortened = text.slice(0, MAX_ITEM_EXPLANATION_LENGTH + 1);
  const boundary = Math.max(shortened.lastIndexOf('. '), shortened.lastIndexOf('; '), shortened.lastIndexOf(' '));
  return `${shortened.slice(0, boundary > 120 ? boundary : MAX_ITEM_EXPLANATION_LENGTH).replace(/[,:;.]$/, '')}…`;
}

// Para encadenar la razón dentro de una frase ("... porque aporta"), sin tocar siglas como "AP".
const lowerFirst = text => /^\p{Lu}\p{Ll}/u.test(text) ? text[0].toLowerCase() + text.slice(1) : text;

// Nombre visible de la pieza en el idioma activo; el snapshot trae los nombres en español.
const defaultNameOf = entity => entity?.name || '';

const selectionReason =(selection, entity, result) => cleanCatalogText(
  selection?.reason,
  entity?.name,
) || fallbackReason(entity, tr('buildV2.stabilizer.complementsPlan'), result);

function synchronizeItemExplanations(buildPlan, coreItems, snapshot, result, nameOf) {
  const itemMap = new Map(snapshot.coreItems.map(item => [String(item.id), item]));
  const selected = coreItems
    .map(selection => ({ selection, entity: itemMap.get(String(selection.id)) }))
    .filter(entry => Boolean(entry.entity));
  const firstItem = selected[0];
  const infinitySlot = selected.findIndex(({ entity }) => normalizeText(entity.name) === 'filo del infinito');
  const orderingNote = infinitySlot >= 2
    ? ` ${tr('buildV2.stabilizer.infinityReserved', { item: nameOf(selected[infinitySlot].entity), slot: infinitySlot + 1 })}`
    : '';
  return {
    ...buildPlan,
    first_item_rationale: firstItem
      ? `${tr('buildV2.stabilizer.boughtFirst', { item: nameOf(firstItem.entity), reason: lowerFirst(selectionReason(firstItem.selection, firstItem.entity, result)) })}${orderingNote}`
      : buildPlan?.first_item_rationale,
    // Generate this copy after stabilization. Text written for replaced IDs is stale.
    item_relationships: selected.map(({ selection, entity }) =>
      `${nameOf(entity)}: ${selectionReason(selection, entity, result)}`
    ),
  };
}

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
    selected.push({ id, reason: fallbackReason(item, tr('buildV2.stabilizer.completesCore'), result) });
  }
  // El orden lo decide la IA; la auditoría (v2BuildAudit.js) solo corrige reglas firmes.
  return selected.slice(0, 5);
}

function stabilizeRunes(result, snapshot, fit = null) {
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
      fit,
    );
    if (!rune) return null;
    used.add(String(rune.id));
    return {
      id: String(rune.id),
      reason: fallbackReason(rune, tr('buildV2.stabilizer.completesRuneGroup', { group, branch: runeBranchLabel(preferredBranch) }), result),
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
        const rune = bestCandidate(regular.filter(candidate => candidate.branch !== preferredBranch), result, used, fit);
        return rune ? { id: String(rune.id), reason: fallbackReason(rune, tr('buildV2.stabilizer.secondaryBranch'), result) } : result.secondary_rune;
      })();

  const currentKeystone = runeMap.get(String(result.keystone?.id));
  const keystone = currentKeystone?.branch === 'Clave'
    ? result.keystone
    : (() => {
        const rune = bestCandidate(keystones, result, new Set(), fit);
        return rune ? { id: String(rune.id), reason: fallbackReason(rune, tr('buildV2.stabilizer.definesKeystone'), result) } : result.keystone;
      })();

  return { keystone, primaryRunes, secondaryRune };
}

function stabilizeSpells(result, snapshot, role, fit = null) {
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
    selected.unshift({ id: String(smite.id), reason: fallbackReason(smite, tr('buildV2.stabilizer.smiteRequired'), result) });
  }
  while (selected.length < 2) {
    const spell = bestCandidate(
      snapshot.spells.filter(candidate => isJungler || !smite || String(candidate.id) !== String(smite.id)),
      result,
      used,
      fit,
    );
    if (!spell) break;
    used.add(String(spell.id));
    selected.push({ id: String(spell.id), reason: fallbackReason(spell, tr('buildV2.stabilizer.complementsSpells'), result) });
  }
  return selected.slice(0, 2);
}

/** Suma las notas de la auditoría a key_adaptations sin pasar de 4: reemplazan a las últimas. */
function withAuditNotes(adaptations, notes) {
  if (!notes.length || !Array.isArray(adaptations)) return adaptations;
  const keep = Math.max(0, Math.min(adaptations.length, 4 - notes.length));
  return [...adaptations.slice(0, keep), ...notes].slice(0, 4);
}

/**
 * Red de seguridad para los textos visibles: si la IA filtra un valor interno de los datos
 * ("al_impacto", "daño_sostenido"), se escribe con espacios. Los IDs no se tocan.
 */
const INTERNAL_TOKEN = /[\p{L}\d]+(?:_[\p{L}\d]+)+/gu;
const humanize = text => text.replace(INTERNAL_TOKEN, token => token.replace(/_/g, ' '));
function humanizeTexts(value, key = '') {
  if (key === 'id') return value;
  if (typeof value === 'string') return humanize(value);
  if (Array.isArray(value)) return value.map(entry => humanizeTexts(entry));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([field, entry]) => [field, humanizeTexts(entry, field)]));
  }
  return value;
}

export function stabilizeV2Result(rawValue, snapshot, context = {}) {
  if (!rawValue || typeof rawValue !== 'object') return rawValue;
  const value = humanizeTexts(rawValue);
  const result = {
    ...value,
    core_items: Array.isArray(value.core_items) ? value.core_items.map(item => ({ ...item })) : value.core_items,
    primary_runes: Array.isArray(value.primary_runes) ? value.primary_runes.map(rune => ({ ...rune })) : value.primary_runes,
    spells: Array.isArray(value.spells) ? value.spells.map(spell => ({ ...spell })) : value.spells,
  };
  const stableRunes = stabilizeRunes(result, snapshot, context.fit);
  const nameOf = context.nameOf || defaultNameOf;
  // Runas y hechizos que no son para la clase del campeón (fits_classes).
  const pieces = auditRunesAndSpells({
    ...stableRunes, spells: stabilizeSpells(result, snapshot, context.role, context.fit),
    snapshot, fit: context.fit, themed: Boolean(context.themed), role: context.role, nameOf,
  });
  const runes = pieces;
  const audit = auditCoreItems({ coreItems: stabilizeCoreItems(result, snapshot), snapshot, fit: context.fit, themed: Boolean(context.themed), nameOf });
  const coreItems = audit.coreItems;
  // Para el registro de intervenciones (build_v2_audit_log).
  context.onAudit?.({ itemChanges: audit.changes, runeChanges: pieces.changes.runes, spellChanges: pieces.changes.spells });
  const itemMap = new Map(snapshot.coreItems.map(item => [String(item.id), item]));
  const firstItem = itemMap.get(String(coreItems[0]?.id));
  const infinitySlot = coreItems.findIndex(selection =>
    normalizeText(itemMap.get(String(selection.id))?.name) === 'filo del infinito'
  );
  const buildPlan = infinitySlot >= 2
    ? {
        ...result.build_plan,
        first_item_rationale: tr('buildV2.stabilizer.opensCurve', {
          item: firstItem ? nameOf(firstItem) : tr('buildV2.stabilizer.firstItem'),
          infinity: nameOf(itemMap.get(String(coreItems[infinitySlot].id))),
          slot: infinitySlot + 1,
        }),
      }
    : result.build_plan;

  const synchronizedBuildPlan = synchronizeItemExplanations(buildPlan, coreItems, snapshot, result, nameOf);

  return {
    ...result,
    // Lo que corrigió la auditoría se cuenta en las adaptaciones (máximo 4).
    key_adaptations: withAuditNotes(result.key_adaptations, [...audit.notes, ...pieces.notes]),
    build_plan: synchronizedBuildPlan,
    core_items: coreItems,
    keystone: runes.keystone,
    primary_runes: runes.primaryRunes,
    secondary_rune: runes.secondaryRune,
    spells: pieces.spells,
  };
}
