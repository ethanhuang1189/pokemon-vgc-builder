import { parseBattleLog, baseOfMega } from './replay.js';
import { toId } from './ids.js';

// Top teams from public Pokémon Showdown ladder replays (the simulator, not the Champions game).
// Shared by the collector (server) and the Top Teams card (browser).

/** Showdown's format id for each regulation the collector follows. */
export const LADDER_FORMATS = Object.freeze({ 'M-C': 'gen9championsvgc2026regmc' });

// Players are counted when their own pre-game rating is at least this.
export const MIN_PLAYER_RATING = 1500;
// Showdown's replay search reports a battle's rating as the lower of the two players', so replays
// a bit below the cutoff can still hold a 1500+ player.
export const MIN_SEARCH_RATING = 1400;

// What a team or core needs before it's listed.
export const MIN_PLAYERS = 3;
export const MIN_GAMES = 10;
// Ranking pulls each record toward 50% by this many games (see adjustedWinRate).
export const LADDER_PRIOR_GAMES = 20;

export const CORE_SIZE = 4;
const TEAM_SIZE = 6;

// Bump when ladderEntries learns something new; older rows can then be re-read.
export const LADDER_PARSE_VERSION = 1;

// Ladder bots (e.g. "pcrlbot12d159c39a") play thousands of scripted games.
const BOT_NAME = /^[a-z]*bot[0-9a-f]{6,}$/;
export const isBot = (name) => BOT_NAME.test(toId(name));

/** The species, sorted and joined: the same six (or four) in any order share a key. */
export const groupKey = (species) => [...species].sort().join('|');
export const speciesOfKey = (key) => (key ? key.split('|') : []);

/** Every CORE_SIZE-Pokémon subset of a team, as group keys (15 for a team of six). */
export function coreKeys(team, size = CORE_SIZE) {
  const sorted = [...new Set(team)].sort();
  const cores = [];
  const pick = (start, chosen) => {
    if (chosen.length === size) { cores.push(chosen.join('|')); return; }
    for (let i = start; i < sorted.length; i++) pick(i + 1, [...chosen, sorted[i]]);
  };
  pick(0, []);
  return cores;
}

/**
 * One row per 1500+ player in a finished replay (0–2 rows): their six, what they brought and
 * led with, moves, items and abilities revealed, mega, result and pre-game rating.
 */
export function ladderEntries(replay) {
  const battle = parseBattleLog(replay?.log);
  if (!battle.winner && !battle.tie) return [];
  const playedAt = new Date((replay.uploadtime ?? 0) * 1000).toISOString();

  return ['p1', 'p2'].flatMap(side => {
    const name = battle.players[side];
    const rating = battle.ratings[side].before;
    const team = battle.teams[side];
    if (!name || isBot(name) || !(rating >= MIN_PLAYER_RATING) || team.length !== TEAM_SIZE) return [];
    const result = battle.tie ? 'tie' : toId(battle.winner) === toId(name) ? 'win' : 'loss';
    return [{
      replay_id: replay.id,
      side,
      format_id: replay.formatid ?? toId(replay.format),
      played_at: playedAt,
      player_id: toId(name),
      rating,
      result,
      team,
      team_key: groupKey(team),
      core_keys: coreKeys(team),
      brought: battle.brought[side],
      leads: battle.leads[side],
      mega: battle.megas[side],
      moves: battle.moves[side],
      items: battle.items[side],
      abilities: battle.abilities[side],
      parse_version: LADDER_PARSE_VERSION,
    }];
  });
}

// "Floette-Mega" is Floette-Eternal's mega: match on the forme the mega came from.
const isMegaOf = (mega, species) => {
  const base = baseOfMega(mega);
  return species === base || species.startsWith(`${base}-`);
};

