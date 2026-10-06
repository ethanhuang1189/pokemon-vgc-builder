import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildBookmarklet } from '../src/domain/bookmarklet.js';
import { parseReplayId } from '../src/domain/replay.js';

const ORIGIN = 'https://vgc.example';
const ROOM = 'battle-gen9championsvgc2026regmc-2693320870';

// Runs the bookmarklet against a fake Showdown page and returns what it did.
function runOnPage({ path = `/${ROOM}`, replayLinks = [], linkAfterPolls = 0 } = {}) {
  const page = { clicked: 0, alerts: [], navigatedTo: null, intervals: [] };
  let polls = 0;
  const sandbox = {
    location: {
      pathname: path,
      set href(url) { page.navigatedTo = url; },
    },
    alert: (msg) => page.alerts.push(msg),
    document: {
      querySelector: (sel) => (sel === 'button[name=saveReplay]' ? { click: () => page.clicked++ } : null),
      querySelectorAll: () => (polls >= linkAfterPolls ? replayLinks.map(href => ({ href })) : []),
    },
    setInterval: (fn) => { page.intervals.push(fn); return page.intervals.length; },
    clearInterval: (id) => { page.intervals[id - 1] = null; },
    encodeURIComponent,
  };
  vm.runInNewContext(decodeURIComponent(buildBookmarklet(ORIGIN).slice('javascript:'.length)), sandbox);

  // Drive the polling timer until it stops itself.
  for (let i = 0; i < 50 && page.intervals[0]; i++) {
    polls++;
    page.intervals[0]();
  }
  return page;
}

const importedReplay = (url) => parseReplayId(new URL(url).searchParams.get('import'));

describe('bookmarklet', () => {
  it('is a single javascript: URL with nothing a browser would percent-decode or split', () => {
    const code = buildBookmarklet(ORIGIN);
    assert.ok(code.startsWith('javascript:'));
    assert.equal(/[\n%]/.test(code), false);
  });

  it('presses Showdown\'s upload button and opens the import page with the replay link', () => {
    const link = `https://replay.pokemonshowdown.com/${ROOM.slice(7)}`;
    const page = runOnPage({ replayLinks: ['https://replay.pokemonshowdown.com/other-1', link], linkAfterPolls: 3 });
    assert.equal(page.clicked, 1);
    assert.ok(page.navigatedTo.startsWith(`${ORIGIN}/?import=`));
    assert.equal(importedReplay(page.navigatedTo), ROOM.slice(7));
  });

  it('carries the password of unlisted replays', () => {
    const page = runOnPage({ replayLinks: [`https://replay.pokemonshowdown.com/${ROOM.slice(7)}-secretpw`] });
    assert.equal(importedReplay(page.navigatedTo), `${ROOM.slice(7)}-secretpw`);
  });

  it('falls back to the room id when no link appears (replay already uploaded)', () => {
    const page = runOnPage({ replayLinks: [] });
    assert.equal(importedReplay(page.navigatedTo), ROOM.slice(7));
  });

  it('does nothing but warn outside a battle', () => {
    const page = runOnPage({ path: '/' });
    assert.equal(page.clicked, 0);
    assert.equal(page.navigatedTo, null);
    assert.equal(page.alerts.length, 1);
  });

  it('safely embeds unusual origins', () => {
    const code = buildBookmarklet("https://quote'and\"slash\\.example");
    assert.doesNotThrow(() => new vm.Script(decodeURIComponent(code.slice('javascript:'.length))));
  });
});
