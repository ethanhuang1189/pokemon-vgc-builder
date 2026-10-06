import { parseHeader } from './showdown.js';
import { baseOfMega } from './replay.js';
import { groupByTeam, latestPlayed, summarizeBattles, time } from './battleStats.js';

// Saved teams and the "current team". A team owns the games played from each time it was made
// current (team_periods.started_at) until the next team was; a battle's team_id overrides that.

export const MAX_TEAM_NAME = 60;
const TEAM_SIZE = 6;

const POKEPASTE_URL = /^(?:https?:\/\/)?(?:www\.)?pokepast\.es\/([0-9a-f]{8,32})(?:\/(?:raw|json))?\/?$/i;

/** The paste id from a PokéPaste link, or null for anything else. */
export function parsePokepasteId(input) {
  return String(input ?? '').trim().match(POKEPASTE_URL)?.[1].toLowerCase() ?? null;
}

/** Up to six species from Showdown paste text, as team preview shows them (megas as their base). */
export function speciesFromPaste(text) {
  const blocks = String(text ?? '').trim().split(/\r?\n\s*\r?\n/).filter(b => b.trim());
  return blocks
    .map(block => baseOfMega(parseHeader(block.split(/\r?\n/)[0]).speciesName))
    .filter(Boolean)
    .slice(0, TEAM_SIZE);
}

function savedGroup(team, battles) {
  return { key: `team-${team.id}`, saved: team, species: team.species, battles, lastPlayed: latestPlayed(battles), ...summarizeBattles(battles) };
}

/** The display name of a team group (saved teams have names; iterations don't). */
export const groupTitle = (group) => group?.saved?.name ?? 'Unnamed iteration';

/** Every group from organizeBattles(), current first. */
export const allGroups = ({ current, older, iterations }) => [...(current ? [current] : []), ...older, ...iterations];

/**
 * Sorts battles into { current, older, iterations }:
 *   current    — the team made current most recently (null before any team exists)
 *   older      — every other saved team, most recently used first
 *   iterations — games no saved team owns, grouped by their exact six Pokémon
 */
export function organizeBattles(battles, teams, periods) {
  const teamsById = new Map(teams.map(t => [t.id, t]));
  const timeline = periods
    .filter(p => teamsById.has(p.team_id))
    .sort((a, b) => time(a.started_at) - time(b.started_at));

  const owner = (battle) => {
    if (teamsById.has(battle.team_id)) return battle.team_id;
    let teamId = null;
    for (const period of timeline) {
      if (time(period.started_at) > time(battle.played_at)) break;
      teamId = period.team_id;
    }
    return teamId;
  };

  const owned = new Map(teams.map(t => [t.id, []]));
  const unowned = [];
  for (const battle of battles) {
    const teamId = owner(battle);
    if (teamId === null) unowned.push(battle);
    else owned.get(teamId).push(battle);
  }

  const currentId = timeline.at(-1)?.team_id ?? null;
  const lastUsed = (team) => Math.max(
    time(latestPlayed(owned.get(team.id))),
    ...timeline.filter(p => p.team_id === team.id).map(p => time(p.started_at)),
    time(team.created_at),
  );

  return {
    current: currentId === null ? null : savedGroup(teamsById.get(currentId), owned.get(currentId)),
    older: teams
      .filter(t => t.id !== currentId)
      .sort((a, b) => lastUsed(b) - lastUsed(a))
      .map(t => savedGroup(t, owned.get(t.id))),
    iterations: groupByTeam(unowned),
  };
}
