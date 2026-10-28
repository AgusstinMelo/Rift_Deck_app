import { baseMessages, lookup, tr } from '../i18n/uiI18n.js';

// Categorías y tipos de objeto se guardan en español en el catálogo; solo se traduce lo que se muestra.
const labelFrom = section => value =>
  (value && lookup(baseMessages, `${section}.${value}`) ? tr(`${section}.${value}`) : value);

export const itemCategoryLabel = labelFrom('itemCategories');
export const itemTypeLabel = labelFrom('itemTypes');
