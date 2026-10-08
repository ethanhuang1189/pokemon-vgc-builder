import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { replayFixture } from './helpers.js';
import { toBattleRecord } from '../src/domain/replay.js';
import { summarizeBattles, groupByTeam } from '../src/domain/battleStats.js';
import {
  eloSeries, ratedAccounts, ratingSummary, matchups, attendance, commonLeads, movesByPokemon,
  adjustedWinRate, MIN_MATCHUP_GAMES,
} from '../src/domain/battleInsights.js';

// Checks that every number the stats panels show is right: a small season worked out by hand,
// a randomized comparison against straightforward reference implementations, and invariants
// on a real replay.

const TEAM = ['Rillaboom', 'Incineroar', 'Sneasler', 'Kingambit', 'Garchomp', 'Whimsicott'];

describe('a hand-checked season', () => {
  // Five games on two accounts. Expected values below are worked out by hand from this table.
  const season = [
    { player_name: 'Main', result: 'win', rating_before: 1500, rating_after: 1520, brought: ['Rillaboom', 'Incineroar', 'Sneasler', 'Kingambit'], leads: ['Rillaboom', 'Incineroar'], opponent_brought: ['Amoonguss', 'Dragonite', 'Basculegion', 'Pelipper'], moves: { Rillaboom: { 'Fake Out': 1, 'Grassy Glide': 2 } } },
    { player_name: 'Main', result: 'loss', rating_before: 1520, rating_after: 1501, brought: ['Rillaboom', 'Incineroar', 'Garchomp', 'Kingambit'], leads: ['Incineroar', 'Rillaboom'], opponent_brought: ['Amoonguss', 'Dragonite', 'Gholdengo', 'Pelipper'], moves: { Rillaboom: { 'Fake Out': 1 } } },
    { player_name: 'Alt', result: 'win', rating_before: 1000, rating_after: 1040, brought: ['Sneasler', 'Kingambit', 'Garchomp', 'Whimsicott'], leads: ['Sneasler', 'Whimsicott'], opponent_brought: ['Amoonguss', 'Gholdengo', 'Basculegion', 'Pelipper'], moves: { Sneasler: { 'Close Combat': 2 } } },
    { player_name: 'Main', result: 'loss', rating_before: 1501, rating_after: 1480, brought: ['Rillaboom', 'Incineroar', 'Sneasler', 'Garchomp'], leads: ['Rillaboom', 'Incineroar'], opponent_brought: ['Amoonguss', 'Dragonite', 'Gholdengo', 'Basculegion'], moves: { Rillaboom: { 'Wood Hammer': 1 } } },
    { player_name: 'Alt', result: 'tie', rating_before: 1040, rating_after: 1040, brought: ['Sneasler', 'Kingambit', 'Garchomp', 'Whimsicott'], leads: ['Whimsicott', 'Sneasler'], opponent_brought: ['Dragonite', 'Gholdengo', 'Basculegion', 'Pelipper'], moves: {} },
  ].map((b, i) => ({ format: 'Reg M-C', team: TEAM, played_at: `2026-10-0${i + 1}T00:00:00Z`, opponent_name: `Opp${i}`, ...b }));

  it('has the right record', () => {
    assert.deepEqual(summarizeBattles(season).record, { games: 5, wins: 2, losses: 2, ties: 1, winRate: 0.4 });
  });

  it("has the right per-Pokémon numbers for both sides", () => {
    const { yourPokemon, opponentPokemon } = summarizeBattles(season);
    const mine = Object.fromEntries(yourPokemon.map(p => [p.name, [p.games, p.wins, p.losses]]));
    assert.deepEqual(mine, {
      Rillaboom: [3, 1, 2], Incineroar: [3, 1, 2], Sneasler: [4, 2, 1], Kingambit: [4, 2, 1], Garchomp: [4, 1, 2], Whimsicott: [2, 1, 0],
    });
    const theirs = Object.fromEntries(opponentPokemon.map(p => [p.name, [p.games, p.wins, p.losses]]));
    assert.deepEqual(theirs, {
      Amoonguss: [4, 2, 2], Dragonite: [4, 1, 2], Basculegion: [4, 2, 1], Pelipper: [4, 2, 1], Gholdengo: [4, 1, 2],
    });
  });

  it('charts each account on its own line with the right changes', () => {
    const series = eloSeries(season);
    assert.deepEqual(series.map(s => [s.account, s.points.map(p => [p.rating, p.change])]), [
      ['main', [[1520, 20], [1501, -19], [1480, -21]]],
      ['alt', [[1040, 40], [1040, 0]]],
    ]);
    assert.deepEqual(ratingSummary(series[0].points), { current: 1480, peak: 1520, net: -20 });
    assert.deepEqual(ratingSummary(series[1].points), { current: 1040, peak: 1040, net: 40 });
    assert.deepEqual(ratedAccounts(season).map(a => [a.name, a.games]), [['Alt', 2], ['Main', 3]]);
  });

  it('ranks matchups against the 40% baseline', () => {
    const { best, worst, baseline } = matchups(season);
    assert.equal(baseline, 0.4);
    // Win rates: Basculegion and Pelipper 2/4 (above), Amoonguss 2/4 (above), Dragonite and Gholdengo 1/4 (below).
    assert.deepEqual(best.map(p => [p.name, p.winRate]), [['Amoonguss', 0.5], ['Basculegion', 0.5], ['Pelipper', 0.5]]);
    assert.deepEqual(worst.map(p => [p.name, p.winRate]), [['Dragonite', 0.25], ['Gholdengo', 0.25]]);
    assert.equal(best[0].score, adjustedWinRate(2, 4, 0.4));
  });

  it('has the right attendance', () => {
    const rates = Object.fromEntries(attendance(season).all.map(p => [p.name, [p.brought, p.games, p.rate]]));
    assert.deepEqual(rates, {
      Sneasler: [4, 5, 0.8], Kingambit: [4, 5, 0.8], Garchomp: [4, 5, 0.8],
      Rillaboom: [3, 5, 0.6], Incineroar: [3, 5, 0.6], Whimsicott: [2, 5, 0.4],
    });
  });

  it('has the right leads', () => {
    assert.deepEqual(commonLeads(season).map(l => [l.key, l.games, l.wins, l.losses, l.winRate]), [
      ['Incineroar|Rillaboom', 3, 1, 2, 1 / 3],
      ['Sneasler|Whimsicott', 2, 1, 0, 0.5],
    ]);
  });

  it('has the right move usage', () => {
    const moves = Object.fromEntries(movesByPokemon(season, TEAM).map(p => [p.species, [p.total, p.slices.map(s => [s.name, s.count])]]));
    assert.deepEqual(moves, {
      Rillaboom: [5, [['Fake Out', 2], ['Grassy Glide', 2], ['Wood Hammer', 1]]],
      Sneasler: [2, [['Close Combat', 2]]],
    });
  });
});

