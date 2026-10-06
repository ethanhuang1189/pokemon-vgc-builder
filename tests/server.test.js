import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { replayFixture } from './helpers.js';
import { authedPost, HttpError } from '../server/http.js';
import { createReplayService, MAX_SYNC_IMPORTS, MAX_SEARCH_PAGES } from '../server/replays.js';
import { createShowdownClient } from '../server/showdown.js';

const REPLAY_ID = replayFixture.id;
const USER = { id: 'user-1' };

// ── Fakes ────────────────────────────────────────────────────────────────────
const fakeAuth = { getUser: async (token) => (token === 'good' ? { data: { user: USER } } : { data: {}, error: new Error('bad jwt') }) };

function fakeStore({ names = ['playerone'], existing = [] } = {}) {
  const saved = [];
  const skipped = [];
  return {
    saved,
    skipped,
    linkedNameIds: async () => new Set(names),
    handledReplayIds: async (_, ids) => new Set(ids.filter(id =>
      existing.includes(id) || saved.some(s => s.replay_id === id) || skipped.includes(id))),
    // Upsert by replay id, like the real table.
    saveBattle: async (userId, record) => {
      const row = { userId, ...record };
      const at = saved.findIndex(s => s.replay_id === record.replay_id);
      if (at === -1) saved.push(row); else saved[at] = { ...saved[at], ...row };
      return { id: saved.length, ...record };
    },
    skipReplay: async (_, id) => { skipped.push(id); },
    outdatedReplayIds: async (_, version, limit) =>
      saved.filter(s => (s.parse_version ?? 1) < version).slice(0, limit).map(s => s.replay_id),
    markParsed: async (_, id, version) => { saved.find(s => s.replay_id === id).parse_version = version; },
  };
}

// `search` is the full newest-first result list, served 50 per page plus the
// "more pages" sentinel entry, like Showdown.
function fakeShowdown({ replays = { [REPLAY_ID]: replayFixture }, search = [], fetchReplay } = {}) {
  const pagesRequested = [];
  return {
    pagesRequested,
    fetchReplay: fetchReplay ?? (async (id) => replays[id] ?? null),
    searchReplays: async (_, page = 1) => {
      pagesRequested.push(page);
      return search.slice((page - 1) * 50, page * 50 + 1);
    },
  };
}

const post = (handler, { token = 'good', body = {} } = {}) => handler(new Request('https://site.example/api/x', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
  body: typeof body === 'string' ? body : JSON.stringify(body),
}));

// ── authedPost ───────────────────────────────────────────────────────────────
describe('authedPost', () => {
  const echo = authedPost(() => ({ auth: fakeAuth }), (_, user, body) => ({ user: user.id, body }));

  it('passes the verified user and JSON body to the handler', async () => {
    const res = await post(echo, { body: { a: 1 } });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { user: 'user-1', body: { a: 1 } });
    assert.equal(res.headers.get('cache-control'), 'no-store');
  });

  it('rejects missing, malformed and invalid tokens with 401', async () => {
    for (const token of [null, '', 'bad']) {
      assert.equal((await post(echo, { token })).status, 401, String(token));
    }
    const res = await echo(new Request('https://site.example/api/x', { method: 'POST', headers: { Authorization: 'Basic good' } }));
    assert.equal(res.status, 401);
  });

  it('rejects non-object bodies with 400 and oversized bodies with 413', async () => {
    for (const body of ['not json', '[1,2]', '"text"', 'null']) {
      assert.equal((await post(echo, { body })).status, 400, body);
    }
    assert.equal((await post(echo, { body: JSON.stringify({ x: 'a'.repeat(20_000) }) })).status, 413);
  });

  it('treats an empty body as {}', async () => {
    assert.deepEqual((await (await post(echo, { body: '' })).json()).body, {});
  });

  it('returns HttpError messages but hides unexpected errors', async (t) => {
    t.mock.method(console, 'error', () => {});
    const known = authedPost(() => ({ auth: fakeAuth }), () => { throw new HttpError(422, 'Nope'); });
    assert.deepEqual(await (await post(known)).json(), { error: 'Nope' });

    const crash = authedPost(() => ({ auth: fakeAuth }), () => { throw new Error('db password is hunter2'); });
    const res = await post(crash);
    assert.equal(res.status, 500);
    assert.equal(JSON.stringify(await res.json()).includes('hunter2'), false);
  });

  it('reports missing configuration as 503 without leaking details', async () => {
    const handler = authedPost(() => { throw new HttpError(503, 'Battle tracking is not set up on this server'); }, () => ({}));
    assert.equal((await post(handler)).status, 503);
  });
});

