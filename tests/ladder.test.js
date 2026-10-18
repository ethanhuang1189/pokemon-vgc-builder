import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { replayFixture } from './helpers.js';
import {
  ladderEntries, coreKeys, groupKey, isBot, summarizeEntries, teamsWithCore, pasteFromSummary,
  MIN_PLAYER_RATING, MIN_SEARCH_RATING, MIN_PLAYERS, MIN_GAMES, LADDER_PRIOR_GAMES,
} from '../src/domain/ladder.js';
import { createLadderCollector } from '../server/ladder.js';
import { readFileSync } from 'node:fs';

const TEAM_A = ['Incineroar', 'Rillaboom', 'Sneasler', 'Kingambit', 'Garchomp', 'Whimsicott'];
const TEAM_B = ['Pelipper', 'Basculegion', 'Archaludon', 'Dragonite', 'Amoonguss', 'Gholdengo'];

/** A minimal finished battle log: two players with ratings, six each, four brought, a winner. */
function battleLog({ p1 = 'Ann', p2 = 'Bob', r1 = 1600, r2 = 1600, team1 = TEAM_A, team2 = TEAM_B, winner = p1 } = {}) {
  const lines = [`|player|p1|${p1}|1|${r1}`, `|player|p2|${p2}|2|${r2}`];
  for (const s of team1) lines.push(`|poke|p1|${s}, L50|`);
  for (const s of team2) lines.push(`|poke|p2|${s}, L50|`);
  for (const [side, team] of [['p1', team1], ['p2', team2]]) {
    team.slice(0, 2).forEach((s, i) => lines.push(`|switch|${side}${'ab'[i]}: ${s}|${s}, L50|100/100`));
  }
  lines.push('|turn|1');
  lines.push(`|switch|p1a: ${team1[2]}|${team1[2]}, L50|100/100`, `|switch|p2a: ${team2[2]}|${team2[2]}, L50|100/100`);
  lines.push(`|move|p1a: ${team1[2]}|Protect|p1a: ${team1[2]}`);
  lines.push(`|-enditem|p1b: ${team1[1]}|Sitrus Berry|[eat]`, `|-ability|p2b: ${team2[1]}|Swift Swim|boost`);
  lines.push(winner ? `|win|${winner}` : '|tie');
  return lines.join('\n');
}

const replay = (id, opts = {}, uploadtime = 1_800_000_000) => ({
  id, format: '[Gen 9 Champions] VGC 2026 Reg M-C', formatid: 'gen9championsvgc2026regmc', uploadtime, log: battleLog(opts),
});

describe('ladderEntries', () => {
  it('makes a row for each 1500+ player, with their side of the battle', () => {
    const rows = ladderEntries(replay('x-1', { r1: 1620, r2: 1510 }));
    assert.deepEqual(rows.map(r => [r.side, r.player_id, r.rating, r.result]), [['p1', 'ann', 1620, 'win'], ['p2', 'bob', 1510, 'loss']]);
    const [ann] = rows;
    assert.deepEqual(ann.team, TEAM_A);
    assert.equal(ann.team_key, groupKey(TEAM_A));
    assert.equal(ann.core_keys.length, 15);
    assert.deepEqual(ann.brought, [TEAM_A[0], TEAM_A[1], TEAM_A[2]]);
    assert.deepEqual(ann.leads, [TEAM_A[0], TEAM_A[1]]);
    assert.deepEqual(ann.moves, { [TEAM_A[2]]: { Protect: 1 } });
    assert.deepEqual(ann.items, { [TEAM_A[1]]: 'Sitrus Berry' });
    assert.deepEqual(rows[1].abilities, { [TEAM_B[1]]: 'Swift Swim' });
    assert.equal(ann.played_at, new Date(1_800_000_000_000).toISOString());
  });

  it(`skips players under ${MIN_PLAYER_RATING}, unrated ones, bots and short teams`, () => {
    assert.deepEqual(ladderEntries(replay('x', { r1: 1499, r2: 1700 })).map(r => r.side), ['p2']);
    assert.deepEqual(ladderEntries(replay('x', { r1: '', r2: 1700 })).map(r => r.side), ['p2']);
    assert.deepEqual(ladderEntries(replay('x', { p1: 'pcrlbot12d159c39a', winner: 'Bob' })).map(r => r.side), ['p2']);
    assert.deepEqual(ladderEntries(replay('x', { team1: TEAM_A.slice(0, 5) })).map(r => r.side), ['p2']);
  });

  it('records ties, and nothing for unfinished battles', () => {
    assert.deepEqual(ladderEntries(replay('x', { winner: null })).map(r => r.result), ['tie', 'tie']);
    assert.deepEqual(ladderEntries({ ...replay('x'), log: battleLog().replace(/\|win\|.*/, '') }), []);
  });

  it('reads a real replay', () => {
    const rows = ladderEntries(replayFixture);
    for (const row of rows) {
      assert.equal(row.team.length, 6);
      assert.equal(row.brought.length, 4);
      for (const s of Object.keys({ ...row.moves, ...row.items, ...row.abilities })) assert.ok(row.brought.includes(s), s);
    }
  });
});

