// Fetches Pokemon Champions Regulation MA usage data from Pikalytics.
// The page serves HTML with <a href="/pokedex/gen9championsvgc2026regma/PokemonName"> entries
// containing the Pokemon name and usage %. Fetched via CORS proxy since pikalytics.com
// doesn't set cross-origin headers.

const FORMAT_SLUG = 'gen9championsvgc2026regma';
const PIKA_URL    = `https://www.pikalytics.com/pokedex/${FORMAT_SLUG}/`;
const CACHE_KEY   = 'pkmn_meta_pika_v1';
const CACHE_TTL   = 12 * 60 * 60 * 1000; // 12 hours

async function fetchWithTimeout(url, ms = 7000) {
  const ctrl = new AbortController();
  const id   = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

async function tryFetchHtml(url) {
  // 1. allorigins — most reliable CORS proxy
  try {
    const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const res = await fetchWithTimeout(proxy, 10000);
    if (res.ok) {
      const html = await res.text();
      if (html.length > 500) return html;
    }
  } catch { /* proxy down */ }

  // 2. corsproxy.io fallback
  try {
    const proxy = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const res = await fetchWithTimeout(proxy, 10000);
    if (res.ok) {
      const html = await res.text();
      if (html.length > 500) return html;
    }
  } catch { /* proxy down */ }

  // 3. Direct (in case pikalytics ever adds CORS headers)
  try {
    const res = await fetchWithTimeout(url, 7000);
    if (res.ok) return res.text();
  } catch { /* CORS blocked */ }

  return null;
}

function parsePikalyticsHtml(html) {
  // Use DOMParser to handle messy HTML reliably
  const doc  = new DOMParser().parseFromString(html, 'text/html');
  const pattern = new RegExp(`/pokedex/${FORMAT_SLUG}/(.+)`, 'i');

  const seen   = new Set();
  const result = [];

  for (const link of doc.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href') || '';
    const pathMatch = href.match(pattern);
    if (!pathMatch || !pathMatch[1]) continue;

    const slug = decodeURIComponent(pathMatch[1]).trim();
    if (!slug || seen.has(slug)) continue;

    // Extract usage % from visible text inside the link
    const text = link.textContent || '';
    const usageMatch = text.match(/([\d]+\.[\d]+)%/);
    if (!usageMatch) continue;

    // Prefer img alt for display name, else prettify the slug
    const img  = link.querySelector('img');
    const name = (img?.alt?.trim() || slug.replace(/-/g, ' ')).trim();
    if (!name) continue;

    seen.add(slug);
    result.push({ name, slug, usage: parseFloat(usageMatch[1]) });
  }

  return result.sort((a, b) => b.usage - a.usage);
}

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

  const html = await tryFetchHtml(PIKA_URL);
  if (!html) return null;

  const data = parsePikalyticsHtml(html);
  if (data.length < 3) return null; // something went wrong parsing

  const label = 'Pikalytics · Reg MA';
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data, label }));
  } catch { /* storage full */ }

  return { data, label };
}

export function clearMetaCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}