// ── Replay service ───────────────────────────────────────────────────────────
const statusOf = (promise) => promise.then(() => 200, err => err.status);

describe('importReplay', () => {
  it('fetches the replay from Showdown and saves it from the user\'s side', async () => {
    const store = fakeStore();
    const service = createReplayService({ store, showdown: fakeShowdown() });
    const { battle } = await service.importReplay(USER.id, `https://replay.pokemonshowdown.com/${REPLAY_ID}`);
    assert.equal(battle.result, 'win');
    assert.equal(store.saved[0].userId, USER.id);
  });

  it('rejects bad links (400), no linked names (422), missing replays (404) and other people\'s battles (422)', async () => {
    const make = (opts) => createReplayService({ store: fakeStore(opts), showdown: fakeShowdown() });
    assert.equal(await statusOf(make().importReplay(USER.id, 'https://evil.example/x')), 400);
    assert.equal(await statusOf(make().importReplay(USER.id, undefined)), 400);
    assert.equal(await statusOf(make({ names: [] }).importReplay(USER.id, REPLAY_ID)), 422);
    assert.equal(await statusOf(make().importReplay(USER.id, 'gen9championsvgc2026regmc-1')), 404);
    assert.equal(await statusOf(make({ names: ['stranger'] }).importReplay(USER.id, REPLAY_ID)), 422);
  });
});

describe('syncRecent', () => {
  // Newest first, like Showdown; uploadtime decreases with the index.
  const entry = (n, format = 'gen9championsvgc2026regmc') => ({ id: `${format}-${n}`, uploadtime: 1_000_000 - n });
  const entries = (count, from = 0) => Array.from({ length: count }, (_, i) => entry(from + i));
  const replaysFor = (list) => Object.fromEntries(list.map(e => [e.id, { ...replayFixture, id: e.id }]));
  const serviceFor = (search, storeOpts, showdownOpts = {}) => {
    const store = fakeStore(storeOpts);
    const showdown = fakeShowdown({ search, replays: replaysFor(search), ...showdownOpts });
    return { store, showdown, service: createReplayService({ store, showdown }) };
  };

  it('imports new Champions replays only, skipping known ones and other formats', async () => {
    const search = [entry(1), entry(2), entry(3, 'gen9ou')];
    const { store, service } = serviceFor(search, { existing: [entry(1).id] });
    assert.deepEqual(await service.syncRecent(USER.id), { imported: 1, remaining: 0 });
    assert.deepEqual(store.saved.map(s => s.replay_id), [entry(2).id]);
  });

  it('imports oldest first, a batch per call, until nothing remains', async () => {
    const search = entries(MAX_SYNC_IMPORTS + 5);
    const { store, service } = serviceFor(search);
    assert.deepEqual(await service.syncRecent(USER.id), { imported: MAX_SYNC_IMPORTS, remaining: 5 });
    assert.equal(store.saved[0].replay_id, search.at(-1).id); // the oldest
    assert.deepEqual(await service.syncRecent(USER.id), { imported: 5, remaining: 0 });
    assert.deepEqual(await service.syncRecent(USER.id), { imported: 0, remaining: 0 });
    assert.equal(new Set(store.saved.map(s => s.replay_id)).size, search.length);
  });

  it("reads further back through Showdown's pages", async () => {
    const search = entries(130);
    const { store, showdown, service } = serviceFor(search);
    while ((await service.syncRecent(USER.id)).remaining > 0) { /* keep syncing */ }
    assert.equal(store.saved.length, 130);
    assert.ok(showdown.pagesRequested.includes(3));
  });

  it('stops paging at a page that is already fully imported', async () => {
    const search = entries(200);
    const { showdown, service } = serviceFor(search, { existing: search.slice(50).map(e => e.id) });
    await service.syncRecent(USER.id);
    assert.deepEqual(showdown.pagesRequested, [1, 2]);
  });

  it('keeps paging past pages with no Champions games, up to the page limit', async () => {
    const search = [...Array.from({ length: 120 }, (_, i) => entry(i, 'gen9ou')), entry(500)];
    const { store, showdown, service } = serviceFor(search);
    await service.syncRecent(USER.id);
    assert.equal(store.saved.length, 1);
    assert.ok(Math.max(...showdown.pagesRequested) <= MAX_SEARCH_PAGES);
  });

  it('remembers replays that can never be imported instead of retrying them', async () => {
    const search = [entry(1), entry(2)];
    const replays = { [entry(2).id]: { ...replayFixture, id: entry(2).id } }; // entry 1 vanished (404)
    const { store, service } = serviceFor(search, {}, { replays });
    assert.deepEqual(await service.syncRecent(USER.id), { imported: 1, remaining: 0 });
    assert.deepEqual(store.skipped, [entry(1).id]);
    assert.deepEqual(await service.syncRecent(USER.id), { imported: 0, remaining: 0 });
  });

  it('skips replays from battles the user did not play in', async () => {
    const other = { ...replayFixture, id: entry(1).id, log: replayFixture.log.replaceAll('Player One', 'Someone Else') };
    const { store, service } = serviceFor([entry(1)], {}, { replays: { [entry(1).id]: other } });
    await service.syncRecent(USER.id);
    assert.deepEqual(store.skipped, [entry(1).id]);
  });

  it('stops and reports when Showdown is unreachable, without skipping anything', async () => {
    const { store, service } = serviceFor([entry(1)], {}, { fetchReplay: async () => { throw new HttpError(502, 'down'); } });
    assert.equal(await statusOf(service.syncRecent(USER.id)), 502);
    assert.deepEqual(store.skipped, []);
  });

  it('merges replays found under several linked names without duplicates', async () => {
    const { store, service } = serviceFor([entry(1), entry(2)], { names: ['playerone', 'altname'] });
    assert.deepEqual(await service.syncRecent(USER.id), { imported: 2, remaining: 0 });
    assert.equal(store.saved.length, 2);
  });

  it('re-reads battles stored by an older parser, filling in new fields', async () => {
    const { store, service } = serviceFor([]);
    store.saved.push({ replay_id: REPLAY_ID, parse_version: 1, team_id: 7 });
    const showdown = fakeShowdown();
    const svc = createReplayService({ store, showdown });
    assert.deepEqual(await svc.syncRecent(USER.id), { imported: 0, remaining: 0 });
    assert.equal(store.saved[0].parse_version, 2);
    assert.equal(store.saved[0].rating_after, 1161);
    assert.equal(store.saved[0].team_id, 7, 'a manual team move survives re-reading');
    void service;
  });

  it('marks an old battle as re-read when its replay is gone, keeping its data', async () => {
    const store = fakeStore();
    store.saved.push({ replay_id: 'gen9championsvgc2026regmc-1', parse_version: 1, result: 'win' });
    const svc = createReplayService({ store, showdown: fakeShowdown({ replays: {} }) });
    await svc.syncRecent(USER.id);
    assert.deepEqual([store.saved[0].parse_version, store.saved[0].result], [2, 'win']);
  });

  it('needs at least one linked name', async () => {
    const { service } = serviceFor([], { names: [] });
    assert.equal(await statusOf(service.syncRecent(USER.id)), 422);
  });
});

