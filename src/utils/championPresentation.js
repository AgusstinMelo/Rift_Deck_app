import { labels, tr } from '../i18n/uiI18n.js';

export const DIFFICULTY_LABELS = labels({ 1: 'champion.difficulty.1', 2: 'champion.difficulty.2', 3: 'champion.difficulty.3' });
export const SCALING_LABELS = labels({
  earlygame: 'champion.scaling.earlygame',
  midgame: 'champion.scaling.midgame',
  lategame: 'champion.scaling.lategame',
});
export const LANE_LABELS = labels({
  Dragonlane: 'champion.lane.Dragonlane',
  Jungler: 'champion.lane.Jungler',
  Midlane: 'champion.lane.Midlane',
  Support: 'champion.lane.Support',
  Toplane: 'champion.lane.Toplane',
});
export const DAMAGE_LABELS = labels({ AD: 'champion.damage.AD', AP: 'champion.damage.AP', Hybrid: 'champion.damage.Hybrid' });
export const LANE_IMAGES = {
  Toplane: 'https://media.base44.com/images/public/6a0005628d71002f05120013/abe747f2d_top.png',
  Jungler: 'https://media.base44.com/images/public/6a0005628d71002f05120013/0b50ba53f_jungle.png',
  Midlane: 'https://media.base44.com/images/public/6a0005628d71002f05120013/9b1932129_mid.png',
  Dragonlane: 'https://media.base44.com/images/public/6a0005628d71002f05120013/798004bb6_adc.png',
  Support: 'https://media.base44.com/images/public/6a0005628d71002f05120013/3e7bd0424_support.png',
};

export const getChampionLanes = champion =>
  (Array.isArray(champion?.lane) ? champion.lane : [champion?.lane])
    .filter(Boolean);

export const getChampionLaneLabels = champion =>
  getChampionLanes(champion).map(lane => LANE_LABELS[lane] || lane);

export const displayList = values => {
  const cleanValues = values.filter(Boolean);
  return cleanValues.join(cleanValues.length > 2 ? ', ' : tr('goals.list.and'));
};
