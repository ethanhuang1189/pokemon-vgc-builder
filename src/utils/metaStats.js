// Usage stats source priority:
//   1. localStorage cache (12 hours)
//   2. GitHub raw — the latest committed JSON (refreshed daily by the update-meta workflow)
//   3. The JSON bundled at build time
import bundled from '../data/metaStats.json';

const GITHUB_RAW = 'https://raw.githubusercontent.com/ethanhuang1189/pokemon-vgc-builder/main/src/data/metaStats.json';
const CACHE_KEY = 'pkmn_meta_v4';
const LEGACY_CACHE_KEYS = ['pkmn_meta_pika_v1', 'pkmn_meta_pika_v2', 'pkmn_meta_pika_v3'];
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const hasData = (json) => Array.isArray(json?.data) && json.data.length > 0;

function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS && hasData(cached)) {
      return { data: cached.data, label: cached.label };
    }
  } catch { /* missing or corrupt cache */ }
  return null;
}

function writeCache({ data, label }) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data, label }));
  } catch { /* storage full */ }
}

async function fetchLatest() {
  try {
    const res = await fetch(GITHUB_RAW, { cache: 'no-cache' });
    const json = res.ok ? await res.json() : null;
    return hasData(json) ? { data: json.data, label: json.label } : null;
  } catch {
    return null; // offline
  }
}

/** { data: [{ name, slug, usage }], label } or null when no source has data. */
export async function fetchMetaStats() {
  const cached = readCache();
  if (cached) return cached;

  const latest = await fetchLatest();
  if (latest) {
    writeCache(latest);
    return latest;
  }
  return hasData(bundled) ? { data: bundled.data, label: `${bundled.label} (cached)` } : null;
}

export function clearMetaCache() {
  try {
    [CACHE_KEY, ...LEGACY_CACHE_KEYS].forEach(key => localStorage.removeItem(key));
  } catch { /* storage unavailable */ }
}
