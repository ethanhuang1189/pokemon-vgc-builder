import { ALL_TYPES, SUPER_EFFECTIVE, IMMUNE, getEffectiveness } from '../data/typeChart';

// Which defending types the team can and cannot hit super effectively (damage moves only)
export function getCoverage(team) {
  const attackTypes = new Set();
  for (const slot of team) {
    for (const move of slot.moves) {
      if (move?.type && move.category !== 'Status') attackTypes.add(move.type);
    }
  }

  const covered = new Set();
  const uncovered = new Set();
  for (const defType of ALL_TYPES) {
    let canHit = false;
    for (const atkType of attackTypes) {
      const immunes = IMMUNE[atkType] ?? [];
      const ses = SUPER_EFFECTIVE[atkType] ?? [];
      if (!immunes.includes(defType) && ses.includes(defType)) {
        canHit = true;
        break;
      }
    }
    if (canHit) covered.add(defType);
    else uncovered.add(defType);
  }
  return { covered, uncovered, attackTypes };
}

// For each defending type: which Pokemon/move can hit it SE
export function getCoverageDetails(team) {
  const details = {};
  for (const slot of team) {
    if (!slot.species) continue;
    const pokeName = slot.nickname || slot.species.name;
    for (const move of slot.moves) {
      if (!move?.type || move.category === 'Status') continue;
      for (const defType of ALL_TYPES) {
        const immunes = IMMUNE[move.type] ?? [];
        const ses = SUPER_EFFECTIVE[move.type] ?? [];
        if (!immunes.includes(defType) && ses.includes(defType)) {
          if (!details[defType]) details[defType] = [];
          const exists = details[defType].some(d => d.pokeName === pokeName && d.moveName === move.name);
          if (!exists) details[defType].push({ pokeName, moveName: move.name, moveType: move.type });
        }
      }
    }
  }
  return details;
}

// Count of how many team members are weak to each attacking type
export function getTeamWeaknesses(team) {
  const counts = {};
  for (const type of ALL_TYPES) counts[type] = 0;
  for (const slot of team) {
    if (!slot.species) continue;
    for (const atkType of ALL_TYPES) {
      const eff = getEffectiveness(atkType, slot.species.types);
      if (eff > 1) counts[atkType]++;
    }
  }
  return counts;
}

// For each attacking type: which Pokemon on the team are weak to it
export function getWeaknessDetails(team) {
  const details = {};
  for (const slot of team) {
    if (!slot.species) continue;
    const pokeName = slot.nickname || slot.species.name;
    for (const atkType of ALL_TYPES) {
      const eff = getEffectiveness(atkType, slot.species.types);
      if (eff > 1) {
        if (!details[atkType]) details[atkType] = [];
        details[atkType].push({ pokeName, types: slot.species.types, eff });
      }
    }
  }
  return details;
}

// Count of how many team members share each type
export function getTypeDisparity(team) {
  const counts = {};
  for (const slot of team) {
    if (!slot.species) continue;
    for (const type of slot.species.types) {
      counts[type] = (counts[type] || 0) + 1;
    }
  }
  return counts;
}

// For each type: which Pokemon have that type
export function getDisparityDetails(team) {
  const details = {};
  for (const slot of team) {
    if (!slot.species) continue;
    const pokeName = slot.nickname || slot.species.name;
    for (const type of slot.species.types) {
      if (!details[type]) details[type] = [];
      details[type].push({ pokeName, types: slot.species.types });
    }
  }
  return details;
}

// Analyse each meta Pokémon against the current team.
// metaList: [{ name, usage, types }]  (types resolved externally via Dex)
// Returns the same list enriched with coverage/threat data.
export function analyzeMetaList(team, metaList) {
  return metaList.map(meta => {
    const coveringMoves = []; // team moves that hit this meta Pokémon SE

    for (const slot of team) {
      if (!slot.species) continue;
      const pokeName = slot.nickname || slot.species.name;
      for (const move of slot.moves) {
        if (!move?.type || move.category === 'Status') continue;
        const eff = getEffectiveness(move.type, meta.types);
        if (eff > 1) {
          const exists = coveringMoves.some(m => m.pokeName === pokeName && m.moveName === move.name);
          if (!exists) coveringMoves.push({ pokeName, moveName: move.name, moveType: move.type, eff });
        }
      }
    }

    // Which team members can this meta Pokémon threaten via STAB?
    const threatened = [];
    for (const slot of team) {
      if (!slot.species) continue;
      const pokeName = slot.nickname || slot.species.name;
      for (const stabType of meta.types) {
        const eff = getEffectiveness(stabType, slot.species.types);
        if (eff > 1) {
          const exists = threatened.some(t => t.pokeName === pokeName && t.via === stabType);
          if (!exists) threatened.push({ pokeName, types: slot.species.types, eff, via: stabType });
        }
      }
    }

    return { ...meta, covered: coveringMoves.length > 0, coveringMoves, threatened };
  });
}

// Count restricted Pokemon on the team
export function countRestricted(team, restrictedSet) {
  return team.filter(s => s.species && restrictedSet.has(s.species.name)).length;
}

export function getTotalEVs(evs) {
  return Object.values(evs).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
}
