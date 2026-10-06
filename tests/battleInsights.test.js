import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { eloSeries, matchups, attendance, commonLeads, moveUsage, MIN_MATCHUP_GAMES } from '../src/domain/battleInsights.js';
import { niceStep, niceTicks, linear } from '../src/utils/chartScale.js';

let day = 0;
const game = (overrides = {}) => ({
  format: 'Reg M-C', result: 'win', played_at: new Date(Date.UTC(2026, 9, 1 + day++)).toISOString(),
  team: [], brought: [], opponent_brought: [], leads: [], moves: {}, ...overrides,
});

describe('eloSeries', () => {
  it('lists the rating after each rated game, oldest first, with the change', () => {
    const [series] = eloSeries([
      game({ rating_before: 1100, rating_after: 1120, played_at: '2026-10-02T00:00:00Z' }),
      game({ rating_before: 1000, rating_after: 1100, played_at: '2026-10-01T00:00:00Z' }),
      game({ played_at: '2026-10-03T00:00:00Z' }), // unrated
    ]);
    assert.deepEqual(series.points.map(p => [p.game, p.rating, p.change]), [[1, 1100, 100], [2, 1120, 20]]);
  });

  it('keeps each ladder separate, the one with most games first', () => {
    const series = eloSeries([
      game({ format: 'Bo3', rating_after: 1000 }),
      game({ format: 'Bo1', rating_after: 1200 }),
      game({ format: 'Bo1', rating_after: 1210 }),
    ]);
    assert.deepEqual(series.map(s => [s.format, s.points.length]), [['Bo1', 2], ['Bo3', 1]]);
  });

  it('reports an unknown change as null and handles no rated games', () => {
    assert.equal(eloSeries([game({ rating_after: 1000 })])[0].points[0].change, null);
    assert.deepEqual(eloSeries([game()]), []);
  });
});

describe('matchups', () => {
  const vs = (name, result) => game({ opponent_brought: [name], result });
  const battles = [
    ...Array(MIN_MATCHUP_GAMES).fill(0).map(() => vs('Incineroar', 'win')),
    ...Array(MIN_MATCHUP_GAMES).fill(0).map((_, i) => vs('Sneasler', i ? 'loss' : 'win')),
    vs('Kingambit', 'loss'), // too few games
  ];

  it(`needs ${MIN_MATCHUP_GAMES}+ games against a Pokémon`, () => {
    const { best, worst } = matchups(battles);
    assert.deepEqual(best.map(p => p.name), ['Incineroar', 'Sneasler']);
    assert.deepEqual(worst, []);
  });

  it('never lists the same Pokémon as best and worst', () => {
    const { best, worst } = matchups(battles, 1);
    assert.deepEqual([best[0].name, worst[0].name], ['Incineroar', 'Sneasler']);
  });

  it('is empty without enough data', () => {
    assert.deepEqual(matchups([]), { best: [], worst: [] });
  });
});

describe('attendance', () => {
  const team = ['A', 'B', 'C', 'D', 'E', 'F'];
  const battles = [
    game({ team, brought: ['A', 'B', 'C', 'D'] }),
    game({ team, brought: ['A', 'B', 'C', 'E'] }),
    game({ team, brought: ['A', 'B', 'D', 'E'] }),
  ];

  it('rates how often each team member is brought', () => {
    const { highest, lowest } = attendance(battles, 2);
    assert.deepEqual(highest.map(p => [p.name, p.brought, p.games]), [['A', 3, 3], ['B', 3, 3]]);
    assert.deepEqual(lowest.map(p => [p.name, p.rate]), [['F', 0], ['C', 2 / 3]]);
  });

  it('only counts games where the Pokémon was on the team', () => {
    const { highest } = attendance([...battles, game({ team: ['Z'], brought: ['Z'] })], 1);
    assert.deepEqual([highest[0].name, highest[0].games], ['A', 3]);
  });
});

describe('commonLeads', () => {
  it('counts lead pairs regardless of slot order, most used first', () => {
    const leads = commonLeads([
      game({ leads: ['Rillaboom', 'Incineroar'], result: 'win' }),
      game({ leads: ['Incineroar', 'Rillaboom'], result: 'loss' }),
      game({ leads: ['Sneasler', 'Kingambit'] }),
      game({ leads: [] }),
    ]);
    assert.deepEqual(leads.map(l => [l.leads, l.games, l.winRate]), [
      [['Incineroar', 'Rillaboom'], 2, 0.5],
      [['Kingambit', 'Sneasler'], 1, 1],
    ]);
  });
});

describe('moveUsage', () => {
  it('totals moves across games, largest first, with shares', () => {
    const { total, slices } = moveUsage([game({ moves: { 'Fake Out': 2, Protect: 1 } }), game({ moves: { Protect: 3 } })]);
    assert.equal(total, 6);
    assert.deepEqual(slices.map(s => [s.name, s.count]), [['Protect', 4], ['Fake Out', 2]]);
    assert.equal(slices[0].share, 4 / 6);
  });

  it('folds the tail into "Other" past the top moves', () => {
    const moves = Object.fromEntries('ABCDEFGHIJ'.split('').map((m, i) => [m, 10 - i]));
    const { slices, total } = moveUsage([game({ moves })], 7);
    assert.equal(slices.length, 8);
    assert.deepEqual(slices.at(-1), { name: 'Other', count: 3 + 2 + 1, other: true, share: 6 / total });
  });

  it('does not make an "Other" slice for a single leftover move', () => {
    const moves = Object.fromEntries('ABCDEFGH'.split('').map(m => [m, 1]));
    assert.equal(moveUsage([game({ moves })], 7).slices.some(s => s.other), false);
  });

  it('ignores junk counts and handles no moves', () => {
    assert.equal(moveUsage([game({ moves: { Protect: 'x' } }), game({ moves: null })]).total, 0);
    assert.deepEqual(moveUsage([]).slices, []);
  });
});

describe('chart scale', () => {
  it('picks round tick steps', () => {
    assert.equal(niceStep(100), 25);
    assert.equal(niceStep(330), 100);
    assert.equal(niceStep(0), 1);
  });

  it('covers the data on round ticks, padding a flat line', () => {
    assert.deepEqual(niceTicks([1134, 1161, 1240]), { min: 1100, max: 1250, ticks: [1100, 1150, 1200, 1250] });
    const flat = niceTicks([1200, 1200]);
    assert.ok(flat.min < 1200 && flat.max > 1200);
    assert.deepEqual(niceTicks([]).ticks, [0, 1]);
  });

  it('maps linearly and centers a zero-width domain', () => {
    assert.equal(linear(0, 10, 0, 100)(5), 50);
    assert.equal(linear(1, 1, 0, 100)(1), 50);
  });
});
