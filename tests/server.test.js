import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { replayFixture } from './helpers.js';
import { authedPost, HttpError } from '../server/http.js';
import { createReplayService, MAX_SYNC_IMPORTS } from '../server/replays.js';
import { createShowdownClient } from '../server/showdown.js';

const REPLAY_ID = replayFixture.id;
const USER = { id: 'user-1' };

// ── Fakes ────────────────────────────────────────────────────────────────────
const fakeAuth = { getUser: async (token) => (token === 'good' ? { data: { user: USER } } : { data: {}, error: new Error('bad jwt') }) };

function fakeStore({ names = ['playerone'], existing = [] } = {}) {
  const saved = [];
  return {
    saved,
    linkedNameIds: async () => new Set(names),
    existingReplayIds: async (_, ids) => new Set(ids.filter(id => existing.includes(id))),
    saveBattle: async (userId, record) => { saved.push({ userId, ...record }); return { id: saved.length, ...record }; },
  };
}

function fakeShowdown({ replays = { [REPLAY_ID]: replayFixture }, search = [] } = {}) {
  return {
    fetchReplay: async (id) => replays[id] ?? null,
    searchReplays: async () => search,
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
  const entry = (n, format = 'gen9championsvgc2026regmc') => ({ id: `${format}-${n}` });
  const replaysFor = (entries) => Object.fromEntries(entries.map(e => [e.id, { ...replayFixture, id: e.id }]));

  it('imports new Champions replays only, skipping known ones and other formats', async () => {
    const search = [entry(1), entry(2), entry(3, 'gen9ou')];
    const store = fakeStore({ existing: [entry(1).id] });
    const service = createReplayService({ store, showdown: fakeShowdown({ search, replays: replaysFor(search) }) });
    assert.deepEqual(await service.syncRecent(USER.id), { imported: 1, remaining: 0 });
    assert.deepEqual(store.saved.map(s => s.replay_id), [entry(2).id]);
  });

  it('caps imports per sync and reports what is left', async () => {
    const search = Array.from({ length: MAX_SYNC_IMPORTS + 5 }, (_, i) => entry(i));
    const service = createReplayService({ store: fakeStore(), showdown: fakeShowdown({ search, replays: replaysFor(search) }) });
    assert.deepEqual(await service.syncRecent(USER.id), { imported: MAX_SYNC_IMPORTS, remaining: 5 });
  });

  it('skips replays that cannot be imported instead of failing the sync', async () => {
    const search = [entry(1), entry(2)];
    const replays = { [entry(2).id]: { ...replayFixture, id: entry(2).id } }; // entry 1 vanished
    const service = createReplayService({ store: fakeStore(), showdown: fakeShowdown({ search, replays }) });
    assert.deepEqual(await service.syncRecent(USER.id), { imported: 1, remaining: 0 });
  });

  it('needs at least one linked name', async () => {
    const service = createReplayService({ store: fakeStore({ names: [] }), showdown: fakeShowdown() });
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

  it('maps 404 to null and other failures to 502', async () => {
    assert.equal(await createShowdownClient(respond('', 404)).fetchReplay(REPLAY_ID), null);
    for (const fetchImpl of [respond('', 500), respond('not json'), respond('x'.repeat(3_000_001)), async () => { throw new Error('timeout'); }]) {
      assert.equal(await statusOf(createShowdownClient(fetchImpl).fetchReplay(REPLAY_ID)), 502);
    }
  });

  it('requests the encoded URL and treats non-array search results as empty', async () => {
    let requested;
    const client = createShowdownClient(async (url) => { requested = url; return new Response('{"not":"array"}'); });
    assert.deepEqual(await client.searchReplays('ash ketchum&x=1'), []);
    assert.equal(requested, 'https://replay.pokemonshowdown.com/search.json?user=ash%20ketchum%26x%3D1');
  });
});
