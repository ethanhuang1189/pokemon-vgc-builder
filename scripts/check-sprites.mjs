#!/usr/bin/env node
// Sprite audit (needs network): for every species and item in a regulation, finds which
// fallback URL actually loads. Run after adding a regulation to spot missing art.
//
//   npm run check:sprites            current regulation
//   npm run check:sprites -- M-B     a specific regulation
//   npm run check:sprites -- --all   list every entry, not just the ones needing attention

import { Dex } from '@pkmn/dex';
import { buildFormat } from '../src/domain/format.js';
import { pokemonSpriteUrls, ownSpriteUrls, itemSpriteUrls } from '../src/domain/sprites.js';
import { CURRENT_REGULATION, getRegulation } from '../src/regulations/index.js';

const args = process.argv.slice(2);
const showAll = args.includes('--all');
const regId = args.find(a => !a.startsWith('--'));
const format = buildFormat(regId ? getRegulation(regId) : CURRENT_REGULATION, Dex);

const statusCache = new Map();

async function request(url, method) {
  try {
    return (await fetch(url, { method, headers: { 'User-Agent': 'Mozilla/5.0' } })).ok;
  } catch {
    return false;
  }
}

// Some hosts reject or drop HEAD requests now and then; retry once with GET before calling it missing.
function loads(url) {
  if (!statusCache.has(url)) {
    statusCache.set(url, request(url, 'HEAD').then(ok => ok || request(url, 'GET')));
  }
  return statusCache.get(url);
}

async function firstLoading(urls) {
  for (const [index, url] of urls.entries()) {
    if (await loads(url)) return { index, url };
  }
  return null;
}

// Run `fn` over `items` with limited concurrency so the sprite hosts aren't hammered.
async function mapLimit(items, limit, fn) {
  const results = [];
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }));
  return results;
}

const host = (url) => new URL(url).pathname.split('/').slice(0, -1).join('/');

async function audit(label, entries, urlsFor, isFallback) {
  const rows = await mapLimit(entries, 8, async entry => ({ entry, hit: await firstLoading(urlsFor(entry)) }));
  const flagged = rows.filter(({ entry, hit }) => !hit || isFallback(entry, hit));
  console.log(`\n${label}: ${rows.length - flagged.length}/${rows.length} use a preferred sprite`);
  for (const { entry, hit } of showAll ? rows : flagged) {
    console.log(`  ${entry.name.padEnd(24)} ${hit ? host(hit.url) : 'NO SPRITE FOUND'}`);
  }
  return rows.filter(r => !r.hit).length;
}

console.log(`Sprite audit — ${format.regulation.label}`);

const missingPokemon = await audit(
  'Pokémon',
  format.species,
  s => pokemonSpriteUrls(s, format.getBaseOf),
  // Loading only a base-forme sprite or official artwork may show the wrong forme.
  (s, hit) => !ownSpriteUrls(s).includes(hit.url),
);
const missingItems = await audit('Items', format.items, itemSpriteUrls, () => false);

process.exit(missingPokemon + missingItems > 0 ? 1 : 0);
