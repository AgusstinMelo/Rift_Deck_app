import { tr } from '../i18n/uiI18n.js';

export const DEFAULT_MATCH_TYPE = 'ranked';

export const MATCH_TYPES = [
  { value: 'ranked', get label() { return tr('matchTypes.ranked'); } },
  { value: 'legendary_ranked', get label() { return tr('matchTypes.legendary_ranked'); } },
  { value: 'casual', get label() { return tr('matchTypes.casual'); } },
];

export function getMatchTypeLabel(type) {
  return MATCH_TYPES.find(option => option.value === type)?.label
    || MATCH_TYPES[0].label;
}
