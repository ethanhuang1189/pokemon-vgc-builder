const STAT_LABELS = { hp:'HP', atk:'Atk', def:'Def', spa:'SpA', spd:'SpD', spe:'Spe' };

export function exportToShowdown(team) {
  return team
    .filter(s => s.species)
    .map(slot => {
      const lines = [];

      // species.name is already in Showdown format (e.g. "Charizard-Mega-X", "Venusaur-Mega")
      const speciesDisplay = slot.species.name;
      const displayName = slot.nickname
        ? `${slot.nickname} (${speciesDisplay})`
        : speciesDisplay;
      const item = slot.item ? ` @ ${slot.item}` : '';
      lines.push(`${displayName}${item}`);

      if (slot.ability) lines.push(`Ability: ${slot.ability}`);
      lines.push('Level: 50');

      const evEntries = Object.entries(slot.evs).filter(([, v]) => (parseInt(v) || 0) > 0);
      if (evEntries.length) {
        lines.push(`EVs: ${evEntries.map(([k, v]) => `${v} ${STAT_LABELS[k]}`).join(' / ')}`);
      }

      if (slot.nature) lines.push(`${slot.nature} Nature`);

      for (const move of slot.moves) {
        if (move?.name) lines.push(`- ${move.name}`);
      }

      return lines.join('\n');
    })
    .join('\n\n');
}

// megaSpecies: the array from buildMegaForms(), used to resolve custom mega names
// that @pkmn/dex doesn't know (e.g. "Raichu-Mega-X")
export function importFromShowdown(text, Dex, megaSpecies = []) {
  const slots = [];
  const blocks = text.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    if (!block.trim()) continue;
    const lines = block.trim().split('\n').map(l => l.trim());
    const slot = {
      species: null, nickname: '', item: null,
      ability: '', nature: 'Hardy',
      moves: [null, null, null, null],
      evs: { hp:0, atk:0, def:0, spa:0, spd:0, spe:0 },
    };

    const firstLine = lines[0];
    const itemMatch = firstLine.match(/^(.+?)\s*@\s*(.+)$/);
    const nameStr = itemMatch ? itemMatch[1].trim() : firstLine.trim();
    if (itemMatch) slot.item = itemMatch[2].trim();

    const nicknameMatch = nameStr.match(/^(.+)\s+\((.+)\)$/);
    const speciesName = nicknameMatch ? nicknameMatch[2] : nameStr;
    if (nicknameMatch) slot.nickname = nicknameMatch[1];

    // Try @pkmn/dex first (handles standard species and standard megas)
    const dexSpecies = Dex.species.get(speciesName);
    if (dexSpecies?.exists) {
      slot.species = dexSpecies;
    } else {
      // Fall back to custom mega species list
      const mega = megaSpecies.find(
        m => m.name.toLowerCase() === speciesName.toLowerCase()
      );
      if (mega) slot.species = mega;
    }

    let moveIndex = 0;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('Ability:')) {
        slot.ability = line.replace('Ability:', '').trim();
      } else if (line.startsWith('EVs:')) {
        const evStr = line.replace('EVs:', '').trim();
        for (const part of evStr.split('/')) {
          const m = part.trim().match(/^(\d+)\s+(.+)$/);
          if (!m) continue;
          const key = Object.keys(STAT_LABELS).find(k => STAT_LABELS[k] === m[2].trim());
          if (key) slot.evs[key] = Math.min(252, Math.max(0, parseInt(m[1]) || 0));
        }
      } else if (line.match(/Nature$/)) {
        slot.nature = line.replace('Nature', '').trim();
      } else if (line.startsWith('-') && moveIndex < 4) {
        const moveName = line.replace(/^-\s*/, '').trim();
        const move = Dex.moves.get(moveName);
        if (move?.exists) {
          slot.moves[moveIndex] = move;
          moveIndex++;
        }
      }
    }

    if (slot.species) slots.push(slot);
  }

  return slots;
}
