// Meta stats source priority:
// 1. GitHub raw URL — always the latest committed JSON (updated daily by Actions)
// 2. Bundled static JSON — fallback if fetch fails or offline
// Results are cached in localStorage for 12 hours.

import bundled from '../data/metaStats.json';

const GITHUB_RAW = 'https://raw.githubusercontent.com/ethanhuang1189/pokemon-vgc-builder/main/src/data/metaStats.json';
const CACHE_KEY  = 'pkmn_meta_v4';
const CACHE_TTL  = 12 * 60 * 60 * 1000; // 12 hours

export async function fetchMetaStats() {
  // Return fresh cache
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const c = JSON.parse(raw);
      if (Date.now() - c.timestamp < CACHE_TTL && c.data?.length > 0) {
        return { data: c.data, label: c.label };
      }
    }
  } catch { /* corrupt cache */ }

  // Try GitHub raw URL for latest committed data
  try {
    const res = await fetch(GITHUB_RAW, { cache: 'no-cache' });
    if (res.ok) {
      const json = await res.json();
      if (json?.data?.length > 0) {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            data:  json.data,
            label: json.label,
          }));
        } catch { /* storage full */ }
        return { data: json.data, label: json.label };
      }
    }
  } catch { /* offline or private repo */ }

  // Fall back to the bundled static JSON
  if (bundled?.data?.length > 0) {
    return { data: bundled.data, label: bundled.label + ' (cached)' };
  }

  return null;
}

export function clearMetaCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    // Clear old cache keys from previous versions
    localStorage.removeItem('pkmn_meta_pika_v1');
    localStorage.removeItem('pkmn_meta_pika_v2');
    localStorage.removeItem('pkmn_meta_pika_v3');
  } catch { /* ignore */ }
}
