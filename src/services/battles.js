import { supabase, unwrap } from './supabase.js';
import { toId } from '../domain/ids.js';

// Battles are read and deleted straight from Supabase (row-level security limits each user to
// their own). Imports go through our /api functions, which fetch the replay from Showdown.

const MAX_BATTLES = 1000;

async function callApi(path, body = {}) {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? `Request failed (${response.status})`);
  return result;
}

// Safety cap on sync calls per run (each imports up to 10 replays).
const MAX_SYNC_ROUNDS = 20;

export const importReplay = (replay) => callApi('/api/import-replay', { replay });

/** Syncs until Showdown has nothing new left (or the round cap). Resolves to { imported, remaining }. */
export async function syncAllReplays() {
  let imported = 0;
  for (let round = 0; round < MAX_SYNC_ROUNDS; round++) {
    const result = await callApi('/api/sync-replays');
    imported += result.imported;
    if (!result.remaining) return { imported, remaining: 0 };
  }
  return { imported, remaining: 1 };
}

export async function listBattles() {
  return unwrap(await supabase.from('battles').select('*').order('played_at', { ascending: false }).limit(MAX_BATTLES));
}

export async function deleteBattle(id) {
  unwrap(await supabase.from('battles').delete().eq('id', id));
}

export async function listShowdownNames() {
  return unwrap(await supabase.from('showdown_names').select('name, name_id').order('created_at'));
}

export async function addShowdownName(name) {
  const trimmed = name.trim();
  unwrap(await supabase.from('showdown_names').insert({ name: trimmed, name_id: toId(trimmed) }));
}

export async function removeShowdownName(nameId) {
  unwrap(await supabase.from('showdown_names').delete().eq('name_id', nameId));
}
