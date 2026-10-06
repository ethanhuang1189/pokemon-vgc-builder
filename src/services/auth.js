import { supabase, unwrap } from './supabase.js';

// Email + password accounts via Supabase Auth, which stores bcrypt hashes and handles email
// confirmation, rate limiting and token refresh. Messages are deliberately generic so they
// never reveal whether an email has an account.

const siteUrl = () => window.location.origin;

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(error.code === 'email_not_confirmed'
      ? 'Confirm your email first — check your inbox for the link.'
      : 'Email or password is incorrect.');
  }
}

export async function signUp(email, password) {
  unwrap(await supabase.auth.signUp({ email, password, options: { emailRedirectTo: siteUrl() } }));
}

export async function sendPasswordReset(email) {
  unwrap(await supabase.auth.resetPasswordForEmail(email, { redirectTo: siteUrl() }));
}

export async function updatePassword(password) {
  unwrap(await supabase.auth.updateUser({ password }));
}

export async function signOut() {
  unwrap(await supabase.auth.signOut());
}
