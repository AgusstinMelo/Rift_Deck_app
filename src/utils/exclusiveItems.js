// Objetos que el juego no deja llevar juntos: de cada grupo, uno solo por build. Lo usan el
// armador manual (BuildWorkspace, ItemBrowser) y Build V2 (v2ItemRules: validación,
// auditoría y prompt). Nombres del catálogo, sin acentos ni mayúsculas.

const normalize = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

export const EXCLUSIVE_ITEM_GROUPS = [
  { key: 'penetracionArmadura', items: ['terminus', 'recordatorio mortal', 'rencor de serylda', 'recuerdos de lord dominik'] },
  { key: 'penetracionMagica', items: ['baculo del vacio', 'criptorretono', 'maldicion de la vampiresa'] },
  { key: 'cimitarra', items: ['cimitarra mercurial', 'fuerza del viento'] },
  // Build V2 los detecta por su cuenta (v2ItemRules.isTear); acá es para el armador manual.
  { key: 'lagrima', items: ['lagrima de la diosa', 'manamune', 'muramana', 'baculo del arcangel', 'abrazo del serafin', 'llegada del invierno', 'invierno nordico', 'tiara susurrante', 'diadema musical'] },
];

const groupByName = new Map(EXCLUSIVE_ITEM_GROUPS.flatMap(group => group.items.map(name => [name, group.key])));

/** Grupo excluyente del objeto (o null). */
export const exclusiveGroupOf = item => groupByName.get(normalize(item?.name)) ?? null;

/** El objeto ya elegido con el que choca (mismo grupo, otro objeto), o null. */
export function exclusiveClash(item, selected = []) {
  const group = exclusiveGroupOf(item);
  if (!group) return null;
  return selected.find(other => other && normalize(other.name) !== normalize(item.name) && exclusiveGroupOf(other) === group) ?? null;
}
