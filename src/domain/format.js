import { toId, byName } from './ids.js';

// A "format" is a regulation resolved against @pkmn/dex: the picker lists plus lookups.
// Species entries are plain objects with one shape for base formes and megas alike.

function formeIndexOf(dexSpecies, Dex) {
  const order = Dex.species.get(dexSpecies.baseSpecies)?.formeOrder ?? [];
  return Math.max(0, order.indexOf(dexSpecies.name));
}

function speciesEntry(dexSpecies, Dex, base = dexSpecies) {
  return Object.freeze({
    id: dexSpecies.id,
    name: dexSpecies.name,
    num: dexSpecies.num,
    forme: dexSpecies.forme ?? '',
    formeIndex: formeIndexOf(dexSpecies, Dex),
    dexBaseSpecies: dexSpecies.baseSpecies,
    types: Object.freeze([...dexSpecies.types]),
    abilities: Object.freeze({ ...dexSpecies.abilities }),
    baseStats: Object.freeze({ ...dexSpecies.baseStats }),
    isMega: base !== dexSpecies,
    baseSpeciesId: base.id,
    baseSpeciesName: base.name,
    megaStone: base !== dexSpecies ? dexSpecies.requiredItem : null,
    // Megas learn whatever their base forme learns.
    learnsetId: base.id,
  });
}

function itemEntry(dexItem) {
  return Object.freeze({
    id: dexItem.id,
    name: dexItem.name,
    num: dexItem.num,
    shortDesc: dexItem.shortDesc ?? '',
    megaStone: dexItem.megaStone ? Object.freeze({ ...dexItem.megaStone }) : null,
  });
}

// The forme a mega evolves from: the first candidate legal in the format. Newer megas
// (e.g. Absol-Mega-Z) lack changesFrom, and Champions lets plain Floette (not Floette-Eternal) mega evolve.
export function megaBaseName(dexMega, isLegal = () => true) {
  const candidates = [dexMega.changesFrom, dexMega.battleOnly, dexMega.baseSpecies]
    .flat()
    .filter(Boolean);
  return candidates.find(isLegal) ?? candidates[0];
}

// Gigantamax / Eternamax formes only exist during Dynamax, which Champions doesn't have.
export const isDynamaxForme = (dexSpecies) => /^(.+-)?(Gmax|Eternamax)$/.test(dexSpecies?.forme ?? '');

function resolveNames(names, lookup) {
  const found = [];
  const missing = [];
  for (const name of names) {
    const entry = lookup(name);
    if (entry?.exists) found.push(entry);
    else missing.push(name);
  }
  return { found, missing };
}

/** Lists every problem with a regulation's data (unknown names, megas missing their stone or base, …). */
export function validateRegulation(regulation, Dex) {
  const errors = [];
  const check = (key, lookup) => {
    const { found, missing } = resolveNames(regulation[key], lookup);
    for (const name of missing) errors.push(`${regulation.id}: unknown ${key} "${name}"`);
    return found;
  };

  const pokemon = check('pokemon', n => Dex.species.get(n));
  for (const species of pokemon.filter(isDynamaxForme)) {
    errors.push(`${regulation.id}: "${species.name}" is a Dynamax forme; list ${species.changesFrom ?? species.baseSpecies} instead`);
  }
  const megas = check('megas', n => Dex.species.get(n));
  const items = check('items', n => Dex.items.get(n));
  check('moves', n => Dex.moves.get(n));

  const pokemonIds = new Set(pokemon.map(s => s.id));
  const itemIds = new Set(items.map(i => i.id));
  const megaIds = new Set(megas.map(s => s.id));

  for (const mega of megas) {
    if (!mega.requiredItem) {
      errors.push(`${regulation.id}: "${mega.name}" is not a mega forme`);
      continue;
    }
    if (!itemIds.has(toId(mega.requiredItem))) {
      errors.push(`${regulation.id}: ${mega.name} is legal but its stone ${mega.requiredItem} is not`);
    }
    const baseName = megaBaseName(mega, n => pokemonIds.has(toId(n)));
    if (!pokemonIds.has(toId(baseName))) {
      errors.push(`${regulation.id}: ${mega.name} is legal but ${baseName} is not`);
    }
  }
  for (const item of items.filter(i => i.megaStone)) {
    const megaNames = Object.values(item.megaStone);
    if (!megaNames.some(n => megaIds.has(toId(n)))) {
      errors.push(`${regulation.id}: stone ${item.name} is legal but none of ${megaNames.join('/')} are`);
    }
  }
  for (const speciesId of Object.keys(regulation.learnsetAdditions)) {
    if (!pokemonIds.has(speciesId) && !megaIds.has(speciesId)) {
      errors.push(`${regulation.id}: learnsetAdditions for unknown species "${speciesId}"`);
    }
  }
  return errors;
}