// A seeded generator so failures reproduce.
function rng(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 2 ** 32; return s / 2 ** 32; };
}
const pick = (rand, list, n) => [...list].sort(() => rand() - 0.5).slice(0, n);

const MY_POOL = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'];
const OPP_POOL = ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8', 'O9', 'O10', 'O11', 'O12'];
const RESULTS = ['win', 'win', 'loss', 'loss', 'tie'];

function randomBattles(seed, count) {
  const rand = rng(seed);
  const ratings = {};
  return Array.from({ length: count }, (_, i) => {
    const account = ['Main', 'Alt', 'Third'][Math.floor(rand() * 3)];
    const format = rand() < 0.8 ? 'Bo1' : 'Bo3';
    const team = pick(rand, MY_POOL, 6);
    const brought = pick(rand, team, 4);
    const key = `${account}|${format}`;
    const before = ratings[key] ?? 1000 + Math.floor(rand() * 800);
    const after = before + Math.floor(rand() * 60) - 30;
    const rated = rand() < 0.85;
    if (rated) ratings[key] = after;
    return {
      player_name: account, format, team, brought, leads: brought.slice(0, 2),
      result: RESULTS[Math.floor(rand() * RESULTS.length)],
      opponent_brought: pick(rand, OPP_POOL, 4),
      rating_before: rated ? before : null, rating_after: rated ? after : null,
      played_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      moves: Object.fromEntries(brought.map(s => [s, { Protect: Math.floor(rand() * 3), Attack: Math.floor(rand() * 4) }])),
    };
  });
}

