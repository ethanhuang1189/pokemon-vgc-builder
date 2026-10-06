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

export const importReplay = (replay) => callApi('/api/import-replay', { replay });
export const syncReplays = () => callApi('/api/sync-replays');

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
