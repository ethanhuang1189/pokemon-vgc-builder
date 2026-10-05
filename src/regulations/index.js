import regMB from './regMB.js';
import regMC from './regMC.js';

// To add a regulation: create regXX.js with extendRegulation(previous, { add, remove }),
// register it here, and point CURRENT_REGULATION at it.
export const REGULATIONS = Object.freeze({
  [regMB.id]: regMB,
  [regMC.id]: regMC,
});

export const CURRENT_REGULATION = regMC;

export function getRegulation(id) {
  const regulation = REGULATIONS[id?.toUpperCase()];
  if (!regulation) {
    throw new Error(`Unknown regulation "${id}". Known: ${Object.keys(REGULATIONS).join(', ')}`);
  }
  return regulation;
}
