import { summarizeBattles, ratio, time } from './battleStats.js';
import { toId } from './ids.js';

// Derived stats for the stats panels: Elo history, matchups, attendance, leads, move usage per Pokémon.

export const MIN_MATCHUP_GAMES = 3;
// Matchups are ranked as if each record also had this many games at your overall win rate,
// so a 3-0 or 0-3 doesn't outrank a 9-1 or 1-9 on luck alone.
export const PRIOR_GAMES = 5;
// How many entries each ranked list shows.
export const TOP_COUNT = 5;

const isRated = (battle) => Number.isInteger(battle.rating_after);
const oldestFirst = (a, b) => time(a.played_at) - time(b.played_at);

/**
 * Your Showdown accounts with rated games ({ id, name, games }), most recently played first.
 * Each account has its own ladder rating, so the chart shows one account at a time.
 */
export function ratedAccounts(battles) {
  const byId = new Map();
  for (const battle of battles.filter(isRated).sort(oldestFirst).reverse()) {
    const id = toId(battle.player_name);
    // Keep the name as spelled in the newest game.
    const entry = byId.get(id) ?? { id, name: battle.player_name || 'Unknown account', games: 0 };
    entry.games += 1;
    byId.set(id, entry);
  }
  return [...byId.values()];
}

/**
 * Rating after each rated game, oldest first, as one series per account and ladder (format):
 * ratings on different accounts or ladders aren't comparable. Series with the most games come first.
 */
export function eloSeries(battles) {
  const byKey = new Map();
  for (const battle of battles.filter(isRated).sort(oldestFirst)) {
    const account = toId(battle.player_name);
    const key = `${account}|${battle.format}`;
    if (!byKey.has(key)) byKey.set(key, { key, account, format: battle.format, points: [] });
    const series = byKey.get(key);
    series.points.push({
      game: series.points.length + 1,
      rating: battle.rating_after,
      change: Number.isInteger(battle.rating_before) ? battle.rating_after - battle.rating_before : null,
      result: battle.result,
      opponent: battle.opponent_name,
      playedAt: battle.played_at,
    });
  }
  return [...byKey.values()].sort((a, b) => b.points.length - a.points.length);
}

/** Current, peak and net change (from before the first game) for one series' points. */
export function ratingSummary(points) {
  if (!points.length) return null;
  const first = points[0];
  const start = first.change === null ? first.rating : first.rating - first.change;
  const current = points.at(-1).rating;
  return { current, peak: Math.max(...points.map(p => p.rating)), net: current - start };
}

/** A win rate pulled toward `baseline` by PRIOR_GAMES imaginary games — for ranking, not display. */
export const adjustedWinRate = (wins, games, baseline, weight = PRIOR_GAMES) =>
  (games + weight ? (wins + weight * baseline) / (games + weight) : baseline);

/** The `count` highest- and lowest-ranked rows by `score`, never listing a row in both. */
// Ties go to the larger sample, then alphabetical, in both lists.
function extremes(rows, score, count) {
  const by = (direction) => (a, b) => direction * (score(a) - score(b)) || b.games - a.games || a.name.localeCompare(b.name);
  const best = [...rows].sort(by(-1)).slice(0, count);
  const worst = rows.filter(r => !best.includes(r)).sort(by(1)).slice(0, count);
  return { best, worst };
}

/**
 * Opponent Pokémon faced at least MIN_MATCHUP_GAMES times: `best` (easiest) and `worst`
 * (hardest), ranked by adjustedWinRate against your overall win rate so bigger samples count
 * for more, and `mostFaced`. `baseline` is that overall win rate.
 */
export function matchups(battles, count = TOP_COUNT) {
  const { record, opponentPokemon } = summarizeBattles(battles);
  const baseline = record.winRate;
  const faced = opponentPokemon
    .filter(p => p.games >= MIN_MATCHUP_GAMES)
    .map(p => ({ ...p, score: adjustedWinRate(p.wins, p.games, baseline) }));
  // Ties go to the larger sample, then alphabetical.
  const by = (direction) => (a, b) => direction * (a.score - b.score) || b.games - a.games || a.name.localeCompare(b.name);
  return {
    best: faced.filter(p => p.score > baseline).sort(by(-1)).slice(0, count),
    worst: faced.filter(p => p.score < baseline).sort(by(1)).slice(0, count),
    mostFaced: faced.slice(0, count), // opponentPokemon is already most-faced first
    baseline,
  };
}

/**
 * How often each of your team's Pokémon is brought when it's on the team: `all` ranked, plus
 * the `count` highest and lowest (never overlapping).
 */
export function attendance(battles, count = TOP_COUNT) {
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
  return { all: extremes(rows, r => r.rate, rows.length).best, highest: best, lowest: worst };
}

/** Lead pairs, most used first, with your win rate for each. */
export function commonLeads(battles, count = TOP_COUNT) {
  const byPair = new Map();
  for (const battle of battles) {
    if (!battle.leads?.length) continue;
    const leads = [...battle.leads].sort();
    const key = leads.join('|');
    const entry = byPair.get(key) ?? { key, leads, games: 0, wins: 0, losses: 0 };
    entry.games += 1;
    if (battle.result === 'win') entry.wins += 1;
    if (battle.result === 'loss') entry.losses += 1;
    byPair.set(key, entry);
  }
  return [...byPair.values()]
    .map(e => ({ ...e, winRate: ratio(e.wins, e.games) }))
    .sort((a, b) => b.games - a.games || b.winRate - a.winRate || a.key.localeCompare(b.key))
    .slice(0, count);
}

/** Slices for a move → uses map, largest first; past `top`, the rest fold into one "Other" slice. */
export function toSlices(totals, top = 5) {
  const sorted = [...totals].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const total = sorted.reduce((sum, m) => sum + m.count, 0);
  const shown = sorted.length > top + 1 ? sorted.slice(0, top) : sorted;
  const otherCount = total - shown.reduce((sum, m) => sum + m.count, 0);
  const slices = otherCount > 0 ? [...shown, { name: 'Other', count: otherCount, other: true }] : shown;
  return { total, slices: slices.map(s => ({ ...s, share: ratio(s.count, total) })) };
}

/**
 * Each of your Pokémon's moves ({ species, total, slices }), in `order` (the team's preview
 * order) and then by most uses. Battles store moves as { species: { move: uses } }.
 */
export function movesByPokemon(battles, order = [], top = 5) {
  const bySpecies = new Map();
  for (const battle of battles) {
    for (const [species, moves] of Object.entries(battle.moves ?? {})) {
      if (!moves || typeof moves !== 'object') continue; // older, pre-per-Pokémon rows
      const totals = bySpecies.get(species) ?? new Map();
      for (const [move, uses] of Object.entries(moves)) totals.set(move, (totals.get(move) ?? 0) + (Number(uses) || 0));
      bySpecies.set(species, totals);
    }
  }
  const rank = (species) => (order.includes(species) ? order.indexOf(species) : order.length);
  return [...bySpecies]
    .map(([species, totals]) => ({ species, ...toSlices(totals, top) }))
    .filter(p => p.total > 0)
    .sort((a, b) => rank(a.species) - rank(b.species) || b.total - a.total);
}
