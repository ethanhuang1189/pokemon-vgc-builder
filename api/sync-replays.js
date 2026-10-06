import { authedPost } from '../server/http.js';
import { getServices } from '../server/services.js';

// POST {} → { imported, remaining }: pulls recent uploaded Champions replays for the user's linked names.
export const POST = authedPost(getServices, ({ replays }, user) => replays.syncRecent(user.id));