/** Counts of each value, most common first, with its share of `of` (default: the total). */
function ranked(counts, of) {
  const total = of ?? [...counts.values()].reduce((a, b) => a + b, 0);
  return [...counts]
    .map(([name, count]) => ({ name, count, share: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

const bump = (map, key, by = 1) => map.set(key, (map.get(key) ?? 0) + by);

/**
 * What players did with one team or core, from its entries: record, most common four brought,
 * leads, and per Pokémon how often it was brought, mega evolved, and its moves, items and
 * abilities (shares of the games it was brought, or of the moves it used).
 */
export function summarizeEntries(entries, species = []) {
  const record = { games: entries.length, wins: 0, losses: 0, ties: 0 };
  const players = new Set();
  const broughtSets = new Map();
  const leadPairs = new Map();
  const bySpecies = new Map();
  const member = (name) => {
    if (!bySpecies.has(name)) {
      bySpecies.set(name, { name, games: 0, brought: 0, megas: 0, moves: new Map(), items: new Map(), abilities: new Map() });
    }
    return bySpecies.get(name);
  };

  for (const entry of entries) {
    record[{ win: 'wins', loss: 'losses', tie: 'ties' }[entry.result]] += 1;
    players.add(entry.player_id ?? entry.replay_id);
    if (entry.brought?.length) bump(broughtSets, groupKey(entry.brought));
    if (entry.leads?.length === 2) bump(leadPairs, groupKey(entry.leads));
    for (const name of entry.team ?? []) member(name).games += 1;
    for (const name of entry.brought ?? []) {
      const m = member(name);
      m.brought += 1;
      if (entry.mega && isMegaOf(entry.mega, name)) m.megas += 1;
    }
    for (const [name, used] of Object.entries(entry.moves ?? {})) {
      for (const [move, uses] of Object.entries(used ?? {})) bump(member(name).moves, move, Number(uses) || 0);
    }
    for (const [name, item] of Object.entries(entry.items ?? {})) bump(member(name).items, item);
    for (const [name, ability] of Object.entries(entry.abilities ?? {})) bump(member(name).abilities, ability);
  }

  const order = (name) => (species.includes(name) ? species.indexOf(name) : species.length);
  return {
    record: { ...record, winRate: record.games ? record.wins / record.games : 0 },
    players: players.size,
    brought: ranked(broughtSets, record.games).map(b => ({ ...b, species: speciesOfKey(b.name) })),
    leads: ranked(leadPairs, record.games).map(l => ({ ...l, species: speciesOfKey(l.name) })),
    members: [...bySpecies.values()]
      .map(m => ({
        name: m.name,
        broughtRate: m.games ? m.brought / m.games : 0,
        megaRate: m.brought ? m.megas / m.brought : 0,
        moves: ranked(m.moves),
        // Items and abilities: share of the games where this Pokémon revealed one.
        items: ranked(m.items),
        abilities: ranked(m.abilities),
      }))
      .sort((a, b) => order(a.name) - order(b.name) || b.broughtRate - a.broughtRate || a.name.localeCompare(b.name)),
  };
}

/** The full teams (by key) a core's entries came from, most used first. */
export function teamsWithCore(entries, count = 5) {
  const byTeam = new Map();
  for (const entry of entries) {
    const row = byTeam.get(entry.team_key) ?? { key: entry.team_key, team: entry.team, games: 0, wins: 0 };
    row.games += 1;
    if (entry.result === 'win') row.wins += 1;
    byTeam.set(entry.team_key, row);
  }
  return [...byTeam.values()]
    .map(r => ({ ...r, winRate: r.wins / r.games }))
    .sort((a, b) => b.games - a.games || b.wins - a.wins || a.key.localeCompare(b.key))
    .slice(0, count);
}

/**
 * A short Showdown paste for a team: each Pokémon with its most common revealed item, ability
 * and top four moves, ready for the builder's import. EVs and natures aren't in replays.
 */
export function pasteFromSummary(summary, species) {
  const byName = new Map(summary.members.map(m => [m.name, m]));
  return species.map(name => {
    const m = byName.get(name);
    const lines = [m?.items[0] ? `${name} @ ${m.items[0].name}` : name];
    if (m?.abilities[0]) lines.push(`Ability: ${m.abilities[0].name}`);
    for (const move of m?.moves.slice(0, 4) ?? []) lines.push(`- ${move.name}`);
    return lines.join('\n');
  }).join('\n\n');
}
