import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { replayFixture as fixture } from './helpers.js';
import { parseReplayId, parseBattleLog, toBattleRecord, baseOfMega, replayUrl, withoutPassword, IMPORT_ERRORS, PARSE_VERSION } from '../src/domain/replay.js';

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

  it("strips only an unlisted replay's password suffix", () => {
    assert.equal(withoutPassword(`${ID}-abc123pw`), ID);
    assert.equal(withoutPassword(ID), ID);
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

  it('reads both ladder ratings from the post-game update', () => {
    assert.deepEqual(battle.ratings, { p1: { before: 1134, after: 1161 }, p2: { before: 1160, after: 1133 } });
  });

  it('records the two leads on each side', () => {
    assert.deepEqual(battle.leads, { p1: ['Metagross', 'Whimsicott'], p2: ['Farigiraf', 'Incineroar'] });
  });

  it('counts each move per Pokémon, following nicknames across slots', () => {
    assert.deepEqual(battle.moves.p1.Metagross, { 'Steel Roller': 2, Protect: 1, 'Bullet Punch': 1 });
    assert.deepEqual(battle.moves.p1['Indeedee-F'], { Psychic: 2, 'Helping Hand': 1 });
    assert.equal(battle.moves.p2.Incineroar['Flare Blitz'], 2);
  });

  it('keeps two Pokémon of one side apart even when they share a slot over time', () => {
    const log = [
      '|switch|p1a: Ace|Rillaboom, L50|100/100', '|move|p1a: Ace|Fake Out|p2a: Z',
      '|switch|p1a: Cat|Incineroar, L50|100/100', '|move|p1a: Cat|Fake Out|p2a: Z',
      '|move|p1b: Ace|Grassy Glide|p2a: Z',
    ].join('\n');
    assert.deepEqual(parseBattleLog(log).moves.p1, { Rillaboom: { 'Fake Out': 1, 'Grassy Glide': 1 }, Incineroar: { 'Fake Out': 1 } });
  });

  it('ignores moves called by something else and switches after turn 1 for leads', () => {
    const log = [
      '|player|p1|Ann|1|', '|switch|p1a: X|Rillaboom, L50|100/100', '|switch|p1b: Y|Incineroar, L50|100/100',
      '|turn|1', '|move|p1a: X|Fake Out|p2a: Z', '|move|p1a: X|Outrage|p2a: Z|[from]lockedmove',
      '|switch|p1a: W|Sneasler, L50|100/100',
    ].join('\n');
    const parsed = parseBattleLog(log);
    assert.deepEqual(parsed.leads.p1, ['Rillaboom', 'Incineroar']);
    assert.deepEqual(parsed.moves.p1, { Rillaboom: { 'Fake Out': 1 } });
  });

  it('uses the |player| rating as "before" when there is no post-game update', () => {
    assert.deepEqual(parseBattleLog('|player|p1|Ann|1|1500').ratings.p1, { before: 1500, after: null });
    assert.deepEqual(parseBattleLog('|player|p1|Ann|1|').ratings.p1, { before: null, after: null });
  });

  it('ignores rating lines for names that are not in the battle', () => {
    const log = "|player|p1|Ann|1|1000\n|raw|Bob's rating: 1000 &rarr; <strong>1020</strong>";
    assert.equal(parseBattleLog(log).ratings.p1.after, null);
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
    assert.equal(record.rating_before, 1134);
    assert.equal(record.rating_after, 1161);
    assert.deepEqual(record.leads, ['Metagross', 'Whimsicott']);
    assert.deepEqual(record.opponent_leads, ['Farigiraf', 'Incineroar']);
    assert.equal(record.moves.Metagross['Steel Roller'], 2);
    assert.equal(record.parse_version, PARSE_VERSION);
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
