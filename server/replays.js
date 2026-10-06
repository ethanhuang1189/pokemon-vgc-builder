import { HttpError } from './http.js';
import { parseReplayId, toBattleRecord, PARSE_VERSION } from '../src/domain/replay.js';

// Importing battles. Data always comes from Showdown's replay server — never from the client —
// so a user can't store a battle that didn't happen.

// Only Champions formats are picked up by sync; single imports accept any format.
const SYNC_FORMAT_PREFIX = 'gen9champions';
// Replays imported per sync call, to keep each call short and polite to Showdown.
export const MAX_SYNC_IMPORTS = 10;
// How far back sync looks per linked name (Showdown returns 50 replays per page).
export const MAX_SEARCH_PAGES = 10;
const SEARCH_PAGE_SIZE = 50; // Showdown adds a 51st entry when another page exists

// Failures that won't change on retry; sync remembers these instead of retrying forever.
const PERMANENT_FAILURES = new Set([404, 422]);

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

  /**
   * Champions replays a name appears in that we haven't imported or skipped, oldest first.
   * Paging stops at the end of the results or at a page that's already fully handled —
   * importing oldest-first guarantees nothing unhandled sits beyond such a page.
   */
  async function unhandledReplays(userId, nameId) {
    const found = [];
    for (let page = 1; page <= MAX_SEARCH_PAGES; page++) {
      const results = await showdown.searchReplays(nameId, page);
      const entries = results.slice(0, SEARCH_PAGE_SIZE).filter(e => String(e.id).startsWith(SYNC_FORMAT_PREFIX));
      const handled = await store.handledReplayIds(userId, entries.map(e => e.id));
      const fresh = entries.filter(e => !handled.has(e.id));
      found.push(...fresh);
      const lastPage = results.length <= SEARCH_PAGE_SIZE;
      if (lastPage || (entries.length > 0 && fresh.length === 0)) break;
    }
    return found;
  }

  return {
    /** Imports one replay from a pasted link/id or the bookmarklet. */
    async importReplay(userId, input) {
      const replayId = parseReplayId(input);
      if (!replayId) throw new HttpError(400, "That doesn't look like a Showdown replay link");
      const battle = await importById(userId, replayId, await requireLinkedNames(userId));
      return { battle };
    },

    /**
     * Imports up to MAX_SYNC_IMPORTS uploaded Champions replays, then uses any room left to
     * re-read battles stored by an older parser. Call again while `remaining` > 0.
     */
    async syncRecent(userId) {
      const nameIds = await requireLinkedNames(userId);
      const byId = new Map();
      for (const nameId of nameIds) {
        for (const entry of await unhandledReplays(userId, nameId)) byId.set(entry.id, entry);
      }
      const queue = [...byId.values()].sort((a, b) => (a.uploadtime ?? 0) - (b.uploadtime ?? 0));
      const batch = queue.slice(0, MAX_SYNC_IMPORTS);

      // Imports one replay; on a permanent failure runs `onPermanentFailure` instead of throwing
      // (other failures, e.g. Showdown being down, stop the sync and are reported).
      const attempt = async (id, onPermanentFailure) => {
        try {
          await importById(userId, id, nameIds);
          return true;
        } catch (err) {
          if (!PERMANENT_FAILURES.has(err.status)) throw err;
          await onPermanentFailure(err);
          return false;
        }
      };

      let imported = 0;
      for (const { id } of batch) {
        if (await attempt(id, err => store.skipReplay(userId, id, err.message))) imported++;
      }

      // Use any room left to re-read battles stored by an older parser, so new stats cover them.
      const room = MAX_SYNC_IMPORTS - batch.length;
      const outdated = room > 0 ? await store.outdatedReplayIds(userId, PARSE_VERSION, room + 1) : [];
      for (const id of outdated.slice(0, room)) {
        await attempt(id, () => store.markParsed(userId, id, PARSE_VERSION)); // keep what we have
      }

      const moreOutdated = Math.max(0, outdated.length - room);
      return { imported, remaining: queue.length - batch.length + moreOutdated };
    },
  };
}
