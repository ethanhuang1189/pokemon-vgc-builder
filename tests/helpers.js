import { Dex } from '@pkmn/dex';
import { buildFormat } from '../src/domain/format.js';
import { REGULATIONS, CURRENT_REGULATION } from '../src/regulations/index.js';
import { makeEmptySlot } from '../src/domain/slot.js';

export { Dex };

const formats = new Map();

/** Built formats are cached — building one resolves hundreds of dex entries. */
export function formatFor(regulation = CURRENT_REGULATION) {
  if (!formats.has(regulation.id)) formats.set(regulation.id, buildFormat(regulation, Dex));
  return formats.get(regulation.id);
}

export const regMB = REGULATIONS['M-B'];
export const regMC = REGULATIONS['M-C'];

/** A slot holding `speciesName` from the format, with optional overrides. */
export function slotWith(speciesName, overrides = {}, format = formatFor()) {
  const species = format.getSpecies(speciesName);
  if (!species) throw new Error(`test fixture: ${speciesName} is not in ${format.regulation.id}`);
  return { ...makeEmptySlot(), species, ability: Object.values(species.abilities)[0], ...overrides };
}

export const moves = (...names) => names.map(n => {
  const move = formatFor().getMove(n);
  if (!move) throw new Error(`test fixture: unknown move ${n}`);
  return move;
});

/** A slot's move array: the given moves, padded with nulls to 4. */
export const moveSlots = (...names) => [...moves(...names), null, null, null, null].slice(0, 4);
