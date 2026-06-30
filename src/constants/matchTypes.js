export const DEFAULT_MATCH_TYPE = 'ranked';

export const MATCH_TYPES = [
  { value: 'ranked', label: 'Clasificatoria' },
  { value: 'legendary_ranked', label: 'Clasificatoria Legendaria' },
  { value: 'casual', label: 'Casual' },
];

export function getMatchTypeLabel(type) {
  return MATCH_TYPES.find(option => option.value === type)?.label
    || MATCH_TYPES[0].label;
}
