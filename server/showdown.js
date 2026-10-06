import { HttpError } from './http.js';
import { REPLAY_HOST } from '../src/domain/replay.js';

// Read-only access to Showdown's public replay API, with a timeout and size cap so a slow or
// oversized response can't tie up the function.

const TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 3_000_000;

async function getJson(url, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'application/json' } });
  } catch {
    throw new HttpError(502, "Couldn't reach Pokémon Showdown — try again shortly");
  }
  if (response.status === 404) return null;
  if (!response.ok) throw new HttpError(502, `Pokémon Showdown returned an error (${response.status})`);

  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) throw new HttpError(502, 'Replay is too large to import');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(502, 'Pokémon Showdown sent an unreadable response');
  }
}

export function createShowdownClient(fetchImpl = fetch) {
  return {
    /** The replay with this id, or null if it doesn't exist (yet). */
    async fetchReplay(replayId) {
      const replay = await getJson(`${REPLAY_HOST}/${encodeURIComponent(replayId)}.json`, fetchImpl);
      const valid = replay && replay.id === replayId && typeof replay.log === 'string';
      return valid ? replay : null;
    },

    /** Recent public replays a player appears in (newest first). */
    async searchReplays(nameId) {
      const results = await getJson(`${REPLAY_HOST}/search.json?user=${encodeURIComponent(nameId)}`, fetchImpl);
      return Array.isArray(results) ? results : [];
    },
  };
}
