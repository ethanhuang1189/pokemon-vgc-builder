// How many team members share a weakness/type before it's flagged.
export const CRITICAL_COUNT = 3;

/** Red at CRITICAL_COUNT+, amber at 2, `fallback` otherwise. */
export const severityColor = (count, fallback = '#6b7280') =>
  count >= CRITICAL_COUNT ? '#ef4444' : count === 2 ? '#f59e0b' : fallback;
