export const ALL_TYPES = [
  'Normal','Fire','Water','Electric','Grass','Ice',
  'Fighting','Poison','Ground','Flying','Psychic','Bug',
  'Rock','Ghost','Dragon','Dark','Steel','Fairy',
];

// For each attacking type: which defending types are hit for 2x?
export const SUPER_EFFECTIVE = {
  Normal:   [],
  Fire:     ['Grass','Ice','Bug','Steel'],
  Water:    ['Fire','Ground','Rock'],
  Electric: ['Water','Flying'],
  Grass:    ['Water','Ground','Rock'],
  Ice:      ['Grass','Ground','Flying','Dragon'],
  Fighting: ['Normal','Ice','Rock','Dark','Steel'],
  Poison:   ['Grass','Fairy'],
  Ground:   ['Fire','Electric','Poison','Rock','Steel'],
  Flying:   ['Grass','Fighting','Bug'],
  Psychic:  ['Fighting','Poison'],
  Bug:      ['Grass','Psychic','Dark'],
  Rock:     ['Fire','Ice','Flying','Bug'],
  Ghost:    ['Psychic','Ghost'],
  Dragon:   ['Dragon'],
  Dark:     ['Psychic','Ghost'],
  Steel:    ['Ice','Rock','Fairy'],
  Fairy:    ['Fighting','Dragon','Dark'],
};

// For each attacking type: which defending types are immune (0x)?
export const IMMUNE = {
  Normal:   ['Ghost'],
  Fighting: ['Ghost'],
  Electric: ['Ground'],
  Ground:   ['Flying'],
  Ghost:    ['Normal'],
  Dragon:   ['Fairy'],
  Psychic:  ['Dark'],
};

// For each attacking type: which defending types resist (0.5x)?
export const NOT_VERY_EFFECTIVE = {
  Normal:   ['Rock','Steel'],
  Fire:     ['Fire','Water','Rock','Dragon'],
  Water:    ['Water','Grass','Dragon'],
  Electric: ['Electric','Grass','Dragon'],
  Grass:    ['Fire','Grass','Poison','Flying','Bug','Dragon','Steel'],
  Ice:      ['Fire','Water','Ice','Steel'],
  Fighting: ['Poison','Bug','Psychic','Flying','Fairy'],
  Poison:   ['Poison','Ground','Rock','Ghost'],
  Ground:   ['Grass','Bug'],
  Flying:   ['Electric','Rock','Steel'],
  Psychic:  ['Psychic','Steel'],
  Bug:      ['Fire','Fighting','Flying','Ghost','Steel','Fairy'],
  Rock:     ['Fighting','Ground','Steel'],
  Ghost:    ['Dark'],
  Dragon:   [],
  Dark:     ['Fighting','Dark','Fairy'],
  Steel:    ['Fire','Water','Electric','Steel'],
  Fairy:    ['Fire','Poison','Steel'],
};

export const TYPE_COLORS = {
  Normal:   '#9CA3A0',
  Fire:     '#F08030',
  Water:    '#6890F0',
  Electric: '#F8D030',
  Grass:    '#78C850',
  Ice:      '#98D8D8',
  Fighting: '#C03028',
  Poison:   '#A040A0',
  Ground:   '#E0C068',
  Flying:   '#A890F0',
  Psychic:  '#F85888',
  Bug:      '#A8B820',
  Rock:     '#B8A038',
  Ghost:    '#705898',
  Dragon:   '#7038F8',
  Dark:     '#705848',
  Steel:    '#B8B8D0',
  Fairy:    '#EE99AC',
};

export function getEffectiveness(attackType, defTypes) {
  if (!attackType || !defTypes?.length) return 1;
  const immune = IMMUNE[attackType] ?? [];
  const se = SUPER_EFFECTIVE[attackType] ?? [];
  const nve = NOT_VERY_EFFECTIVE[attackType] ?? [];
  let mult = 1;
  for (const def of defTypes) {
    if (immune.includes(def)) return 0;
    if (se.includes(def)) mult *= 2;
    else if (nve.includes(def)) mult *= 0.5;
  }
  return mult;
}
