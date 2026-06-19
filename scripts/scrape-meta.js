// Scrapes Pikalytics homepage for Pokemon Champions top usage stats.
// Run via GitHub Actions; outputs to src/data/metaStats.json.

const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const OUT_FILE = path.join(__dirname, '..', 'src', 'data', 'metaStats.json');
const URL      = 'https://www.pikalytics.com/';

async function scrape() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );

  console.log('Navigating to Pikalytics…');
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });

  // Wait for at least one usage percentage to appear in the DOM
  try {
    await page.waitForFunction(
      () => document.body.innerText.match(/\d+\.\d+%/),
      { timeout: 15000 }
    );
  } catch {
    console.error('Timed out waiting for usage percentages — page may have changed structure.');
    await browser.close();
    process.exit(1);
  }

  const data = await page.evaluate(() => {
    const seen   = new Set();
    const result = [];

    // Strategy 1: anchor tags linking to /pokedex/FORMAT/POKEMON with % in text
    for (const link of document.querySelectorAll('a[href*="/pokedex/"]')) {
      const href  = link.getAttribute('href') || '';
      const match = href.match(/\/pokedex\/[^/]+\/([^/?#]+)/);
      if (!match) continue;

      const slug    = decodeURIComponent(match[1]).trim();
      const slugKey = slug.toLowerCase();
      if (!slug || seen.has(slugKey)) continue;

      const text     = link.innerText || '';
      const pctMatch = text.match(/(\d+\.\d+)%/);
      if (!pctMatch) continue;

      const img  = link.querySelector('img');
      const name = img?.alt?.trim() || slug.replace(/-/g, ' ');
      if (!name || seen.has(name.toLowerCase())) continue;

      seen.add(slugKey);
      seen.add(name.toLowerCase());
      result.push({ name, slug, usage: parseFloat(pctMatch[1]) });
    }

    if (result.length >= 5) return result;

    // Strategy 2: walk every leaf element for "X.XX%" text, find nearest img alt
    const seenPct = new Set();
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length > 0) continue;
      const text     = el.textContent?.trim() || '';
      const pctMatch = text.match(/^(\d+\.\d+)%$/);
      if (!pctMatch) continue;

      const pct = parseFloat(pctMatch[1]);
      const key = pct.toString();
      if (seenPct.has(key)) continue;

      let container = el.parentElement;
      for (let i = 0; i < 8; i++) {
        if (!container) break;
        const img = container.querySelector('img[alt]');
        if (img?.alt && !/logo|icon|banner/i.test(img.alt)) {
          const name = img.alt.trim();
          if (!seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            seenPct.add(key);
            result.push({ name, slug: name, usage: pct });
          }
          break;
        }
        container = container.parentElement;
      }
    }

    return result;
  });

  await browser.close();

  const sorted = data.sort((a, b) => b.usage - a.usage);

  if (sorted.length < 3) {
    console.error(`Only found ${sorted.length} entries — aborting to avoid overwriting good data.`);
    process.exit(1);
  }

  console.log(`Found ${sorted.length} Pokémon. Top 5:`);
  sorted.slice(0, 5).forEach((p, i) => console.log(`  ${i + 1}. ${p.name} ${p.usage}%`));

  const out = {
    label:     'Pikalytics · Reg M-B',
    updatedAt: new Date().toISOString().slice(0, 10),
    data:      sorted,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
  console.log(`Written to ${OUT_FILE}`);
}

scrape().catch(err => { console.error(err); process.exit(1); });
