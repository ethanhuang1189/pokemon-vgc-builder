import { Dex } from '@pkmn/dex';

export const ALL_TYPES = [
  'Normal','Fire','Water','Electric','Grass','Ice',
  'Fighting','Poison','Ground','Flying','Psychic','Bug',
  'Rock','Ghost','Dragon','Dark','Steel','Fairy',
];

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

// Abilities that grant full immunity to an attacking type
export const ABILITY_IMMUNITIES = {
  'Levitate':        ['Ground'],
  'Flash Fire':      ['Fire'],
  'Water Absorb':    ['Water'],
  'Storm Drain':     ['Water'],
  'Volt Absorb':     ['Electric'],
  'Lightning Rod':   ['Electric'],
  'Motor Drive':     ['Electric'],
  'Sap Sipper':      ['Grass'],
  'Earth Eater':     ['Ground'],
  'Well-Baked Body': ['Fire'],
  'Dry Skin':        ['Water'],
};

// Abilities that multiply incoming damage for specific attacking types.
// Special string '__se__' means ×0.75 applied only when the hit is super effective.
export const ABILITY_TYPE_MULT = {
  'Thick Fat':    { Fire: 0.5, Ice: 0.5 },
  'Heatproof':    { Fire: 0.5 },
  'Purifying Salt':{ Ghost: 0.5 },
  'Fluffy':       { Fire: 2 },
  'Filter':       '__se__',
  'Solid Rock':   '__se__',
  'Prism Armor':  '__se__',
};

// Abilities that change the type of moves a Pokémon uses offensively.
// `from` → converts moves of that type; `sound` → converts sound-flagged moves; `all` → converts all moves.
export const ABILITY_MOVE_TYPE = {
  'Pixilate':    { from: 'Normal',   to: 'Fairy'    },
  'Aerilate':    { from: 'Normal',   to: 'Flying'   },
  'Refrigerate': { from: 'Normal',   to: 'Ice'      },
  'Galvanize':   { from: 'Normal',   to: 'Electric' },
  'Liquid Voice':{ sound: true,      to: 'Water'    },
  'Normalize':   { all: true,        to: 'Normal'   },
};

// damageTaken codes from @pkmn/dex: 0=normal(1×), 1=2×, 2=0.5×, 3=immune(0×)
export function getEffectiveness(attackType, defTypes, ability = null) {
  if (!attackType || !defTypes?.length) return 1;

  // Ability-granted immunity overrides everything
  if (ability && ABILITY_IMMUNITIES[ability]?.includes(attackType)) return 0;

  let mult = 1;
  for (const defType of defTypes) {
    const info = Dex.types.get(defType);
    if (!info?.exists) continue;
    const code = info.damageTaken[attackType] ?? 0;
    if (code === 1) mult *= 2;
    else if (code === 2) mult *= 0.5;
    else if (code === 3) return 0;
  }

  if (ability && mult > 0) {
    const rule = ABILITY_TYPE_MULT[ability];
    if (rule === '__se__') {
      if (mult > 1) mult *= 0.75;
    } else if (rule?.[attackType] != null) {
      mult *= rule[attackType];
    }
  }

  return mult;
}

// Returns the effective type of a move after applying offensive ability modifiers.
export function getEffectiveMoveType(move, ability) {
  if (!move) return null;
  if (!ability) return move.type;
  const rule = ABILITY_MOVE_TYPE[ability];
  if (!rule) return move.type;
  if (rule.all) return rule.to;
  if (rule.sound && move.flags?.sound) return rule.to;
  if (rule.from && move.type === rule.from) return rule.to;
  return move.type;
}
