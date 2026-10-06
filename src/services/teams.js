import { supabase, unwrap } from './supabase.js';
import { parsePokepasteId, MAX_TEAM_NAME } from '../domain/teams.js';

// Saved teams, the "current team" history, and moving battles between teams.
// Row-level security and column grants (migration 0003) limit all of this to the user's own rows.

const POKEPASTE_MAX_BYTES = 20_000;

export async function listTeams() {
  return unwrap(await supabase.from('teams').select('id, name, species, paste, created_at').order('created_at'));
}

export async function listTeamPeriods() {
  return unwrap(await supabase.from('team_periods').select('team_id, started_at').order('started_at'));
}

/** Makes a team current from now on (the database stamps the time). */
export async function makeCurrent(teamId) {
  unwrap(await supabase.from('team_periods').insert({ team_id: teamId }));
}

/** Saves a team; new teams become current unless `current` is false. */
export async function createTeam({ name, species, paste = '' }, { current = true } = {}) {
  const team = unwrap(await supabase
    .from('teams')
    .insert({ name: name.trim().slice(0, MAX_TEAM_NAME), species, paste })
    .select('id')
    .single());
  if (current) await makeCurrent(team.id);
  return team;
}

export async function renameTeam(teamId, name) {
  unwrap(await supabase.from('teams').update({ name: name.trim().slice(0, MAX_TEAM_NAME) }).eq('id', teamId));
}

/** Deletes a team; its games fall back to whichever team owns their dates (or none). */
export async function deleteTeam(teamId) {
  unwrap(await supabase.from('teams').delete().eq('id', teamId));
}

/** Puts battles in a team, or back to automatic placement with null. */
export async function moveBattles(battleIds, teamId) {
  unwrap(await supabase.from('battles').update({ team_id: teamId }).in('id', battleIds));
}

/** { title, paste } from a PokéPaste link. */
export async function fetchPokepaste(link) {
  const id = parsePokepasteId(link);
  if (!id) throw new Error("That doesn't look like a PokéPaste link.");
  const response = await fetch(`https://pokepast.es/${id}/json`).catch(() => null);
  if (!response?.ok) throw new Error("Couldn't load that PokéPaste — check the link.");
  const text = await response.text();
  if (text.length > POKEPASTE_MAX_BYTES) throw new Error('That paste is too large.');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('PokéPaste sent an unreadable response.'); }
  return { title: String(data?.title ?? ''), paste: String(data?.paste ?? '') };
}
