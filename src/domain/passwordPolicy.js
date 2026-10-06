// Password rules checked before anything is sent to the auth server, following NIST SP 800-63B:
// a length floor, a generous ceiling, no composition rules. The real enforcement (and hashing)
// happens in Supabase Auth — set its minimum length to match (see README).

export const MIN_PASSWORD_LENGTH = 8;
// bcrypt (used by Supabase Auth) only reads the first 72 bytes, so longer passwords add nothing.
export const MAX_PASSWORD_BYTES = 72;

const byteLength = (text) => new TextEncoder().encode(text).length;

/** The first problem with a new password, or null if it's acceptable. */
export function passwordProblem(password, email = '') {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (byteLength(password) > MAX_PASSWORD_BYTES) return `Use at most ${MAX_PASSWORD_BYTES} bytes (about ${MAX_PASSWORD_BYTES} letters).`;
  if (email && password.trim().toLowerCase() === email.trim().toLowerCase()) return "Don't use your email as your password.";
  return null;
}