describe('cores and keys', () => {
  it('lists every 4-of-6 subset once, the same for any order', () => {
    const cores = coreKeys(TEAM_A);
    assert.equal(cores.length, 15);
    assert.equal(new Set(cores).size, 15);
    assert.deepEqual(coreKeys([...TEAM_A].reverse()), cores);
    for (const core of cores) assert.equal(core.split('|').length, 4);
    assert.ok(cores.includes(groupKey(['Sneasler', 'Incineroar', 'Kingambit', 'Rillaboom'])));
  });

  it('spots ladder bots without catching ordinary names', () => {
    assert.equal(isBot('pcrlbot12d159c39a'), true);
    for (const name of ['Abbott', 'RoboTrainer', 'botanist', 'Sita & Rama']) assert.equal(isBot(name), false, name);
  });
});

describe('summarizeEntries', () => {
  const entry = (overrides) => ({
    player_id: 'ann', result: 'win', team: TEAM_A, brought: TEAM_A.slice(0, 4), leads: TEAM_A.slice(0, 2),
    mega: null, moves: {}, items: {}, abilities: {}, ...overrides,
  });
  const entries = [
    entry({ moves: { Incineroar: { 'Fake Out': 2, Protect: 1 } }, items: { Incineroar: 'Sitrus Berry' }, abilities: { Incineroar: 'Intimidate' } }),
    entry({ player_id: 'bob', result: 'loss', moves: { Incineroar: { 'Fake Out': 1 } }, items: { Incineroar: 'Safety Goggles' }, mega: 'Garchomp-Mega-Z', brought: [TEAM_A[0], TEAM_A[1], TEAM_A[4], TEAM_A[5]] }),
    entry({ player_id: 'cat', result: 'tie', items: { Incineroar: 'Sitrus Berry' }, leads: [TEAM_A[1], TEAM_A[0]] }),
  ];
  const summary = summarizeEntries(entries, TEAM_A);

  it('has the record and player count', () => {
    assert.deepEqual(summary.record, { games: 3, wins: 1, losses: 1, ties: 1, winRate: 1 / 3 });
    assert.equal(summary.players, 3);
  });

  it('ranks the four brought and leads (lead order ignored)', () => {
    assert.deepEqual(summary.brought.map(b => [b.name, b.count, b.share]), [
      [groupKey(TEAM_A.slice(0, 4)), 2, 2 / 3],
      [groupKey([TEAM_A[0], TEAM_A[1], TEAM_A[4], TEAM_A[5]]), 1, 1 / 3],
    ]);
    assert.deepEqual(summary.leads.map(l => [l.name, l.count]), [[groupKey(TEAM_A.slice(0, 2)), 3]]);
  });

  it('has per-Pokémon brought rate, mega rate, moves, items and abilities, in team order', () => {
    assert.deepEqual(summary.members.map(m => m.name), TEAM_A);
    const [incin] = summary.members;
    assert.equal(incin.broughtRate, 1);
    assert.deepEqual(incin.moves.map(m => [m.name, m.count, m.share]), [['Fake Out', 3, 0.75], ['Protect', 1, 0.25]]);
    assert.deepEqual(incin.items.map(i => [i.name, i.count]), [['Sitrus Berry', 2], ['Safety Goggles', 1]]);
    assert.deepEqual(incin.abilities.map(a => a.name), ['Intimidate']);
    const chomp = summary.members.find(m => m.name === 'Garchomp');
    assert.deepEqual([chomp.broughtRate, chomp.megaRate], [1 / 3, 1]);
  });

  it('builds a paste of the most common sets for the builder', () => {
    assert.equal(pasteFromSummary(summary, TEAM_A.slice(0, 2)), 'Incineroar @ Sitrus Berry\nAbility: Intimidate\n- Fake Out\n- Protect\n\nRillaboom');
  });

  it('lists the teams a core came from', () => {
    const other = ['Incineroar', 'Rillaboom', 'Sneasler', 'Kingambit', 'Pelipper', 'Archaludon'];
    const rows = teamsWithCore([...entries, entry({ team: other, team_key: groupKey(other) })].map(e => ({ team_key: groupKey(e.team), ...e })));
    assert.deepEqual(rows.map(r => [r.key, r.games, r.wins]), [[groupKey(TEAM_A), 3, 1], [groupKey(other), 1, 1]]);
  });

  it('handles nothing', () => {
    assert.deepEqual(summarizeEntries([]).record, { games: 0, wins: 0, losses: 0, ties: 0, winRate: 0 });
  });
});

