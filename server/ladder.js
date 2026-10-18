import { ladderEntries, MIN_SEARCH_RATING } from '../src/domain/ladder.js';

// Collects 1500+ ladder games from Showdown's public replay search for the Top Teams card.
//
// The search lists replays newest first, 50 per page. Each scan walks down from the newest
// replay until it reaches what the previous scan already covered (`newest`); the very first
// scan therefore walks back through the whole regulation. A scan can span many runs: its
// position is saved after every page, so a run that hits its time budget picks up where it
// stopped, and a page that failed (Showdown down) is simply read again next time.

const PAGE_SIZE = 50; // Showdown adds a 51st entry when another page exists
export const MAX_PAGES_PER_RUN = 40;
const DOWNLOADS_AT_ONCE = 4;

/** Runs `fn` over `items`, at most `limit` at a time, keeping the order of results. */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * `pauseMs` waits between search pages, to go easy on Showdown during long backfills.
 */
export function createLadderCollector({ store, showdown, formatId, now = () => Date.now(), budgetMs = 45_000, maxPages = MAX_PAGES_PER_RUN, pauseMs = 0 }) {
  /** The 1500+ players' rows from these search entries; a replay that's gone gives none. */
  async function collect(entries) {
    const known = await store.knownReplayIds(entries.map(e => e.id));
    const todo = entries.filter(e => !known.has(e.id));
    const rows = await mapLimit(todo, DOWNLOADS_AT_ONCE, async (entry) => {
      const replay = await showdown.fetchReplay(entry.id); // throws if Showdown is unreachable
      return replay ? ladderEntries(replay) : [];
    });
    return { downloaded: todo.length, rows: rows.flat() };
  }

  return {
    /**
     * One run: scans pages until the scan finishes or the time/page budget runs out.
     * Returns { pages, downloaded, saved, done } — `done` means the scan reached the newest
     * replays the previous scan had covered (call again while it's false).
     */
    async run() {
      const deadline = now() + budgetMs;
      const state = (await store.getState(formatId)) ?? { newest: 0, scan_top: null, scan_cursor: null };
      let top = state.scan_cursor === null ? null : state.scan_top;
      let cursor = state.scan_cursor;
      const totals = { pages: 0, downloaded: 0, saved: 0, done: false };

      while (totals.pages < maxPages && now() < deadline) {
        // "before" is exclusive; asking for cursor + 1 re-reads replays sharing the cursor's
        // second (already-saved ones are skipped), unless that would read the same page again.
        let results = await showdown.searchFormat(formatId, cursor === null ? null : cursor + 1);
        if (cursor !== null && (results[PAGE_SIZE - 1]?.uploadtime ?? -1) >= cursor) {
          results = await showdown.searchFormat(formatId, cursor);
        }
        totals.pages += 1;
        const page = results.slice(0, PAGE_SIZE);
        if (!page.length) { totals.done = true; break; }
        top ??= page[0].uploadtime;

        const unscanned = page.filter(e => e.uploadtime > state.newest);
        const { downloaded, rows } = await collect(unscanned.filter(e => (e.rating ?? 0) >= MIN_SEARCH_RATING));
        if (rows.length) await store.saveEntries(rows);
        totals.downloaded += downloaded;
        totals.saved += rows.length;

        cursor = page.at(-1).uploadtime;
        const reachedOldScan = unscanned.length < page.length;
        const lastPage = results.length <= PAGE_SIZE;
        if (reachedOldScan || lastPage) { totals.done = true; break; }
        await store.setState(formatId, { newest: state.newest, scan_top: top, scan_cursor: cursor });
        if (pauseMs) await new Promise(resolve => setTimeout(resolve, pauseMs));
      }

      if (totals.done) {
        await store.setState(formatId, { newest: Math.max(state.newest, top ?? 0), scan_top: null, scan_cursor: null });
      }
      if (totals.saved || totals.done) await store.refreshStats();
      return totals;
    },
  };
}
