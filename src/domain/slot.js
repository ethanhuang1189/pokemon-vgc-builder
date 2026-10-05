import { DEFAULT_NATURE, emptyEvs } from './stats.js';

// Pure state transitions for one team slot. Each returns a new slot and never mutates its input.

export const MOVE_SLOTS = 4;

export const emptyMoves = () => Array(MOVE_SLOTS).fill(null);

export const makeEmptySlot = () => ({
  species: null,
  nickname: '',
  item: null,
  ability: '',
  nature: DEFAULT_NATURE,
  moves: emptyMoves(),
  evs: emptyEvs(),
});

export const defaultAbility = (species) => Object.values(species?.abilities ?? {}).find(Boolean) ?? '';

export const speciesHasAbility = (species, ability) =>
  Object.values(species?.abilities ?? {}).includes(ability);

/**
 * Picks a species. A different Pokémon (by dex number) starts from a blank build;
 * switching formes of the same Pokémon keeps moves, EVs, nature and any non-stone item.
 * Picking a mega equips its stone. Passing null empties the slot (nickname kept).
 */
export function withSpecies(slot, species, format) {
  if (!species) return { ...makeEmptySlot(), nickname: slot.nickname };

  const sameMon = slot.species?.num === species.num;
  const keepItem = sameMon && slot.item && !format.getItem(slot.item)?.megaStone;
  const base = sameMon ? slot : { ...makeEmptySlot(), nickname: slot.nickname };

  return {
    ...base,
    species,
    item: species.isMega ? species.megaStone : keepItem ? slot.item : null,
    ability: defaultAbility(species),
  };
}

/**
 * Holds an item (or null). A mega stone matching the slot's Pokémon mega evolves it;
 * any other item — or none — reverts a mega to its base forme.
 */
export function withItem(slot, item, format) {
  const itemName = item?.name ?? null;
  if (!slot.species) return { ...slot, item: itemName };

  const base = format.getBaseOf(slot.species);
  const species = (itemName && format.getMegaFor(base, itemName)) || base;
  if (species === slot.species) return { ...slot, item: itemName };
  return { ...slot, item: itemName, species, ability: defaultAbility(species) };
}

export function withMove(slot, index, move) {
  if (index < 0 || index >= MOVE_SLOTS) return slot;
  const moves = [...slot.moves];
  moves[index] = move ?? null;
  return { ...slot, moves };
}

/** The first empty move slot after `index`, or -1. Used to advance the move picker. */
export const nextEmptyMoveIndex = (moves, index) =>
  moves.findIndex((move, i) => i > index && !move);
