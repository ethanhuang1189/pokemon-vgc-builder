import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Guards for mistakes that would quietly weaken security.

const read = (path) => readFileSync(path, 'utf8');

function filesUnder(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe('secrets', () => {
  it('browser code never references the server secret key', () => {
    for (const file of filesUnder('src')) {
      assert.equal(/SECRET_KEY|service_role/i.test(read(file)), false, file);
    }
  });

  it('the secret key is never given a VITE_ prefix (which would ship it to browsers)', () => {
    for (const file of [...filesUnder('src'), ...filesUnder('server'), ...filesUnder('api'), '.env.example']) {
      assert.equal(/VITE_[A-Z_]*SECRET/.test(read(file)), false, file);
    }
  });

  it('.env files are git-ignored', () => {
    assert.match(read('.gitignore'), /^\.env$/m);
  });
});

describe('database policies', () => {
  const sql = read('supabase/migrations/0001_battle_tracking.sql');
  const tables = [...sql.matchAll(/create table public\.(\w+)/g)].map(m => m[1]);

  it('enables row-level security on every table', () => {
    for (const table of tables) {
      assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`), table);
    }
  });

  it('scopes every policy to the signed-in user', () => {
    const policies = [...sql.matchAll(/create policy[\s\S]*?;/g)].map(m => m[0]);
    assert.ok(policies.length >= 5);
    for (const policy of policies) {
      assert.match(policy, /to authenticated/, policy);
      assert.match(policy, /user_id = \(select auth\.uid\(\)\)/, policy);
    }
  });

  it('gives browsers no way to write battles (only the server can)', () => {
    assert.equal(/policy[^;]*on public\.battles\s+for (insert|update|all)/i.test(sql), false);
  });
});

describe('Content-Security-Policy', () => {
  const header = (name) => JSON.parse(read('vercel.json')).headers[0].headers.find(h => h.key === name)?.value ?? '';
  const csp = header('Content-Security-Policy');

  it('only runs our own scripts', () => {
    assert.match(csp, /script-src 'self';/);
    assert.equal(/unsafe-inline|unsafe-eval|\*;/.test(csp.match(/script-src[^;]*/)[0]), false);
  });

  it('blocks framing, plugins and base-tag tricks', () => {
    for (const rule of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'self'"]) {
      assert.ok(csp.includes(rule), rule);
    }
  });

  it('allows every image host the sprite code uses', () => {
    const imgSrc = csp.match(/img-src[^;]*/)[0];
    const hosts = new Set(read('src/domain/sprites.js').match(/https:\/\/[a-z0-9.-]+/g).map(u => new URL(u).origin));
    for (const host of hosts) assert.ok(imgSrc.includes(host), host);
  });

  it('sends nosniff', () => {
    assert.equal(header('X-Content-Type-Options'), 'nosniff');
  });
});
