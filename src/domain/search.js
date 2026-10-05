import { ALL_TYPES, resistsAll } from './typeChart.js';

// Filtering behind the picker search boxes.

const RESIST_PREFIX = 'resist:';

const normalizeQuery = (query) => String(query ?? '').toLowerCase().trim();

/** Types named after "resist:" (prefix matches, so "resist: fi wat" → Fire, Water); null when not a resist query. */
export function parseResistQuery(query) {
  const q = normalizeQuery(query);
  if (!q.startsWith(RESIST_PREFIX)) return null;
  const words = q.slice(RESIST_PREFIX.length).split(/\s+/).filter(Boolean);
  const types = words.map(w => ALL_TYPES.find(t => t.toLowerCase().startsWith(w))).filter(Boolean);
  return [...new Set(types)];
}

/**
 * Species matching the search box and active filters.
 * filters: { query, types: string[], learnerIds: Set|null, ability: string|null }
 * learnerIds is null while the move index is still loading (the move filter is then ignored).
 */
export function filterSpecies(species, { query = '', types = [], learnerIds = null, ability = null } = {}) {
  const resistTypes = parseResistQuery(query);
  if (resistTypes) return species.filter(s => resistsAll(s.types, resistTypes));

  const q = normalizeQuery(query);
  return species.filter(s =>
    (!q || s.name.toLowerCase().includes(q)) &&
    types.every(t => s.types.includes(t)) &&
    (!learnerIds || learnerIds.has(s.id)) &&
    (!ability || Object.values(s.abilities).includes(ability)),
  );
}

/** Moves matching the search text, type and category filters. */
export function filterMoves(moves, { query = '', type = null, category = null } = {}) {
  const q = normalizeQuery(query);
  return moves.filter(m =>
    (!q || m.name.toLowerCase().includes(q)) &&
    (!type || m.type === type) &&
    (!category || m.category === category),
  );
}

/** Entries whose name or short description contains the query (abilities, items). */
export function filterByText(entries, query) {
  const q = normalizeQuery(query);
  if (!q) return entries;
  return entries.filter(e => e.name.toLowerCase().includes(q) || e.shortDesc?.toLowerCase().includes(q));
}

/** Types appearing in a move list, in canonical order (for the type filter chips). */
export const typesIn = (moves) => {
  const present = new Set(moves.map(m => m.type));
  return ALL_TYPES.filter(t => present.has(t));
};