describe('SQL summaries match the app\'s constants', () => {
  const sql = readFileSync(new URL('../supabase/migrations/0005_ladder.sql', import.meta.url), 'utf8');
  it('uses the same thresholds and prior', () => {
    assert.equal(sql.match(/having count\(distinct player_id\) >= (\d+) and count\(\*\) >= (\d+)/g).length, 2);
    assert.ok(sql.includes(`having count(distinct player_id) >= ${MIN_PLAYERS} and count(*) >= ${MIN_GAMES}`));
    assert.equal(sql.match(new RegExp(`\\+ ${LADDER_PRIOR_GAMES} \\* 0\\.5\\) / \\(count\\(\\*\\) \\+ ${LADDER_PRIOR_GAMES}\\)`, 'g')).length, 2);
  });
});

// ── The collector, against a fake Showdown and an in-memory store ─────────────

/** Showdown's search over `replays` (sorted newest first): 50 per page plus a 51st if there's more. */
function fakeShowdown(replays, { failOn = null } = {}) {
  const calls = { search: 0, fetch: 0 };
  return {
    calls,
    replays,
    async searchFormat(formatId, before) {
      calls.search += 1;
      const sorted = [...replays].sort((a, b) => b.uploadtime - a.uploadtime || b.id.localeCompare(a.id));
      const older = sorted.filter(r => before === null || r.uploadtime < before);
      return older.slice(0, 51).map(r => ({ id: r.id, uploadtime: r.uploadtime, rating: r.rating }));
    },
    async fetchReplay(id) {
      calls.fetch += 1;
      if (failOn?.(id)) throw Object.assign(new Error('Showdown down'), { status: 502 });
      return replays.find(r => r.id === id) ?? null;
    },
  };
}

function memoryStore() {
  const rows = new Map();
  let state = null;
  return {
    rows,
    get state() { return state; },
    refreshes: 0,
    async getState() { return state; },
    async setState(formatId, next) { state = { ...next }; },
    async knownReplayIds(ids) { return new Set(ids.filter(id => [...rows.keys()].some(k => k.startsWith(`${id}#`)))); },
    async saveEntries(entries) { for (const e of entries) rows.set(`${e.replay_id}#${e.side}`, e); },
    async refreshStats() { this.refreshes += 1; },
  };
}

/** `count` replays, several sharing each upload second; every third is rated too low to read. */
function ladder(count, { start = 1_800_000_000, perSecond = 3, prefix = 'r' } = {}) {
  return Array.from({ length: count }, (_, i) => {
    const uploadtime = start + Math.floor(i / perSecond);
    const low = i % 3 === 0;
    return { ...replay(`${prefix}${i}`, { r1: low ? 1300 : 1600, r2: low ? 1300 : 1450 }, uploadtime), rating: low ? 1300 : 1450 };
  });
}

const collector = (showdown, store, opts = {}) =>
  createLadderCollector({ store, showdown, formatId: 'gen9championsvgc2026regmc', maxPages: 3, ...opts });

