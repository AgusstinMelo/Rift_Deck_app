import { baseMessages, lookup, tr } from '@/i18n/uiI18n';

// Las etiquetas se guardan tal cual en la partida; matchTagLabel solo cambia lo que se muestra.
export const PRESET_MATCH_TAGS = [
  'Stomp',
  'Remontada',
  'Mala composicion',
  'Buen early',
  'Buen late',
  'Autofill',
  'AFK',
  'Troll',
  'Lag',
];

export const matchTagLabel = tag =>
  (lookup(baseMessages, `matchTags.${tag}`) ? tr(`matchTags.${tag}`) : tag);