describe('randomized cross-check against reference implementations', () => {
  for (const seed of [1, 7, 42, 1234, 99991]) {
    const battles = randomBattles(seed, 120);

    it(`record and per-Pokémon tallies match (seed ${seed})`, () => {
      const { record, yourPokemon, opponentPokemon } = summarizeBattles(battles);
      const count = (r) => battles.filter(b => b.result === r).length;
      assert.deepEqual(record, { games: battles.length, wins: count('win'), losses: count('loss'), ties: count('tie'), winRate: count('win') / battles.length });
      for (const [rows, key] of [[yourPokemon, 'brought'], [opponentPokemon, 'opponent_brought']]) {
        for (const row of rows) {
          const games = battles.filter(b => b[key].includes(row.name));
          assert.equal(row.games, games.length, row.name);
          assert.equal(row.wins, games.filter(b => b.result === 'win').length, row.name);
          assert.equal(row.losses, games.filter(b => b.result === 'loss').length, row.name);
          assert.equal(row.winRate, row.wins / row.games, row.name);
        }
        assert.equal(rows.reduce((n, r) => n + r.games, 0), battles.reduce((n, b) => n + b[key].length, 0));
      }
    });

    it(`rating lines never mix accounts or ladders (seed ${seed})`, () => {
      const series = eloSeries(battles);
      const rated = battles.filter(b => b.rating_after !== null);
      assert.equal(series.reduce((n, s) => n + s.points.length, 0), rated.length);
      for (const s of series) {
        const own = rated.filter(b => b.player_name.toLowerCase() === s.account && b.format === s.format);
        assert.deepEqual(s.points.map(p => p.rating), own.map(b => b.rating_after));
        assert.deepEqual(s.points.map(p => p.change), own.map(b => b.rating_after - b.rating_before));
        // Within one account and ladder each game starts where the last one ended, so the line
        // moves by exactly each game's change.
        for (let i = 1; i < s.points.length; i++) assert.equal(s.points[i].rating - s.points[i - 1].rating, s.points[i].change);
      }
      assert.equal(ratedAccounts(battles).reduce((n, a) => n + a.games, 0), rated.length);
    });

    it(`matchups are ranked and split correctly (seed ${seed})`, () => {
      const { best, worst, mostFaced, baseline } = matchups(battles, 100);
      assert.equal(baseline, battles.filter(b => b.result === 'win').length / battles.length);
      const eligible = summarizeBattles(battles).opponentPokemon.filter(p => p.games >= MIN_MATCHUP_GAMES);
      assert.equal(mostFaced.length, eligible.length);
      for (const p of best) assert.ok(p.winRate > baseline && p.score > baseline, p.name);
      for (const p of worst) assert.ok(p.winRate < baseline && p.score < baseline, p.name);
      for (let i = 1; i < best.length; i++) assert.ok(best[i - 1].score >= best[i].score);
      for (let i = 1; i < worst.length; i++) assert.ok(worst[i - 1].score <= worst[i].score);
      for (let i = 1; i < mostFaced.length; i++) assert.ok(mostFaced[i - 1].games >= mostFaced[i].games);
      assert.equal(best.length + worst.length, eligible.filter(p => p.winRate !== baseline).length);
    });

    it(`attendance, leads and moves add up (seed ${seed})`, () => {
      for (const p of attendance(battles).all) {
        const onTeam = battles.filter(b => b.team.includes(p.name));
        assert.equal(p.games, onTeam.length, p.name);
        assert.equal(p.brought, onTeam.filter(b => b.brought.includes(p.name)).length, p.name);
      }
      for (const l of commonLeads(battles, 100)) {
        const games = battles.filter(b => [...b.leads].sort().join('|') === l.key);
        assert.equal(l.games, games.length);
        assert.equal(l.wins, games.filter(b => b.result === 'win').length);
      }
      assert.equal(commonLeads(battles, 1000).reduce((n, l) => n + l.games, 0), battles.length);
      for (const p of movesByPokemon(battles)) {
        const expected = battles.reduce((n, b) => n + Object.values(b.moves[p.species] ?? {}).reduce((a, c) => a + c, 0), 0);
        assert.equal(p.total, expected, p.species);
        assert.equal(p.slices.reduce((n, s) => n + s.count, 0), p.total);
        assert.ok(Math.abs(p.slices.reduce((n, s) => n + s.share, 0) - 1) < 1e-9);
      }
    });

    it(`team groups partition the battles (seed ${seed})`, () => {
      const groups = groupByTeam(battles);
      assert.equal(groups.reduce((n, g) => n + g.record.games, 0), battles.length);
      assert.equal(groups.reduce((n, g) => n + g.record.wins, 0), summarizeBattles(battles).record.wins);
    });
  }
});

describe('a real replay, end to end', () => {
  const replay = replayFixture;
  for (const side of [0, 1]) {
    it(`gives consistent numbers for player ${side + 1}`, () => {
      const { record } = toBattleRecord(replay, new Set([replay.players[side].toLowerCase().replace(/[^a-z0-9]/g, '')]));
      assert.equal(record.team.length, 6);
      assert.equal(record.brought.length, 4);
      assert.equal(record.opponent_brought.length, 4);
      for (const s of record.brought) assert.ok(record.team.includes(s), s);
      for (const s of record.opponent_brought) assert.ok(record.opponent_team.includes(s), s);
      for (const s of record.leads) assert.ok(record.brought.includes(s), s);
      for (const s of Object.keys(record.moves)) assert.ok(record.brought.includes(s), s);
      assert.equal(record.rating_after - record.rating_before, eloSeries([record])[0].points[0].change);
      const { yourPokemon } = summarizeBattles([record]);
      assert.equal(yourPokemon.length, 4);
    });
  }
});
