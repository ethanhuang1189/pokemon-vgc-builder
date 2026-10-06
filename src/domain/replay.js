import { toId } from './ids.js';

// Pokémon Showdown replays: https://replay.pokemonshowdown.com/<id>.json
// Shared by the server (import) and the browser (input validation).

export const REPLAY_HOST = 'https://replay.pokemonshowdown.com';

// "<format>-<number>", plus "-<password>pw" for unlisted replays.
const REPLAY_ID = /^[a-z0-9]+-\d+(?:-[a-z0-9]+pw)?$/;
const MAX_REPLAY_ID_LENGTH = 100;

/**
 * Accepts a replay id, replay URL or battle-room path and returns the bare replay id,
 * or null for anything else (including links to other sites).
 */
export function parseReplayId(input) {
  const id = String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/^(?:https?:\/\/)?(?:[a-z0-9-]+\.)*pokemonshowdown\.com\//, '')
    .replace(/[?#].*$/, '')
    .replace(/\.(?:json|log)$/, '')
    .replace(/^battle-/, '');
  return id.length <= MAX_REPLAY_ID_LENGTH && REPLAY_ID.test(id) ? id : null;
}

export const replayUrl = (replayId) => `${REPLAY_HOST}/${encodeURIComponent(replayId)}`;

// "Garchomp-Mega-Z, L50, F" → "Garchomp-Mega-Z"; team preview's "Urshifu-*" → "Urshifu"
const speciesOf = (details) => details.split(',')[0].replace(/-\*$/, '').trim();

/** The forme a mega evolved from: "Metagross-Mega" → "Metagross", "Meowstic-F-Mega" → "Meowstic-F". */
export const baseOfMega = (species) => species.split('-Mega')[0];

const sideOf = (ident) => ident.slice(0, 2); // "p1a: Nickname" → "p1"

/**
 * Pulls what we track out of a battle log: players, the six on each team, the Pokémon
 * actually brought, who mega evolved, turn count and the outcome.
 */
export function parseBattleLog(log) {
  const players = {};
  const teams = { p1: [], p2: [] };
  const brought = { p1: new Set(), p2: new Set() };
  const megas = { p1: null, p2: null };
  let turns = 0;
  let winner = null;
  let tie = false;

  for (const line of String(log ?? '').split('\n')) {
    const [, type, ...args] = line.split('|');
    switch (type) {
      case 'player':
        if (args[1]) players[args[0]] = args[1];
        break;
      case 'poke':
        teams[args[0]]?.push(speciesOf(args[1]));
        break;
      case 'switch':
      case 'drag':
      case 'replace':
        brought[sideOf(args[0])]?.add(baseOfMega(speciesOf(args[1])));
        break;
      case 'detailschange':
        if (speciesOf(args[1]).includes('-Mega')) megas[sideOf(args[0])] = speciesOf(args[1]);
        break;
      case 'turn':
        turns = Math.max(turns, Number(args[0]) || 0);
        break;
      case 'win':
        winner = args[0];
        break;
      case 'tie':
        tie = true;
        break;
    }
  }

  return {
    players,
    teams,
    brought: { p1: [...brought.p1], p2: [...brought.p2] },
    megas,
    turns,
    winner,
    tie,
  };
}

export const IMPORT_ERRORS = Object.freeze({
  notYourBattle: 'None of your linked Showdown names played in this battle.',
  unfinished: 'This battle has no result yet.',
});

/**
 * Turns a replay into a stored battle from the point of view of whichever player is one
 * of `linkedNameIds`. Returns { record } or { error } (an IMPORT_ERRORS message).
 */
export function toBattleRecord(replay, linkedNameIds) {
  const battle = parseBattleLog(replay.log);
  const nameOf = (side, i) => battle.players[side] ?? replay.players?.[i] ?? '';
  const names = { p1: nameOf('p1', 0), p2: nameOf('p2', 1) };

  const side = ['p1', 'p2'].find(s => linkedNameIds.has(toId(names[s])));
  if (!side) return { error: IMPORT_ERRORS.notYourBattle };
  const opponent = side === 'p1' ? 'p2' : 'p1';

  if (!battle.tie && !battle.winner) return { error: IMPORT_ERRORS.unfinished };
  const result = battle.tie ? 'tie' : toId(battle.winner) === toId(names[side]) ? 'win' : 'loss';

  return {
    record: {
      replay_id: replay.id,
      format: replay.format,
      format_id: replay.formatid ?? toId(replay.format),
      played_at: new Date(replay.uploadtime * 1000).toISOString(),
      rating: Number.isInteger(replay.rating) ? replay.rating : null,
      result,
      player_name: names[side],
      opponent_name: names[opponent],
      team: battle.teams[side],
      brought: battle.brought[side],
      mega: battle.megas[side],
      opponent_team: battle.teams[opponent],
      opponent_brought: battle.brought[opponent],
      opponent_mega: battle.megas[opponent],
      turns: battle.turns,
    },
  };
}