const eligible = (replays) => replays.filter(r => r.rating >= MIN_SEARCH_RATING).map(r => `${r.id}#p1`).sort();

describe('collector', () => {
  it('backfills everything across several runs, then stops', async () => {
    const showdown = fakeShowdown(ladder(400));
    const store = memoryStore();
    const run = collector(showdown, store);
    const results = [];
    do results.push(await run.run()); while (!results.at(-1).done);
    assert.ok(results.length > 1, 'needed more than one run');
    assert.deepEqual([...store.rows.keys()].sort(), eligible(showdown.replays));
    assert.equal(store.state.scan_cursor, null);
    assert.equal(store.state.newest, Math.max(...showdown.replays.map(r => r.uploadtime)));
    // Low-rated replays were never downloaded; boundary re-reads skip saved ones.
    assert.ok(showdown.calls.fetch <= eligible(showdown.replays).length + results.length * 3);
    assert.ok(store.refreshes >= 1);
  });

  it('only scans what is new on later runs', async () => {
    const old = ladder(120);
    const showdown = fakeShowdown(old);
    const store = memoryStore();
    const run = collector(showdown, store, { maxPages: 10 });
    assert.equal((await run.run()).done, true);
    showdown.replays.push(...ladder(30, { start: 1_800_000_500, prefix: 'new' }));
    const searches = showdown.calls.search;
    const result = await run.run();
    assert.equal(result.done, true);
    assert.equal(showdown.calls.search - searches, 1);
    assert.deepEqual([...store.rows.keys()].sort(), eligible(showdown.replays));
  });

  it('loses nothing when many replays share a second at a page boundary', async () => {
    const showdown = fakeShowdown(ladder(300, { perSecond: 20 }));
    const store = memoryStore();
    const run = collector(showdown, store, { maxPages: 2 });
    while (!(await run.run()).done);
    assert.deepEqual([...store.rows.keys()].sort(), eligible(showdown.replays));
  });

  it('resumes after Showdown fails mid-scan without losing a page', async () => {
    let failing = true;
    const showdown = fakeShowdown(ladder(200), { failOn: id => failing && id === 'r100' });
    const store = memoryStore();
    const run = collector(showdown, store, { maxPages: 10 });
    await assert.rejects(run.run(), /Showdown down/);
    failing = false;
    while (!(await run.run()).done);
    assert.deepEqual([...store.rows.keys()].sort(), eligible(showdown.replays));
  });

  it('stops at the time budget and keeps its place', async () => {
    let clock = 0;
    const showdown = fakeShowdown(ladder(300));
    const store = memoryStore();
    const run = createLadderCollector({
      store, showdown, formatId: 'f', budgetMs: 1000, maxPages: 100,
      now: () => (clock += 400), // each check moves the clock on
    });
    const first = await run.run();
    assert.equal(first.done, false);
    assert.ok(first.pages >= 1 && first.pages < 7);
    assert.notEqual(store.state.scan_cursor, null);
  });
});

describe('collector endpoint', async () => {
  const { cronPost } = await import('../server/http.js');
  const SECRET = 'x'.repeat(40);
  const handler = cronPost('TEST_LADDER_SECRET', () => ({ ladder: { run: async () => ({ done: true }) } }), ({ ladder }) => ladder.run());
  const call = (auth) => handler(new Request('https://site/api/collect-ladder', { method: 'POST', headers: auth ? { authorization: auth } : {} }));

  it('is off until a long enough secret is configured', async () => {
    delete process.env.TEST_LADDER_SECRET;
    assert.equal((await call(`Bearer ${SECRET}`)).status, 503);
    process.env.TEST_LADDER_SECRET = 'short';
    assert.equal((await call('Bearer short')).status, 503);
  });

  it('runs only with the right secret', async () => {
    process.env.TEST_LADDER_SECRET = SECRET;
    assert.equal((await call()).status, 401);
    assert.equal((await call(`Bearer ${SECRET}x`)).status, 401);
    assert.equal((await call(`Basic ${SECRET}`)).status, 401);
    const ok = await call(`Bearer ${SECRET}`);
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { done: true });
    delete process.env.TEST_LADDER_SECRET;
  });
});
