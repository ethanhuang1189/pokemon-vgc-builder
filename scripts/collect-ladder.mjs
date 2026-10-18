// Runs the Top Teams collector from your machine until its scan is finished — use it once to
// backfill a whole regulation (tens of thousands of replays; it resumes if stopped).
//   node --env-file=.env.local scripts/collect-ladder.mjs
// Needs VITE_SUPABASE_URL and SUPABASE_SECRET_KEY, like the /api functions.
import { getServices } from '../server/services.js';
import { createLadderCollector } from '../server/ladder.js';

const { ladderOptions } = getServices();
// Bigger runs than the scheduled job; each still saves its place after every page.
// Pauses between pages: a whole regulation is thousands of pages, so go easy on Showdown.
const collector = createLadderCollector({ ...ladderOptions, budgetMs: 10 * 60_000, maxPages: 400, pauseMs: 500 });

const RETRY_WAIT_MS = 30_000;
const MAX_FAILURES_IN_A_ROW = 5;

let total = 0;
let failures = 0;
for (let run = 1; ; run++) {
  const started = Date.now();
  let result;
  try {
    result = await collector.run();
    failures = 0;
  } catch (err) {
    // Showdown hiccups: the scan's place is saved, so wait and carry on.
    if (++failures >= MAX_FAILURES_IN_A_ROW) throw err;
    console.warn(`run ${run} failed (${err.message}); retrying in ${RETRY_WAIT_MS / 1000}s`);
    await new Promise(resolve => setTimeout(resolve, RETRY_WAIT_MS));
    continue;
  }
  const { pages, downloaded, saved, done } = result;
  total += saved;
  console.log(`run ${run}: ${pages} pages, ${downloaded} replays read, ${saved} rows saved (${total} total) in ${Math.round((Date.now() - started) / 1000)}s`);
  if (done) break;
}
console.log('Scan finished; summaries refreshed.');
