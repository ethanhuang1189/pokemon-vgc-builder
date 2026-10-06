// Aggregates stored battles (rows from the `battles` table) for the Battles tab.

const winRate = (wins, games) => (games ? wins / games : 0);

/** Per-species games played and wins, most-played first. `key` is 'brought' or 'opponent_brought'. */
function tallyPokemon(battles, key) {
  const bySpecies = new Map();
  for (const battle of battles) {
    for (const name of battle[key] ?? []) {
      const entry = bySpecies.get(name) ?? { name, games: 0, wins: 0 };
      entry.games += 1;
      if (battle.result === 'win') entry.wins += 1;
      bySpecies.set(name, entry);
    }
  }
  return [...bySpecies.values()]
    .map(entry => ({ ...entry, winRate: winRate(entry.wins, entry.games) }))
    .sort((a, b) => b.games - a.games || b.wins - a.wins || a.name.localeCompare(b.name));
}

/** Overall record plus per-Pokémon numbers. Ties count as games but not wins. */
export function summarizeBattles(battles) {
  const count = (result) => battles.filter(b => b.result === result).length;
  const wins = count('win');
  return {
    record: { games: battles.length, wins, losses: count('loss'), ties: count('tie'), winRate: winRate(wins, battles.length) },
    yourPokemon: tallyPokemon(battles, 'brought'),
    opponentPokemon: tallyPokemon(battles, 'opponent_brought'),
  };
}

/** Distinct formats, most recent first (battles arrive newest first). */
export const formatsIn = (battles) => [...new Set(battles.map(b => b.format))];

export const formatPercent = (rate) => `${Math.round(rate * 100)}%`;