export function buildFormat(regulation, Dex) {
  const errors = validateRegulation(regulation, Dex);
  if (errors.length) throw new Error(`Invalid regulation:\n  ${errors.join('\n  ')}`);

  const baseSpecies = regulation.pokemon.map(n => speciesEntry(Dex.species.get(n), Dex));
  const baseById = new Map(baseSpecies.map(s => [s.id, s]));

  const megas = regulation.megas.map(name => {
    const dexMega = Dex.species.get(name);
    return speciesEntry(dexMega, Dex, baseById.get(toId(megaBaseName(dexMega, n => baseById.has(toId(n))))));
  });
  const megaByBaseAndStone = new Map(megas.map(m => [`${m.baseSpeciesId}|${toId(m.megaStone)}`, m]));

  const species = [...baseSpecies, ...megas].sort(byName);
  const speciesById = new Map(species.map(s => [s.id, s]));

  const items = regulation.items.map(n => itemEntry(Dex.items.get(n))).sort(byName);
  const itemsById = new Map(items.map(i => [i.id, i]));

  // Standard dex moves, plus listed moves @pkmn/dex marks nonstandard (e.g. King's Shield).
  const legalMoveIds = new Set(regulation.moves.map(toId));
  const moves = [...Dex.moves.all()]
    .filter(m => m.exists && !m.isZ && !m.isMax && (!m.isNonstandard || legalMoveIds.has(m.id)))
    .sort(byName);
  const movesById = new Map(moves.map(m => [m.id, m]));

  const abilities = [...Dex.abilities.all()]
    .filter(a => a.exists && !a.isNonstandard)
    .sort(byName);

  // Dex aliases ("Meowstic-M" → Meowstic) resolve through Dex before the format lookup.
  const lookup = (byId, dexTable) => (name) => {
    if (!name) return null;
    return byId.get(toId(name)) ?? byId.get(dexTable.get(name)?.id) ?? null;
  };

  const findSpecies = lookup(speciesById, Dex.species);
  // Pastes and old saves may name a Gigantamax forme ("Charizard-Gmax"); use the forme it comes from.
  const getSpecies = (name) => {
    const found = findSpecies(name);
    if (found || !name) return found;
    const dexSpecies = Dex.species.get(name);
    return isDynamaxForme(dexSpecies) ? findSpecies(dexSpecies.changesFrom ?? dexSpecies.baseSpecies) : null;
  };

  return Object.freeze({
    regulation,
    species,
    megas,
    items,
    moves,
    abilities,
    getSpecies,
    getItem: lookup(itemsById, Dex.items),
    getMove: lookup(movesById, Dex.moves),
    getAbility: (name) => {
      const ability = name ? Dex.abilities.get(name) : null;
      return ability?.exists ? ability : null;
    },
    isLegalMove: (move) => legalMoveIds.has(toId(move?.id ?? move)),
    /** The base forme of a mega (or the species itself). */
    getBaseOf: (species) => (species?.isMega ? speciesById.get(species.baseSpeciesId) : species) ?? null,
    /** The mega `species` becomes when holding `itemName`, or null. */
    getMegaFor: (species, itemName) =>
      megaByBaseAndStone.get(`${species?.baseSpeciesId}|${toId(itemName)}`) ?? null,
    learnsetAdditions: regulation.learnsetAdditions,
  });
}
