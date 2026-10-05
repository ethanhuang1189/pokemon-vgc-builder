import { ALL_TYPES, getEffectiveness, getEffectiveMoveType } from './typeChart.js';

// Team-wide type analysis. Every function takes the team array (empty slots have species === null).

export const filledSlots = (team) => team.filter(slot => slot.species);

export const slotDisplayName = (slot) => slot.nickname || slot.species.name;

/** A slot's damaging moves with the type they actually hit for (after ability). */
export function damagingMoves(slot) {
  return slot.moves
    .filter(move => move?.type && move.category !== 'Status')
    .map(move => ({ move, type: getEffectiveMoveType(move, slot.ability) }));
}

function addUnique(details, key, entry, sameEntry) {
  const list = (details[key] ??= []);
  if (!list.some(existing => sameEntry(existing, entry))) list.push(entry);
}

const sameMove = (a, b) => a.pokeName === b.pokeName && a.moveName === b.moveName;

/** For each defending type: which Pokémon/moves hit it super effectively. */
export function getCoverageDetails(team) {
  const details = {};
  for (const slot of filledSlots(team)) {
    const pokeName = slotDisplayName(slot);
    for (const { move, type } of damagingMoves(slot)) {
      for (const defType of ALL_TYPES) {
        if (getEffectiveness(type, [defType]) > 1) {
          addUnique(details, defType, { pokeName, moveName: move.name, moveType: type }, sameMove);
        }
      }
    }
  }
  return details;
}

/** Which defending types the team can and cannot hit super effectively. */
export function getCoverage(team) {
  const details = getCoverageDetails(team);
  const attackTypes = new Set(filledSlots(team).flatMap(slot => damagingMoves(slot).map(m => m.type)));
  const covered = new Set(ALL_TYPES.filter(t => details[t]?.length));
  const uncovered = new Set(ALL_TYPES.filter(t => !covered.has(t)));
  return { covered, uncovered, attackTypes };
}

/** For each attacking type: which team members are weak to it. */
export function getWeaknessDetails(team) {
  const details = {};
  for (const slot of filledSlots(team)) {
    for (const atkType of ALL_TYPES) {
      const eff = getEffectiveness(atkType, slot.species.types, slot.ability);
      if (eff > 1) (details[atkType] ??= []).push({ pokeName: slotDisplayName(slot), types: slot.species.types, eff });
    }
  }
  return details;
}

/** For each type: which team members have it. */
export function getTypeDetails(team) {
  const details = {};
  for (const slot of filledSlots(team)) {
    for (const type of slot.species.types) {
      (details[type] ??= []).push({ pokeName: slotDisplayName(slot), types: slot.species.types });
    }
  }
  return details;
}

/** { type: entries.length } for any details map above. */
export const countByType = (details) =>
  Object.fromEntries(Object.entries(details).map(([type, entries]) => [type, entries.length]));

/**
 * Checks the team against each meta Pokémon ({ name, usage, types }):
 * which of our moves hit it super effectively, and which of our members its STAB types threaten.
 */
export function analyzeMetaList(team, metaList) {
  const members = filledSlots(team);
  return metaList.map(meta => {
    const coveringMoves = [];
    const threatened = [];
    for (const slot of members) {
      const pokeName = slotDisplayName(slot);
      for (const { move, type } of damagingMoves(slot)) {
        const eff = getEffectiveness(type, meta.types);
        if (eff > 1 && !coveringMoves.some(m => sameMove(m, { pokeName, moveName: move.name }))) {
          coveringMoves.push({ pokeName, moveName: move.name, moveType: type, eff });
        }
      }
      for (const stabType of meta.types) {
        const eff = getEffectiveness(stabType, slot.species.types, slot.ability);
        if (eff > 1) threatened.push({ pokeName, types: slot.species.types, eff, via: stabType });
      }
    }
    return { ...meta, covered: coveringMoves.length > 0, coveringMoves, threatened };
  });
}

/**
 * Attaches types to usage-stat entries ({ name, slug, usage }), dropping names the dex can't resolve.
 * Pikalytics names look like "Sneasler", "Charizard-Mega-Y", "Indeedee-F".
 */
export function resolveMetaEntries(entries, Dex, limit = 30) {
  return (entries ?? []).slice(0, limit).flatMap(entry => {
    const candidates = [entry.slug, entry.name].filter(Boolean);
    for (const candidate of candidates) {
      const species = Dex.species.get(candidate);
      if (species?.exists) return [{ ...entry, types: species.types }];
    }
    return [];
  });
}
