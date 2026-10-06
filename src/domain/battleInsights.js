import { summarizeBattles, ratio, time } from './battleStats.js';

// Derived stats for the stats panels: Elo history, matchups, attendance, leads, move usage.

export const MIN_MATCHUP_GAMES = 3;

/**
 * Rating after each rated game, oldest first, as one series per ladder (format) — ratings
 * on different ladders aren't comparable. Series with the most games come first.
 */
export function eloSeries(battles) {
  const byFormat = new Map();
  const rated = battles.filter(b => Number.isInteger(b.rating_after)).sort((a, b) => time(a.played_at) - time(b.played_at));
  for (const battle of rated) {
    if (!byFormat.has(battle.format)) byFormat.set(battle.format, { format: battle.format, points: [] });
    const series = byFormat.get(battle.format);
    series.points.push({
      game: series.points.length + 1,
      rating: battle.rating_after,
      change: Number.isInteger(battle.rating_before) ? battle.rating_after - battle.rating_before : null,
      result: battle.result,
      opponent: battle.opponent_name,
      playedAt: battle.played_at,
    });
  }
  return [...byFormat.values()].sort((a, b) => b.points.length - a.points.length);
}

/** The `count` highest- and lowest-ranked rows by `score`, never listing a row in both. */
// Ties go to the larger sample, then alphabetical, in both lists.
function extremes(rows, score, count) {
  const by = (direction) => (a, b) => direction * (score(a) - score(b)) || b.games - a.games || a.name.localeCompare(b.name);
  const best = [...rows].sort(by(-1)).slice(0, count);
  const worst = rows.filter(r => !best.includes(r)).sort(by(1)).slice(0, count);
  return { best, worst };
}

/** Opponent Pokémon you win most and least against (faced at least MIN_MATCHUP_GAMES times). */
export function matchups(battles, count = 3) {
  const faced = summarizeBattles(battles).opponentPokemon.filter(p => p.games >= MIN_MATCHUP_GAMES);
  return extremes(faced, p => p.winRate, count);
}

/** How often each of your team's Pokémon is brought when it's on the team, highest and lowest. */
export function attendance(battles, count = 3) {
  const bySpecies = new Map();
  for (const battle of battles) {
    const brought = new Set(battle.brought ?? []);
    for (const name of battle.team ?? []) {
      const entry = bySpecies.get(name) ?? { name, games: 0, brought: 0 };
      entry.games += 1;
      if (brought.has(name)) entry.brought += 1;
      bySpecies.set(name, entry);
    }
  }
  const rows = [...bySpecies.values()].map(e => ({ ...e, rate: ratio(e.brought, e.games) }));
  const { best, worst } = extremes(rows, r => r.rate, count);
  return { highest: best, lowest: worst };
}

/** Lead pairs, most used first, with your win rate for each. */
export function commonLeads(battles, count = 5) {
  const byPair = new Map();
  for (const battle of battles) {
    if (!battle.leads?.length) continue;
    const leads = [...battle.leads].sort();
    const key = leads.join('|');
    const entry = byPair.get(key) ?? { key, leads, games: 0, wins: 0 };
    entry.games += 1;
    if (battle.result === 'win') entry.wins += 1;
    byPair.set(key, entry);
  }
  return [...byPair.values()]
    .map(e => ({ ...e, winRate: ratio(e.wins, e.games) }))
    .sort((a, b) => b.games - a.games || b.winRate - a.winRate || a.key.localeCompare(b.key))
    .slice(0, count);
}

/** Your moves by times used; past `top`, the rest fold into a single "Other" slice. */
export function moveUsage(battles, top = 7) {
  const totals = new Map();
  for (const battle of battles) {
    for (const [move, uses] of Object.entries(battle.moves ?? {})) {
      totals.set(move, (totals.get(move) ?? 0) + (Number(uses) || 0));
    }
  }
  const sorted = [...totals].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const total = sorted.reduce((sum, m) => sum + m.count, 0);
  const shown = sorted.length > top + 1 ? sorted.slice(0, top) : sorted;
  const otherCount = total - shown.reduce((sum, m) => sum + m.count, 0);
  const slices = otherCount > 0 ? [...shown, { name: 'Other', count: otherCount, other: true }] : shown;
  return { total, slices: slices.map(s => ({ ...s, share: ratio(s.count, total) })) };
}
