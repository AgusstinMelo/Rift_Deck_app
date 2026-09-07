import { v2BuildSchema } from './v2Schema.js';
import { isCoreItem, isImprovedMovementItem } from './v2CatalogNormalizer.js';

const duplicates = ids => new Set(ids).size !== ids.length;

export function validateV2Result(value, snapshot, context = {}) {
  const parsed = v2BuildSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, schemaErrors: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`), validationErrors: [] };
  }

  const result = parsed.data;
  const errors = [];
  const itemMap = new Map(snapshot.items.map(x => [String(x.id), x]));
  const runeMap = new Map(snapshot.runes.map(x => [String(x.id), x]));
  const spellMap = new Map(snapshot.spells.map(x => [String(x.id), x]));
  const coreIds = result.core_items.map(x => x.id);
  const runeIds = [result.keystone.id, ...result.primary_runes.map(x => x.id), result.secondary_rune.id];
  const spellIds = result.spells.map(x => x.id);

  if (duplicates(coreIds)) errors.push('Los 5 core_items deben ser Ãºnicos.');
  for (const id of coreIds) {
    const item = itemMap.get(id);
    if (!item) errors.push(`Item core inexistente en el snapshot: ${id}.`);
    else if (!isCoreItem(item)) errors.push(`El item core ${id} no es un objeto final core vÃ¡lido.`);
  }

  const movement = itemMap.get(result.movement_item.id);
  if (!movement) errors.push(`Movement item inexistente en el snapshot: ${result.movement_item.id}.`);
  else if (!isImprovedMovementItem(movement)) errors.push(`El movement item ${movement.id} no es una mejora final de movimiento.`);
  if (coreIds.includes(result.movement_item.id)) errors.push('El objeto de movimiento no puede ocupar un slot core.');

  const keystone = runeMap.get(result.keystone.id);
  if (!keystone) errors.push(`Keystone inexistente en el snapshot: ${result.keystone.id}.`);
  else if (keystone.branch !== 'Clave') errors.push('La keystone seleccionada no pertenece a la rama Clave.');

  const primary = result.primary_runes.map(x => runeMap.get(x.id));
  primary.forEach((rune, index) => {
    if (!rune) errors.push(`Runa primaria inexistente en el snapshot: ${result.primary_runes[index].id}.`);
    else if (rune.branch === 'Clave') errors.push(`La runa primaria ${rune.id} no puede ser keystone.`);
  });
  const primaryBranches = new Set(primary.filter(Boolean).map(x => x.branch));
  const primaryGroups = primary.filter(Boolean).map(x => String(x.group));
  if (primaryBranches.size !== 1) errors.push('Las tres runas primarias deben pertenecer a la misma rama.');
  if (new Set(primaryGroups).size !== 3) errors.push('Las tres runas primarias deben pertenecer a grupos distintos.');

  const secondary = runeMap.get(result.secondary_rune.id);
  if (!secondary) errors.push(`Runa secundaria inexistente en el snapshot: ${result.secondary_rune.id}.`);
  else {
    if (secondary.branch === 'Clave') errors.push('La runa secundaria no puede ser keystone.');
    if (primaryBranches.has(secondary.branch)) errors.push('La runa secundaria debe pertenecer a otra rama.');
  }
  if (duplicates(runeIds)) errors.push('No puede haber runas duplicadas.');

  if (duplicates(spellIds)) errors.push('Los dos hechizos deben ser distintos.');
  for (const id of spellIds) if (!spellMap.has(id)) errors.push(`Hechizo inexistente en el snapshot: ${id}.`);
  if (String(context.role || '').toLowerCase() === 'jungler') {
    const selected = result.spells.map(x => spellMap.get(x.id)?.name?.toLowerCase());
    if (!selected.includes('castigo')) errors.push('El rol Jungler requiere Castigo.');
  }

  return { ok: errors.length === 0, data: result, schemaErrors: [], validationErrors: errors };
}
