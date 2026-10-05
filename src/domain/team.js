import { isNature, DEFAULT_NATURE, sanitizeEvs } from './stats.js';
import { MOVE_SLOTS, makeEmptySlot, speciesHasAbility, defaultAbility } from './slot.js';

export const TEAM_SIZE = 6;

export const makeEmptyTeam = () => Array.from({ length: TEAM_SIZE }, makeEmptySlot);

// Names written by older versions of the app that the dex spells differently.
const LEGACY_SPECIES_NAMES = {
  'Meowstic-Mega-Male': 'Meowstic-M-Mega',
  'Meowstic-Mega-Female': 'Meowstic-F-Mega',
};

/** Team → JSON-safe data (species and moves stored by name). */
export function serializeTeam(team) {
  return team.map(slot => ({
    ...slot,
    species: slot.species?.name ?? null,
    moves: slot.moves.map(move => move?.name ?? null),
  }));
}

function deserializeSlot(raw, format) {
  if (!raw || typeof raw !== 'object') return makeEmptySlot();

  const speciesName = LEGACY_SPECIES_NAMES[raw.species] ?? raw.species;
  // Old saves stored the mega separately as megaFormId.
  const species = (raw.megaFormId && format.getSpecies(raw.megaFormId)) || format.getSpecies(speciesName);
  if (!species) return makeEmptySlot();

  const moves = Array.from({ length: MOVE_SLOTS }, (_, i) => format.getMove(raw.moves?.[i]) ?? null);
  return {
    ...makeEmptySlot(),
    species,
    nickname: typeof raw.nickname === 'string' ? raw.nickname : '',
    item: format.getItem(raw.item)?.name ?? null,
    ability: speciesHasAbility(species, raw.ability) ? raw.ability : defaultAbility(species),
    nature: isNature(raw.nature) ? raw.nature : DEFAULT_NATURE,
    moves,
    evs: sanitizeEvs(raw.evs),
  };
}

/**
 * Rebuilds a team from saved data. Anything unusable — corrupt slots, species or items
 * no longer legal in the format, unknown moves — is dropped rather than throwing.
 */
export function deserializeTeam(raw, format) {
  if (!Array.isArray(raw)) return makeEmptyTeam();
  return Array.from({ length: TEAM_SIZE }, (_, i) => deserializeSlot(raw[i], format));
}

/** Moves the slot at `from` to `to`, shifting the others. Out-of-range indexes are a no-op. */
export function reorderTeam(team, from, to) {
  const inRange = (i) => Number.isInteger(i) && i >= 0 && i < team.length;
  if (!inRange(from) || !inRange(to) || from === to) return team;
  const next = [...team];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** A full team from imported slots: the first TEAM_SIZE fill the team, the rest are empty. */
export const teamFromSlots = (slots) =>
  Array.from({ length: TEAM_SIZE }, (_, i) => slots[i] ?? makeEmptySlot());
