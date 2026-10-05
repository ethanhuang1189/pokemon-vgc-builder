import { toId } from './ids.js';

/**
 * Every move id a dex species can learn. Walks forme changes and pre-evolutions (egg and
 * tutor moves often live only on earlier stages), and falls back to the base species for
 * formes @pkmn/dex has no learnset for.
 */
export async function collectLearnset(Dex, speciesId) {
  const moveIds = new Set();
  const visited = new Set();

  async function visit(id) {
    if (!id || visited.has(id)) return;
    visited.add(id);
    const species = Dex.species.get(id);
    if (!species?.exists) return;

    const learnset = (await Dex.learnsets.get(species.id))?.learnset;
    if (learnset) Object.keys(learnset).forEach(moveId => moveIds.add(moveId));
    else if (species.baseSpecies !== species.name) await visit(toId(species.baseSpecies));

    await visit(species.changesFrom && toId(species.changesFrom));
    await visit(species.prevo && toId(species.prevo));
  }

  await visit(speciesId);
  return moveIds;
}

/**
 * Learnset lookups for one format, cached per species. Megas use their base forme's
 * learnset; the regulation's learnsetAdditions are merged in.
 */
export function createLearnsets(Dex, format) {
  const cache = new Map();

  function learnableIds(species) {
    if (!cache.has(species.id)) {
      cache.set(species.id, collectLearnset(Dex, species.learnsetId).then(ids => {
        for (const extra of format.learnsetAdditions[species.id] ?? []) ids.add(extra);
        return ids;
      }));
    }
    return cache.get(species.id);
  }

  return {
    learnableIds,

    /** Moves the species can pick. With no learnset data at all, every format move is offered. */
    async learnableMoves(species) {
      const ids = await learnableIds(species);
      return ids.size ? format.moves.filter(m => ids.has(m.id)) : format.moves;
    },

    /** moveId → Set of species ids that learn it (powers the "filter by move" species search). */
    async buildMoveIndex() {
      const index = new Map();
      for (const species of format.species) {
        for (const moveId of await learnableIds(species)) {
          if (!index.has(moveId)) index.set(moveId, new Set());
          index.get(moveId).add(species.id);
        }
      }
      return index;
    },
  };
}
