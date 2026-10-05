import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { validateMetaStats, validateMetaFile } from '../scripts/validate-meta.mjs';

const entry = (name, usage = 10) => ({ name, slug: name, usage });
const valid = () => ({
  label: 'Pikalytics · Reg M-C',
  updatedAt: '2026-10-05',
  data: [entry('Rillaboom', 35.2), entry('Indeedee-F', 20.25), entry('Farfetch’d', 1), entry('Mr. Mime', 0.5)],
});
const tempFile = (contents) => {
  const file = join(mkdtempSync(join(tmpdir(), 'meta-')), 'metaStats.json');
  writeFileSync(file, contents);
  return file;
};

describe('validateMetaStats', () => {
  it('accepts well-formed data', () => {
    assert.deepEqual(validateMetaStats(valid()), []);
  });

  it('accepts the committed metaStats.json', () => {
    assert.deepEqual(validateMetaStats(JSON.parse(readFileSync('src/data/metaStats.json', 'utf8'))), []);
  });

  it('rejects non-objects', () => {
    for (const bad of [null, [], 'x', 3]) assert.ok(validateMetaStats(bad).length, JSON.stringify(bad));
  });

  it('rejects extra keys at either level (nothing smuggled into the app bundle)', () => {
    assert.match(validateMetaStats({ ...valid(), script: 'x' }).join(), /unexpected keys: script/);
    const data = valid();
    data.data[0].html = '<img>';
    assert.match(validateMetaStats(data).join(), /data\[0\] has unexpected keys: html/);
  });

  it('rejects markup or odd characters in names', () => {
    const data = valid();
    data.data[1] = entry('<script>alert(1)</script>');
    assert.match(validateMetaStats(data).join(), /data\[1\]\.name is not a plausible/);
  });

  it('rejects usage outside 0–100 or non-numeric', () => {
    for (const usage of [-1, 101, '20', NaN, Infinity, null]) {
      const data = valid();
      data.data[0].usage = usage;
      assert.match(validateMetaStats(data).join(), /usage must be a percentage/, String(usage));
    }
  });

  it('rejects a bad label or date', () => {
    assert.match(validateMetaStats({ ...valid(), label: 'Hacked' }).join(), /label must look like/);
    assert.match(validateMetaStats({ ...valid(), updatedAt: 'today' }).join(), /updatedAt/);
  });

  it('rejects too few or too many entries', () => {
    assert.match(validateMetaStats({ ...valid(), data: [entry('Rillaboom')] }).join(), /3–1000 entries/);
    assert.match(validateMetaStats({ ...valid(), data: Array(1001).fill(entry('Rillaboom')) }).join(), /got 1001/);
    assert.match(validateMetaStats({ ...valid(), data: 'nope' }).join(), /data must be an array/);
  });
});

describe('validateMetaFile', () => {
  it('reports invalid JSON', () => {
    assert.match(validateMetaFile(tempFile('{ not json')).join(), /not valid JSON/);
  });

  it('rejects oversized files before parsing', () => {
    assert.match(validateMetaFile(tempFile(' '.repeat(600 * 1024))).join(), /limit is/);
  });

  it('passes a valid file', () => {
    assert.deepEqual(validateMetaFile(tempFile(JSON.stringify(valid()))), []);
  });
});
