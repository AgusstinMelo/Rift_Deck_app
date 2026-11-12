// Códigos de las láminas de referencia: cada ícono del catálogo recibe un código
// (C12 = campeón, I45 = objeto, R7 = runa, S3 = hechizo). El orden es determinista
// (por nombre y después por id), así la lámina y la lectura de la respuesta usan
// siempre el mismo código para el mismo elemento.
// Sin dependencias del navegador para poder testearlo con node --test.

export const CODE_PREFIX = { champion: 'C', item: 'I', rune: 'R', spell: 'S' };

const byNameThenId = (a, b) =>
  String(a.name).localeCompare(String(b.name), 'es', { sensitivity: 'base' }) || String(a.id).localeCompare(String(b.id));

/**
 * @template T
 * @param {T[]} list
 * @param {string} prefix
 * @returns {Array<{ code: string, entry: T }>}
 */
export function assignCodes(list, prefix) {
  return [...(list || [])]
    .filter(entry => entry?.name)
    .sort(byNameThenId)
    .map((entry, index) => ({ code: `${prefix}${index + 1}`, entry }));
}

/**
 * Mapas código → elemento del catálogo, con la misma asignación que las láminas.
 * @param {{ champions?: any[], items?: any[], runes?: any[], spells?: any[] }} catalog
 */
export function buildCodeMaps(catalog) {
  const toMap = (list, prefix) => new Map(assignCodes(list, prefix).map(({ code, entry }) => [code, entry]));
  return {
    champions: toMap(catalog.champions, CODE_PREFIX.champion),
    items: toMap(catalog.items, CODE_PREFIX.item),
    runes: toMap(catalog.runes, CODE_PREFIX.rune),
    spells: toMap(catalog.spells, CODE_PREFIX.spell),
  };
}

/** Firma del catálogo para el caché de láminas (cambia si cambia algún ícono). */
export function catalogSignature(catalog) {
  const part = list => (list || []).map(entry => `${entry.id}:${entry.name}:${entry.image_url || ''}`).sort().join('|');
  const text = ['champions', 'items', 'runes', 'spells'].map(key => part(catalog[key])).join('#');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) | 0;
  return `v1-${text.length}-${(hash >>> 0).toString(36)}`;
}