// ── Showdown client ──────────────────────────────────────────────────────────
describe('createShowdownClient', () => {
  const respond = (body, status = 200) => async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

  it('returns a replay only when its id matches the request', async () => {
    assert.equal((await createShowdownClient(respond(replayFixture)).fetchReplay(REPLAY_ID)).id, REPLAY_ID);
    assert.equal(await createShowdownClient(respond(replayFixture)).fetchReplay('gen9other-1'), null);
    assert.equal(await createShowdownClient(respond({ id: REPLAY_ID })).fetchReplay(REPLAY_ID), null); // no log
  });

  it('accepts private replays, whose JSON reports the id without the password', async () => {
    const replay = await createShowdownClient(respond(replayFixture)).fetchReplay(`${REPLAY_ID}-abc123pw`);
    assert.equal(replay.id, `${REPLAY_ID}-abc123pw`, 'keeps the link that opens it');
    assert.equal(await createShowdownClient(respond(replayFixture)).fetchReplay('gen9other-1-abc123pw'), null);
  });

  it('maps 404 to null and other failures to 502', async () => {
    assert.equal(await createShowdownClient(respond('', 404)).fetchReplay(REPLAY_ID), null);
    for (const fetchImpl of [respond('', 500), respond('not json'), respond('x'.repeat(3_000_001)), async () => { throw new Error('timeout'); }]) {
      assert.equal(await statusOf(createShowdownClient(fetchImpl).fetchReplay(REPLAY_ID)), 502);
    }
  });

  it('requests the encoded URL with a page and treats non-array search results as empty', async () => {
    let requested;
    const client = createShowdownClient(async (url) => { requested = url; return new Response('{"not":"array"}'); });
    assert.deepEqual(await client.searchReplays('ash ketchum&x=1', 3), []);
    assert.equal(requested, 'https://replay.pokemonshowdown.com/search.json?user=ash+ketchum%26x%3D1&page=3');
  });
});
