import { supabase, unwrap } from './supabase.js';

// Read-only Top Teams data (supabase/migrations/0005_ladder.sql): summaries refreshed by the
// collector, and anonymous per-game rows for one team's or core's breakdown.

export const ladderAvailable = () => Boolean(supabase);

const GROUP_COLUMNS = {
  teams: 'team_key, team, games, wins, losses, players, avg_rating, score',
  cores: 'core_key, teams, games, wins, losses, players, avg_rating, score',
};
// Most games the breakdown reads for one team or core (newest first).
const MAX_DETAIL_GAMES = 500;

/** Top teams or cores ('teams' | 'cores'), by `sort`: 'best' (ranked win rate) or 'popular' (games). */
export async function fetchTopGroups(formatId, kind, sort, limit) {
  return unwrap(await supabase
    .from(kind === 'cores' ? 'ladder_cores' : 'ladder_teams')
    .select(GROUP_COLUMNS[kind])
    .eq('format_id', formatId)
    .order(sort === 'popular' ? 'games' : 'score', { ascending: false })
    .order('players', { ascending: false })
    .limit(limit));
}

/** Totals for the format: { entries, replays, players, first_played, last_played, updated_at } or null. */
export async function fetchOverview(formatId) {
  return unwrap(await supabase.from('ladder_overview').select('*').eq('format_id', formatId).maybeSingle());
}

/** The games behind one team (by team key) or core (by core key). */
export async function fetchGroupGames(formatId, kind, key) {
  const query = supabase
    .from('ladder_entries_public')
    .select('replay_id, played_at, rating, result, team, team_key, brought, leads, mega, moves, items, abilities')
    .eq('format_id', formatId);
  const filtered = kind === 'cores' ? query.contains('core_keys', [key]) : query.eq('team_key', key);
  return unwrap(await filtered.order('played_at', { ascending: false }).limit(MAX_DETAIL_GAMES));
}
