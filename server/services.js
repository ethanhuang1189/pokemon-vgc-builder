import { createClient } from '@supabase/supabase-js';
import { HttpError } from './http.js';
import { createBattleStore } from './store.js';
import { createShowdownClient } from './showdown.js';
import { createReplayService } from './replays.js';

// Wires the real dependencies together once per function instance.
// SUPABASE_SECRET_KEY is server-only: it must never get a VITE_ prefix (that would ship it to browsers).

let services = null;

function readConfig() {
  const url = process.env.VITE_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey || secretKey.startsWith('sb_publishable_')) {
    console.error('Battle tracking needs VITE_SUPABASE_URL and SUPABASE_SECRET_KEY (a secret key, not the publishable one).');
    throw new HttpError(503, 'Battle tracking is not set up on this server');
  }
  return { url, secretKey };
}

export function getServices() {
  if (!services) {
    const { url, secretKey } = readConfig();
    const supabase = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
    services = {
      auth: supabase.auth,
      replays: createReplayService({ store: createBattleStore(supabase), showdown: createShowdownClient() }),
    };
  }
  return services;
}
