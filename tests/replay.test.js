import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { replayFixture as fixture } from './helpers.js';
import { parseReplayId, parseBattleLog, toBattleRecord, baseOfMega, replayUrl, IMPORT_ERRORS } from '../src/domain/replay.js';

const ID = 'gen9championsvgc2026regmc-2693320870';

describe('parseReplayId', () => {
  it('accepts bare ids, replay URLs and battle-room paths', () => {
    for (const input of [
      ID,
      `https://replay.pokemonshowdown.com/${ID}`,
      `replay.pokemonshowdown.com/${ID}`,
      `https://replay.pokemonshowdown.com/${ID}.json`,
      `https://replay.pokemonshowdown.com/${ID}?p2`,
      `https://play.pokemonshowdown.com/battle-${ID}`,
      `battle-${ID}`,
      `  ${ID.toUpperCase()}  `,
    ]) {
      assert.equal(parseReplayId(input), ID, input);
    }
  });

  it('keeps the password suffix of unlisted replays', () => {
    assert.equal(parseReplayId(`https://replay.pokemonshowdown.com/${ID}-abc123pw`), `${ID}-abc123pw`);
  });

  it('rejects other sites, paths, junk and oversized input', () => {
    for (const input of [
      `https://evil.example/${ID}`,
      `https://replay.pokemonshowdown.com.evil.example/${ID}`,
      `https://replay.pokemonshowdown.com/../${ID}`,
      'https://replay.pokemonshowdown.com/',
      'javascript:alert(1)',
      `${ID}/extra`,
      'gen9vgc',
      `${'a'.repeat(100)}-1`,
      '', null, undefined, 42,
    ]) {
      assert.equal(parseReplayId(input), null, String(input));
    }
  });

  it('builds safe replay URLs', () => {
    assert.equal(replayUrl(ID), `https://replay.pokemonshowdown.com/${ID}`);
  });
});

describe('baseOfMega', () => {
  it('strips the mega suffix but keeps other formes', () => {
    assert.equal(baseOfMega('Metagross-Mega'), 'Metagross');
    assert.equal(baseOfMega('Garchomp-Mega-Z'), 'Garchomp');
    assert.equal(baseOfMega('Meowstic-F-Mega'), 'Meowstic-F');
    assert.equal(baseOfMega('Indeedee-F'), 'Indeedee-F');
  });
});

describe('parseBattleLog (real replay)', () => {
  const battle = parseBattleLog(fixture.log);

  it('reads players, full teams, turns and the winner', () => {
    assert.deepEqual(battle.players, { p1: 'Player One', p2: 'Player Two' });
    assert.deepEqual(battle.teams.p1, ['Metagross', 'Perrserker', 'Sneasler', 'Indeedee-F', 'Delphox', 'Whimsicott']);
    assert.equal(battle.teams.p2.length, 6);
    assert.equal(battle.turns, 6);
    assert.equal(battle.winner, 'Player One');
    assert.equal(battle.tie, false);
  });

  it('records the four brought, with megas counted as their base forme', () => {
    assert.deepEqual(new Set(battle.brought.p1), new Set(['Metagross', 'Whimsicott', 'Indeedee-F', 'Sneasler']));
    assert.deepEqual(new Set(battle.brought.p2), new Set(['Farigiraf', 'Incineroar', 'Torkoal', 'Garchomp']));
  });

  it('records who mega evolved into what', () => {
    assert.deepEqual(battle.megas, { p1: 'Metagross-Mega', p2: 'Garchomp-Mega-Z' });
  });

  it('handles empty or junk logs', () => {
    for (const log of ['', null, undefined, '|||\n|poke|\n|switch|']) {
      const empty = parseBattleLog(log);
      assert.equal(empty.winner, null);
      assert.deepEqual(empty.teams, { p1: [], p2: [] });
    }
  });

  it('ignores the blank |player| lines Showdown sends when a player leaves', () => {
    assert.deepEqual(parseBattleLog('|player|p1|Ann|1|\n|player|p1|').players, { p1: 'Ann' });
  });

  it('detects ties and the highest turn', () => {
    const tie = parseBattleLog('|turn|3\n|turn|12\n|tie');
    assert.equal(tie.tie, true);
    assert.equal(tie.turns, 12);
  });
});

describe('toBattleRecord', () => {
  it('builds a record from the winner\'s side', () => {
    const { record } = toBattleRecord(fixture, new Set(['playerone']));
    assert.equal(record.result, 'win');
    assert.equal(record.player_name, 'Player One');
    assert.equal(record.opponent_name, 'Player Two');
    assert.equal(record.mega, 'Metagross-Mega');
    assert.equal(record.opponent_mega, 'Garchomp-Mega-Z');
    assert.equal(record.replay_id, ID);
    assert.equal(record.format_id, 'gen9championsvgc2026regmc');
    assert.equal(record.played_at, new Date(fixture.uploadtime * 1000).toISOString());
    assert.equal(record.rating, fixture.rating);
  });

  it('builds a record from the loser\'s side', () => {
    const { record } = toBattleRecord(fixture, new Set(['playertwo']));
    assert.equal(record.result, 'loss');
    assert.equal(record.player_name, 'Player Two');
    assert.equal(record.brought.length, 4);
  });

  it('matches names ignoring case and punctuation', () => {
    assert.ok(toBattleRecord(fixture, new Set(['playerone'])).record);
  });

  it('refuses battles none of your names played', () => {
    assert.deepEqual(toBattleRecord(fixture, new Set(['someoneelse'])), { error: IMPORT_ERRORS.notYourBattle });
    assert.deepEqual(toBattleRecord(fixture, new Set()), { error: IMPORT_ERRORS.notYourBattle });
  });

  it('refuses unfinished battles and records ties', () => {
    const unfinished = { ...fixture, log: fixture.log.replace(/\|win\|.*\n?/, '') };
    assert.deepEqual(toBattleRecord(unfinished, new Set(['playerone'])), { error: IMPORT_ERRORS.unfinished });
    const tied = { ...unfinished, log: `${unfinished.log}\n|tie` };
    assert.equal(toBattleRecord(tied, new Set(['playerone'])).record.result, 'tie');
  });

  it('falls back to the replay\'s player list and a null rating', () => {
    const noPlayerLines = { ...fixture, rating: undefined, log: fixture.log.replace(/^\|player\|.*$/gm, '') };
    const { record } = toBattleRecord(noPlayerLines, new Set(['playertwo']));
    assert.equal(record.player_name, 'Player Two');
    assert.equal(record.rating, null);
  });
});
