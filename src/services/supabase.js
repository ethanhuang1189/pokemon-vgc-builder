import { createClient } from '@supabase/supabase-js';

// Browser client. The publishable key is meant to be public: row-level security decides what
// it can touch. Null when the env vars aren't set, so the rest of the app still works.
const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = url && publishableKey
  ? createClient(url, publishableKey, { auth: { flowType: 'pkce' } })
  : null;

/** Unwraps a Supabase response, throwing its error. */
export function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}
