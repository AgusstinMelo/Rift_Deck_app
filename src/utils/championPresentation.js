export const DIFFICULTY_LABELS = { 1: 'Fácil', 2: 'Media', 3: 'Difícil' };
export const SCALING_LABELS = { earlygame: 'Juego temprano', midgame: 'Juego medio', lategame: 'Juego tardío' };
export const LANE_LABELS = { Dragonlane: 'Dragon Lane', Jungler: 'Jungla', Midlane: 'Mid Lane', Support: 'Soporte', Toplane: 'Top Lane' };
export const DAMAGE_LABELS = { AD: 'Daño físico (AD)', AP: 'Daño mágico (AP)', Hybrid: 'Daño híbrido' };
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
  return cleanValues.join(cleanValues.length > 2 ? ', ' : ' y ');
};
