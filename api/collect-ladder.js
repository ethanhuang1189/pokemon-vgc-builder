import { cronPost } from '../server/http.js';
import { getServices } from '../server/services.js';

// POST (Authorization: Bearer LADDER_CRON_SECRET) → { pages, downloaded, saved, done }:
// one Top Teams collection run, called on a schedule by .github/workflows/collect-ladder.yml.
export const POST = cronPost('LADDER_CRON_SECRET', getServices, ({ ladder }) => ladder.run());
