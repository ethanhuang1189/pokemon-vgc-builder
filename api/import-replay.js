import { authedPost } from '../server/http.js';
import { getServices } from '../server/services.js';

// POST { replay: "<replay link or id>" } → { battle }
export const POST = authedPost(getServices, ({ replays }, user, body) => replays.importReplay(user.id, body.replay));
