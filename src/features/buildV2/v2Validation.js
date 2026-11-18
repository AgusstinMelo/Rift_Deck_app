import { v2BuildSchema } from './v2Schema.js';
import { isCoreItem, isImprovedMovementItem } from './v2CatalogNormalizer.js';
import { itemRulesFor } from './v2ItemRules.js';

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

  if (duplicates(coreIds)) errors.push('Los 5 core_items deben ser únicos.');
  const rules = itemRulesFor(snapshot.items);
  const support = String(context.role || '').toLowerCase() === 'support';
  for (const id of coreIds) {
    const item = itemMap.get(id);
    if (!item) errors.push(`Item core inexistente en el snapshot: ${id}.`);
    else if (rules.isEvolved(item)) errors.push(`El item core ${id} es una evolución: no se compra, se arma el objeto base.`);
    else if (!isCoreItem(item) && !(support && rules.isSupportStarter(item))) errors.push(`El item core ${id} no es un objeto final core válido.`);
  }
  // Reglas del juego (v2ItemRules.js): un solo objeto de Lágrima de la Diosa y, en Support,
  // el objeto de soporte inicial en el slot 1.
  const coreRows = coreIds.map(id => itemMap.get(id)).filter(Boolean);
  if (coreRows.filter(rules.isTear).length > 1) errors.push('Solo puede haber un objeto de Lágrima de la Diosa (Manamune, Báculo del Arcángel, Llegada del Invierno, Tiara Susurrante).');
  if (support) {
    if (!coreRows[0] || !rules.isSupportStarter(coreRows[0])) errors.push('En Support, el core_item 1 debe ser el objeto de soporte inicial (Guadaña de Niebla Oscura o Baluarte de la Montaña).');
    if (coreRows.filter(rules.isSupportStarter).length > 1) errors.push('Solo puede haber un objeto de soporte inicial.');
  } else if (coreRows.some(rules.isSupportStarter)) {
    errors.push('El objeto de soporte inicial solo se arma en Support.');
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
  const selectedSpellNames = result.spells.map(x => spellMap.get(x.id)?.name?.trim().toLowerCase());
  if (String(context.role || '').toLowerCase() === 'jungler') {
    if (!selectedSpellNames.includes('castigo')) errors.push('El rol Jungler requiere Castigo.');
  } else if (selectedSpellNames.includes('castigo')) {
    errors.push('Castigo solo puede seleccionarse para el rol Jungler.');
  }

  return { ok: errors.length === 0, data: result, schemaErrors: [], validationErrors: errors };
}
