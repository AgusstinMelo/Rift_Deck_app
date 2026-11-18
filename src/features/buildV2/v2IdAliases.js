// IDs cortos para la conversación con Gemini. El schema de respuesta lista los IDs
// permitidos de cada pieza y Google tiene un tope de complejidad para ese schema: con los
// IDs reales (24 caracteres por objeto) estábamos al borde y a veces lo rechazaba ("too
// many states for serving"). En el prompt y el schema cada pieza pasa a llamarse I1..In
// (objetos), M1..Mn (botas), R1..Rn (runas) y S1..Sn (hechizos); la respuesta se traduce de
// vuelta a los IDs reales antes de estabilizar, auditar y mostrar.

const KINDS = [
  { list: 'coreItems', prefix: 'I' },
  { list: 'movementItems', prefix: 'M' },
  { list: 'runes', prefix: 'R' },
  { list: 'spells', prefix: 'S' },
];

/**
 * @param {any} snapshot  Snapshot elegible (con IDs reales).
 * @returns {{ snapshot: any, restore: (result: any) => any }}
 *   `snapshot`: el mismo con IDs cortos en objetos, botas, runas y hechizos (los campeones
 *   no cambian). `restore(result)`: la respuesta de la IA con los IDs reales.
 */
export function createIdAliases(snapshot) {
  const real = Object.fromEntries(KINDS.map(({ prefix }) => [prefix, new Map()]));
  const aliased = { ...snapshot };
  const itemAlias = new Map();
  KINDS.forEach(({ list, prefix }) => {
    aliased[list] = (snapshot[list] || []).map((entity, index) => {
      const alias = `${prefix}${index + 1}`;
      real[prefix].set(alias, entity.id);
      if (prefix === 'I' || prefix === 'M') itemAlias.set(String(entity.id), alias);
      return { ...entity, id: alias };
    });
  });
  // La lista completa de objetos (con componentes) lleva el alias de los que lo tienen.
  aliased.items = (snapshot.items || []).map(item => (itemAlias.has(String(item.id)) ? { ...item, id: itemAlias.get(String(item.id)) } : item));

  // Un ID que no es alias (la IA inventó uno) queda como vino: la validación lo rechaza.
  const back = (selection, prefix) => {
    if (!selection || typeof selection !== 'object') return selection;
    const id = real[prefix].get(String(selection.id).trim());
    return id === undefined ? selection : { ...selection, id };
  };
  const backList = (list, prefix) => (Array.isArray(list) ? list.map(entry => back(entry, prefix)) : list);

  return {
    snapshot: aliased,
    restore: result => (!result || typeof result !== 'object' ? result : {
      ...result,
      core_items: backList(result.core_items, 'I'),
      movement_item: back(result.movement_item, 'M'),
      keystone: back(result.keystone, 'R'),
      primary_runes: backList(result.primary_runes, 'R'),
      secondary_rune: back(result.secondary_rune, 'R'),
      spells: backList(result.spells, 'S'),
    }),
  };
}
