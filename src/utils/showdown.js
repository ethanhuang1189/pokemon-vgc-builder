const STAT_LABELS = { hp:'HP', atk:'Atk', def:'Def', spa:'SpA', spd:'SpD', spe:'Spe' };

// "Mega Venusaur" → "Venusaur-Mega"
// "Mega Charizard X" → "Charizard-Mega-X"
// "Mega Meowstic (Male)" → "Meowstic-Mega-Male"
function toShowdownMegaName(megaName) {
  const base = megaName.replace(/^Mega /, '');
  const xy = base.match(/^(.+?)\s+([XY])$/);
  if (xy) return `${xy[1]}-Mega-${xy[2]}`;
  const form = base.match(/^(.+?)\s+\((.+)\)$/);
  if (form) return `${form[1]}-Mega-${form[2]}`;
  return `${base}-Mega`;
}

export function exportToShowdown(team, allMegas = []) {
  return team
    .filter(s => s.species)
    .map(slot => {
      const lines = [];

      // Resolve species display name (use mega form name when active)
      let speciesDisplay = slot.species.name;
      if (slot.megaFormId && allMegas.length) {
        const mega = allMegas.find(m => m.id === slot.megaFormId);
        if (mega) speciesDisplay = toShowdownMegaName(mega.name);
      }

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

export function importFromShowdown(text, Dex) {
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

    const species = Dex.species.get(speciesName);
    if (species?.exists) slot.species = species;

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
          if (key) slot.evs[key] = Math.min(32, Math.max(0, parseInt(m[1]) || 0));
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
