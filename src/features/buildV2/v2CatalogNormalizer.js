const asArray = value => Array.isArray(value) ? value : value == null ? [] : [value];
const hasType = (item, type) => asArray(item?.type).some(value =>
  String(value).localeCompare(type, 'es', { sensitivity: 'base' }) === 0
);

export const isMovementItem = item => hasType(item, 'Movimiento');
export const isEnchantment = item => hasType(item, 'Encantamiento');
export const isImprovedItem = item => item?.category === 'Mejorado';
export const isValidCatalogEntity = entity => String(entity?.id || '').trim().length > 0;

export const isCoreItem = item =>
  isValidCatalogEntity(item) && item?.active !== false && isImprovedItem(item) &&
  !isMovementItem(item) && !isEnchantment(item);

export const isImprovedMovementItem = item =>
  isValidCatalogEntity(item) && item?.active !== false && isImprovedItem(item) && isMovementItem(item);

function requireColumns(entities, required, label) {
  if (!entities.length) throw new Error(`${label} está vacío.`);
  const missing = required.filter(column => !Object.prototype.hasOwnProperty.call(entities[0], column));
  if (missing.length) throw new Error(`${label} no expone columnas estratégicas requeridas: ${missing.join(', ')}.`);
}

export function normalizeV2Snapshot(raw) {
  requireColumns(raw.champions || [], ['traits', 'item_scalings', 'vulnerabilities'], 'current_champions');
  requireColumns(raw.items || [], ['effect_tags', 'situational_role'], 'current_wr_items');
  requireColumns(raw.runes || [], ['trigger_tags', 'benefit_tags', 'branch', 'group'], 'current_runes');
  requireColumns(raw.spells || [], ['description'], 'spells');
  const champions = (raw.champions || []).filter(isValidCatalogEntity);
  const items = (raw.items || []).filter(isValidCatalogEntity);
  const runes = (raw.runes || []).filter(isValidCatalogEntity);
  const spells = (raw.spells || []).filter(isValidCatalogEntity);
  const patchIds = new Set([
    ...champions.map(x => x.patch_id), ...items.map(x => x.patch_id), ...runes.map(x => x.patch_id),
  ].filter(value => value != null).map(String));
  const patchVersions = new Set([
    ...champions.map(x => x.patch_version), ...items.map(x => x.patch_version), ...runes.map(x => x.patch_version),
  ].filter(Boolean));

  if (patchIds.size !== 1 || patchVersions.size !== 1) {
    throw new Error('Los catálogos current_* no pertenecen a un único parche activo.');
  }

  return {
    loadedAt: raw.loadedAt || new Date().toISOString(),
    patchId: [...patchIds][0],
    patchVersion: [...patchVersions][0],
    champions,
    items,
    coreItems: items.filter(isCoreItem),
    movementItems: items.filter(isImprovedMovementItem),
    runes,
    spells,
  };
}
