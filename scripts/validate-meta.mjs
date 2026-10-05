#!/usr/bin/env node
// Checks a scraped metaStats.json before the update-meta workflow commits it, so a broken or
// tampered scrape can't land on main. No dependencies: it runs in the workflow job that can push.
//   node scripts/validate-meta.mjs <file>

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const MAX_BYTES = 512 * 1024;
const MIN_ENTRIES = 3;
const MAX_ENTRIES = 1000;
const NAME_PATTERN = /^[\p{L}\p{N} .’'%:-]{1,40}$/u;

/** Returns a list of problems with the parsed metaStats JSON (empty when valid). */
export function validateMetaStats(json) {
  const errors = [];
  if (!json || typeof json !== 'object' || Array.isArray(json)) return ['top level must be an object'];

  const allowedKeys = ['label', 'updatedAt', 'data'];
  const extra = Object.keys(json).filter(k => !allowedKeys.includes(k));
  if (extra.length) errors.push(`unexpected keys: ${extra.join(', ')}`);

  if (typeof json.label !== 'string' || !/^Pikalytics · Reg [A-Z]-[A-Z]$/.test(json.label)) {
    errors.push(`label must look like "Pikalytics · Reg M-C", got ${JSON.stringify(json.label)}`);
  }
  if (typeof json.updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(json.updatedAt)) {
    errors.push('updatedAt must be a YYYY-MM-DD date');
  }
  if (!Array.isArray(json.data)) return [...errors, 'data must be an array'];
  if (json.data.length < MIN_ENTRIES || json.data.length > MAX_ENTRIES) {
    errors.push(`data must have ${MIN_ENTRIES}–${MAX_ENTRIES} entries, got ${json.data.length}`);
  }

  json.data.forEach((entry, i) => {
    const where = `data[${i}]`;
    if (!entry || typeof entry !== 'object') return errors.push(`${where} must be an object`);
    const keys = Object.keys(entry).filter(k => !['name', 'slug', 'usage'].includes(k));
    if (keys.length) errors.push(`${where} has unexpected keys: ${keys.join(', ')}`);
    for (const field of ['name', 'slug']) {
      if (typeof entry[field] !== 'string' || !NAME_PATTERN.test(entry[field])) {
        errors.push(`${where}.${field} is not a plausible Pokémon name: ${JSON.stringify(entry[field])}`);
      }
    }
    if (typeof entry.usage !== 'number' || !Number.isFinite(entry.usage) || entry.usage < 0 || entry.usage > 100) {
      errors.push(`${where}.usage must be a percentage, got ${JSON.stringify(entry.usage)}`);
    }
  });
  return errors;
}

/** Reads, size-checks, parses and validates a file. */
export function validateMetaFile(path) {
  const raw = readFileSync(path);
  if (raw.length > MAX_BYTES) return [`file is ${raw.length} bytes; limit is ${MAX_BYTES}`];
  try {
    return validateMetaStats(JSON.parse(raw.toString('utf8')));
  } catch (err) {
    return [`not valid JSON: ${err.message}`];
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/validate-meta.mjs <file>');
    process.exit(2);
  }
  const errors = validateMetaFile(file);
  if (errors.length) {
    console.error(`Invalid meta stats (${file}):\n  ${errors.slice(0, 20).join('\n  ')}`);
    process.exit(1);
  }
  console.log(`${file} is valid`);
}
