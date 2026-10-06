// Remembers when something last ran (per browser) so automatic work isn't repeated too often.

/** True — and starts a new cooldown — if `key` hasn't run within `ms`. */
export function startCooldown(key, ms) {
  try {
    const last = Number(localStorage.getItem(key)) || 0;
    if (Date.now() - last < ms) return false;
    localStorage.setItem(key, String(Date.now()));
  } catch { /* storage unavailable: just run */ }
  return true;
}
