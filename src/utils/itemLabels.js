import { baseMessages, tr } from '../i18n/uiI18n.js';

// Categorías y tipos de objeto se guardan en español en el catálogo; solo se traduce lo que se muestra.
// La base no siempre trae tildes ("Daño Fisico"), así que se compara sin acentos ni mayúsculas.
const normalize = value => String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const labelFrom = section => {
  const keys = new Map(Object.keys(baseMessages[section] || {}).map(key => [normalize(key), key]));
  return value => {
    const key = value && keys.get(normalize(value));
    return key ? tr(`${section}.${key}`) : value;
  };
};

export const itemCategoryLabel = labelFrom('itemCategories');
export const itemTypeLabel = labelFrom('itemTypes');
// Etiquetas de campeones ("Asesino", "aoe"...); las que no tienen traducción se muestran tal cual.
export const championTagLabel = labelFrom('championTags');
