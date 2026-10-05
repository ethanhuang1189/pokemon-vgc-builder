import { serializeTeam, deserializeTeam, makeEmptyTeam } from '../domain/team.js';

const STORAGE_KEY = 'vgc-team';

/** The saved team, or an empty one if nothing usable is stored. */
export function loadTeam(format) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return deserializeTeam(JSON.parse(saved), format);
  } catch { /* unavailable storage or corrupt JSON */ }
  return makeEmptyTeam();
}

export function saveTeam(team) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeTeam(team)));
  } catch { /* storage full or unavailable */ }
}
