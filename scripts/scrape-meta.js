// Scrapes Pikalytics homepage for Pokemon Champions top usage stats.
// Strategy 1: intercept the JSON API responses Pikalytics makes on load
// Strategy 2: DOM parse after JS renders
// Outputs to src/data/metaStats.json

import puppeteer from 'puppeteer';
import fs        from 'fs';
import path      from 'path';

const OUT_FILE   = path.join(import.meta.dirname, '..', 'src', 'data', 'metaStats.json');
const DEBUG_SHOT = path.join(import.meta.dirname, 'debug.png');
const URL        = 'https://www.pikalytics.com/';

function looksLikePokemonData(arr) {
  if (!Array.isArray(arr) || arr.length < 3) return false;
  const first = arr[0];
  return first && (
    typeof first.name === 'string' ||
    typeof first.pokemon === 'string' ||
    typeof first.Pokemon === 'string'
  );
}

function normalizeApiEntry(entry) {
  const name  = (entry.name || entry.pokemon || entry.Pokemon || '').trim();
  const usage = parseFloat(
    entry.usage ?? entry.Usage ?? entry.percent ?? entry.percentage ?? entry.count ?? 0
  );
  return name && !isNaN(usage) ? { name, slug: name, usage } : null;
}

async function scrape() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );

  // ── Strategy 1: intercept API JSON responses ──────────────────────────────
  const intercepted = [];
  page.on('response', async response => {
    const ct = response.headers()['content-type'] || '';
    if (!ct.includes('json')) return;
    try {
      const json = await response.json();
      if (looksLikePokemonData(json)) {
        intercepted.push(...json);
        return;
      }
      for (const key of ['data', 'pokemon', 'results', 'usage', 'list']) {
        if (looksLikePokemonData(json[key])) {
          intercepted.push(...json[key]);
          return;
        }
      }
    } catch { /* non-JSON or network error */ }
  });

  console.log('Navigating to Pikalytics…');
  try {
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  } catch {
    console.log('networkidle2 timed out, continuing anyway…');
  }

  await new Promise(r => setTimeout(r, 3000));

  if (intercepted.length >= 3) {
    console.log(`API interception found ${intercepted.length} entries.`);
    const seen   = new Set();
    const result = [];
    for (const entry of intercepted) {
      const norm = normalizeApiEntry(entry);
      if (!norm || seen.has(norm.name.toLowerCase())) continue;
      seen.add(norm.name.toLowerCase());
      result.push(norm);
    }
    if (result.length >= 3) {
      await browser.close();
      return result.sort((a, b) => b.usage - a.usage);
    }
  }

  console.log('API interception insufficient — falling back to DOM scraping…');

  // ── Strategy 2: DOM scraping ──────────────────────────────────────────────
  try {
    await page.waitForFunction(
      () => document.body.innerText.match(/\d+\.\d+%/),
      { timeout: 15000 }
    );
  } catch {
    await page.screenshot({ path: DEBUG_SHOT });
    console.error('No percentages found — screenshot saved to debug.png');
    await browser.close();
    process.exit(1);
  }

  const data = await page.evaluate(() => {
    const seen   = new Set();
    const result = [];

    function addEntry(name, slug, usage) {
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      result.push({ name, slug: slug || name, usage: parseFloat(usage) });
    }

    // 2a: anchor tags with /pokedex/FORMAT/POKEMON and a % in text
    for (const link of document.querySelectorAll('a[href*="/pokedex/"]')) {
      const href  = link.getAttribute('href') || '';
      const match = href.match(/\/pokedex\/[^/]+\/([^/?#]+)/);
      if (!match) continue;
      const slug = decodeURIComponent(match[1]).trim();
      if (!slug) continue;
      const pctMatch = (link.innerText || '').match(/(\d+\.\d+)%/);
      if (!pctMatch) continue;
      const img  = link.querySelector('img');
      const name = img?.alt?.trim() || slug.replace(/-/g, ' ');
      addEntry(name, slug, pctMatch[1]);
    }

    if (result.length >= 3) return result;

    // 2b: find leaf elements whose text is exactly "X.XX%", walk up for img alt
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length > 0) continue;
      const pctMatch = (el.textContent || '').trim().match(/^(\d+\.\d+)%$/);
      if (!pctMatch) continue;
      let container = el.parentElement;
      for (let i = 0; i < 10; i++) {
        if (!container) break;
        const img = container.querySelector('img[alt]');
        if (img?.alt && !/logo|icon|banner/i.test(img.alt)) {
          addEntry(img.alt.trim(), img.alt.trim(), pctMatch[1]);
          break;
        }
        container = container.parentElement;
      }
    }

    return result;
  });

  await page.screenshot({ path: DEBUG_SHOT });
  await browser.close();
  return data;
}

async function main() {
  let data;
  try {
    data = await scrape();
  } catch (err) {
    console.error('Scraper threw:', err);
    process.exit(1);
  }

  const sorted = (data || []).sort((a, b) => b.usage - a.usage);

  if (sorted.length < 3) {
    console.error(`Only ${sorted.length} entries — aborting to preserve existing data.`);
    console.error('Check the debug-screenshot artifact for what the page looked like.');
    process.exit(1);
  }

  console.log(`\nFound ${sorted.length} Pokémon. Top 10:`);
  sorted.slice(0, 10).forEach((p, i) =>
    console.log(`  ${String(i + 1).padStart(2)}. ${p.name.padEnd(20)} ${p.usage}%`)
  );

  const out = {
    label:     'Pikalytics · Reg M-B',
    updatedAt: new Date().toISOString().slice(0, 10),
    data:      sorted,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
  console.log(`\nWritten to ${OUT_FILE}`);
}

main();
