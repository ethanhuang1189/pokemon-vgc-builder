import { HttpError } from './http.js';
import { parseReplayId, toBattleRecord } from '../src/domain/replay.js';

// Importing battles. Data always comes from Showdown's replay server — never from the client —
// so a user can't store a battle that didn't happen.

// Only Champions formats are picked up by sync; single imports accept any format.
const SYNC_FORMAT_PREFIX = 'gen9champions';
// New replays imported per sync, to keep each call short and polite to Showdown.
export const MAX_SYNC_IMPORTS = 10;

export function createReplayService({ store, showdown }) {
  async function requireLinkedNames(userId) {
    const nameIds = await store.linkedNameIds(userId);
    if (!nameIds.size) throw new HttpError(422, 'Add your Showdown username first');
    return nameIds;
  }

  async function importById(userId, replayId, nameIds) {
    const replay = await showdown.fetchReplay(replayId);
    if (!replay) throw new HttpError(404, 'Replay not found — make sure it was uploaded, then try again');
    const { record, error } = toBattleRecord(replay, nameIds);
    if (error) throw new HttpError(422, error);
    return store.saveBattle(userId, record);
  }

  return {
    /** Imports one replay from a pasted link/id or the bookmarklet. */
    async importReplay(userId, input) {
      const replayId = parseReplayId(input);
      if (!replayId) throw new HttpError(400, "That doesn't look like a Showdown replay link");
      const battle = await importById(userId, replayId, await requireLinkedNames(userId));
      return { battle };
    },

    /** Imports recent uploaded Champions replays for every linked name. */
    async syncRecent(userId) {
      const nameIds = await requireLinkedNames(userId);
      const found = new Map();
      for (const nameId of nameIds) {
        for (const entry of await showdown.searchReplays(nameId)) {
          if (String(entry.id).startsWith(SYNC_FORMAT_PREFIX)) found.set(entry.id, entry);
        }
      }

      const known = await store.existingReplayIds(userId, [...found.keys()]);
      const fresh = [...found.keys()].filter(id => !known.has(id)).slice(0, MAX_SYNC_IMPORTS);

      let imported = 0;
      for (const replayId of fresh) {
        try {
          await importById(userId, replayId, nameIds);
          imported++;
        } catch (err) {
          if (!(err instanceof HttpError)) throw err; // skip replays that can't be imported
        }
      }
      return { imported, remaining: Math.max(0, found.size - known.size - fresh.length) };
    },
  };
}
