// Generates champions_stats.txt with base stats + 15 for all legal Pokemon.
// Edit the output file for any Pokemon whose Champions stats differ from this baseline.
import { Dex } from '../node_modules/@pkmn/dex/build/index.js';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT  = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUFF  = 15;

const normalize = n => n.toLowerCase().replace(/[-.']/g, '').replace(/\s+/g, ' ').trim();
const parseNames = r => r.split('\n').flatMap(l => l.split('\t')).map(s => s.trim()).filter(Boolean);

const legalNames = parseNames(readFileSync(join(ROOT, 'legal_mons.txt'), 'utf8'))
  .filter(n => isNaN(n) && n.length > 0);

// Build a normalised lookup map for the dex
const dexByNorm = new Map();
for (const s of Dex.species.all()) {
  if (s.exists) dexByNorm.set(normalize(s.name), s);
}

const lines = [
  '# Pokemon Champions base stats — HP Atk Def SpA SpD Spe',
  '# Baseline: standard dex stats + 15 (confirmed for Charizard)',
  '# Edit lines where the actual Champions game shows different values',
  '',
];

let found = 0, missing = 0;
for (const name of legalNames) {
  const s = dexByNorm.get(normalize(name));
  if (!s) { console.error(`NOT FOUND: ${name}`); missing++; continue; }
  const b = s.baseStats;
  lines.push(`${s.name} ${b.hp+BUFF} ${b.atk+BUFF} ${b.def+BUFF} ${b.spa+BUFF} ${b.spd+BUFF} ${b.spe+BUFF}`);
  found++;
}

const out = lines.join('\n') + '\n';
writeFileSync(join(ROOT, 'champions_stats.txt'), out);
console.log(`Written champions_stats.txt — ${found} Pokemon, ${missing} not found`);
