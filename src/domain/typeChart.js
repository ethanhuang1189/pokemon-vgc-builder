import { Dex } from '@pkmn/dex';

export const ALL_TYPES = Object.freeze([
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
  'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
  'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
]);

// Abilities that grant full immunity to an attacking type.
export const ABILITY_IMMUNITIES = Object.freeze({
  'Levitate': ['Ground'],
  'Flash Fire': ['Fire'],
  'Water Absorb': ['Water'],
  'Storm Drain': ['Water'],
  'Volt Absorb': ['Electric'],
  'Lightning Rod': ['Electric'],
  'Motor Drive': ['Electric'],
  'Sap Sipper': ['Grass'],
  'Earth Eater': ['Ground'],
  'Well-Baked Body': ['Fire'],
  'Dry Skin': ['Water'],
});

// Marks abilities that cut super-effective damage to ×0.75.
const SUPER_EFFECTIVE_FILTER = 'super-effective';

// Abilities that multiply incoming damage for specific attacking types.
export const ABILITY_TYPE_MULT = Object.freeze({
  'Thick Fat': { Fire: 0.5, Ice: 0.5 },
  'Heatproof': { Fire: 0.5 },
  'Purifying Salt': { Ghost: 0.5 },
  'Fluffy': { Fire: 2 },
  'Filter': SUPER_EFFECTIVE_FILTER,
  'Solid Rock': SUPER_EFFECTIVE_FILTER,
  'Prism Armor': SUPER_EFFECTIVE_FILTER,
});

// Abilities that change the type of moves a Pokémon uses.
// `from` converts moves of that type; `sound` converts sound moves; `all` converts every move.
export const ABILITY_MOVE_TYPE = Object.freeze({
  'Pixilate': { from: 'Normal', to: 'Fairy' },
  'Aerilate': { from: 'Normal', to: 'Flying' },
  'Refrigerate': { from: 'Normal', to: 'Ice' },
  'Galvanize': { from: 'Normal', to: 'Electric' },
  'Liquid Voice': { sound: true, to: 'Water' },
  'Normalize': { all: true, to: 'Normal' },
});

// @pkmn/dex damageTaken codes: 0 = ×1, 1 = ×2, 2 = ×0.5, 3 = immune.
const DAMAGE_CODE_MULT = { 0: 1, 1: 2, 2: 0.5, 3: 0 };

/** Damage multiplier of `attackType` against a Pokémon with `defTypes` and (optionally) `ability`. */
export function getEffectiveness(attackType, defTypes, ability = null) {
  if (!attackType || !defTypes?.length) return 1;
  if (ABILITY_IMMUNITIES[ability]?.includes(attackType)) return 0;

  let mult = 1;
  for (const defType of defTypes) {
    const info = Dex.types.get(defType);
    if (!info?.exists) continue;
    mult *= DAMAGE_CODE_MULT[info.damageTaken[attackType] ?? 0] ?? 1;
  }
  if (mult === 0) return 0;

  const rule = ABILITY_TYPE_MULT[ability];
  if (rule === SUPER_EFFECTIVE_FILTER) return mult > 1 ? mult * 0.75 : mult;
  return mult * (rule?.[attackType] ?? 1);
}

/** The type a move actually hits with after the user's ability (Pixilate, Liquid Voice, …). */
export function getEffectiveMoveType(move, ability) {
  if (!move) return null;
  const rule = ABILITY_MOVE_TYPE[ability];
  if (!rule) return move.type;
  if (rule.all) return rule.to;
  if (rule.sound && move.flags?.sound) return rule.to;
  if (rule.from && move.type === rule.from) return rule.to;
  return move.type;
}

/** True when `defTypes` resist (take <×1 from) every type in `attackTypes` — the "resist:" search. */
export const resistsAll = (defTypes, attackTypes) =>
  attackTypes.every(t => getEffectiveness(t, defTypes) < 1);
