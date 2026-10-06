// Aggregates stored battles (rows from the `battles` table) for the Battles tab.

/** part / whole, or 0 when there's nothing to divide by. */
export const ratio = (part, whole) => (whole ? part / whole : 0);

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
    .map(entry => ({ ...entry, winRate: ratio(entry.wins, entry.games) }))
    .sort((a, b) => b.games - a.games || b.wins - a.wins || a.name.localeCompare(b.name));
}

/** Overall record plus per-Pokémon numbers. Ties count as games but not wins. */
export function summarizeBattles(battles) {
  const count = (result) => battles.filter(b => b.result === result).length;
  const wins = count('win');
  return {
    record: { games: battles.length, wins, losses: count('loss'), ties: count('tie'), winRate: ratio(wins, battles.length) },
    yourPokemon: tallyPokemon(battles, 'brought'),
    opponentPokemon: tallyPokemon(battles, 'opponent_brought'),
  };
}

/** Distinct formats, most recent first (battles arrive newest first). */
export const formatsIn = (battles) => [...new Set(battles.map(b => b.format))];

export const formatPercent = (rate) => `${Math.round(rate * 100)}%`;

/** "12-5", or "12-5-1" when there are ties. */
export const formatRecord = ({ wins, losses, ties }) => `${wins}-${losses}${ties ? `-${ties}` : ''}`;

const teamKey = (team) => [...(team ?? [])].sort().join('|');

/** Milliseconds for an ISO date (0 if missing), for ordering. */
export const time = (iso) => Date.parse(iso) || 0;

/** The newest played_at among `battles` ('' for none). */
export const latestPlayed = (battles) => battles.reduce((latest, b) => (time(b.played_at) > time(latest) ? b.played_at : latest), '');

/**
 * Battles grouped by the six-Pokémon team brought to preview, each with its own summary.
 * Groups are ordered by most recent game; `species` keeps the preview order of the first battle
 * given (the newest, since battles load newest first).
 */
export function groupByTeam(battles) {
  const groups = new Map();
  for (const battle of battles) {
    const key = teamKey(battle.team);
    if (!groups.has(key)) groups.set(key, { key, species: battle.team ?? [], battles: [] });
    groups.get(key).battles.push(battle);
  }
  return [...groups.values()]
    .map(group => ({ ...group, lastPlayed: latestPlayed(group.battles), ...summarizeBattles(group.battles) }))
    .sort((a, b) => time(b.lastPlayed) - time(a.lastPlayed));
}
