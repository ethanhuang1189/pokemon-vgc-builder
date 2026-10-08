import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { eloSeries, ratedAccounts, ratingSummary, adjustedWinRate, PRIOR_GAMES, matchups, attendance, commonLeads, toSlices, movesByPokemon, MIN_MATCHUP_GAMES, TOP_COUNT } from '../src/domain/battleInsights.js';
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

  it('keeps each account separate on the same ladder', () => {
    // A 1700 main and a 1000 alt playing alternately: neither line should jump between them.
    const series = eloSeries([
      game({ player_name: 'Main', rating_before: 1700, rating_after: 1712 }),
      game({ player_name: 'Alt', rating_before: 1000, rating_after: 1025 }),
      game({ player_name: 'main', rating_before: 1712, rating_after: 1698 }), // same account, other casing
      game({ player_name: 'Alt', rating_before: 1025, rating_after: 1048 }),
      game({ player_name: 'Alt', rating_before: 1048, rating_after: 1030 }),
    ]);
    assert.deepEqual(series.map(s => [s.account, s.points.map(p => p.rating)]), [
      ['alt', [1025, 1048, 1030]],
      ['main', [1712, 1698]],
    ]);
    for (const s of series) for (const p of s.points) assert.ok(Math.abs(p.change) < 50, 'no cross-account jumps');
  });

  it('reports an unknown change as null and handles no rated games', () => {
    assert.equal(eloSeries([game({ rating_after: 1000 })])[0].points[0].change, null);
    assert.deepEqual(eloSeries([game()]), []);
  });
});

describe('ratedAccounts', () => {
  it('lists accounts with rated games, most recently played first, under their newest spelling', () => {
    const accounts = ratedAccounts([
      game({ player_name: 'main', rating_after: 1700, played_at: '2026-10-01T00:00:00Z' }),
      game({ player_name: 'Alt', rating_after: 1000, played_at: '2026-10-02T00:00:00Z' }),
      game({ player_name: 'Main', rating_after: 1710, played_at: '2026-10-03T00:00:00Z' }),
      game({ player_name: 'Unrated', played_at: '2026-10-04T00:00:00Z' }),
    ]);
    assert.deepEqual(accounts, [{ id: 'main', name: 'Main', games: 2 }, { id: 'alt', name: 'Alt', games: 1 }]);
  });
});

describe('ratingSummary', () => {
  it('reports current, peak and net change from before the first game', () => {
    const points = [{ rating: 1020, change: 20 }, { rating: 1060, change: 40 }, { rating: 1045, change: -15 }];
    assert.deepEqual(ratingSummary(points), { current: 1045, peak: 1060, net: 45 });
  });

  it('measures from the first rating when its change is unknown, and handles nothing', () => {
    assert.equal(ratingSummary([{ rating: 1100, change: null }, { rating: 1080, change: -20 }]).net, -20);
    assert.equal(ratingSummary([]), null);
  });
});

describe('adjustedWinRate', () => {
  it('pulls small samples toward the baseline more than large ones', () => {
    assert.equal(adjustedWinRate(0, 0, 0.5), 0.5);
    assert.equal(adjustedWinRate(3, 3, 0.5), (3 + PRIOR_GAMES * 0.5) / (3 + PRIOR_GAMES));
    assert.ok(adjustedWinRate(9, 10, 0.5) > adjustedWinRate(3, 3, 0.5));
    assert.ok(adjustedWinRate(1, 10, 0.5) < adjustedWinRate(0, 3, 0.5));
  });
});

describe('matchups', () => {
  const vs = (name, result) => game({ opponent_brought: [name], result });
  const record = (name, wins, losses) => [
    ...Array(wins).fill(0).map(() => vs(name, 'win')),
    ...Array(losses).fill(0).map(() => vs(name, 'loss')),
  ];

  it(`needs ${MIN_MATCHUP_GAMES}+ games against a Pokémon, and splits around your overall win rate`, () => {
    // 4 wins in 7 games overall.
    const { best, worst, mostFaced, baseline } = matchups([...record('Incineroar', 3, 0), ...record('Sneasler', 1, 2), vs('Kingambit', 'loss')]);
    assert.equal(baseline, 4 / 7);
    assert.deepEqual(best.map(p => [p.name, p.wins, p.losses, p.winRate]), [['Incineroar', 3, 0, 1]]);
    assert.deepEqual(worst.map(p => [p.name, p.wins, p.losses]), [['Sneasler', 1, 2]]);
    assert.deepEqual(mostFaced.map(p => p.name), ['Incineroar', 'Sneasler']);
  });

  it('ranks a big sample above a small perfect one', () => {
    // 13-13 overall. A 3-0 and 0-3 are mostly luck next to 9-1 and 1-9.
    const { best, worst } = matchups([...record('A', 3, 0), ...record('B', 9, 1), ...record('C', 0, 3), ...record('D', 1, 9)]);
    assert.deepEqual(best.map(p => p.name), ['B', 'A']);
    assert.deepEqual(worst.map(p => p.name), ['D', 'C']);
  });

  it('never lists the same Pokémon as best and worst, nor one at exactly your average', () => {
    const { best, worst } = matchups([...record('A', 2, 2), ...record('B', 3, 1), ...record('C', 1, 3)]);
    assert.deepEqual([best.map(p => p.name), worst.map(p => p.name)], [['B'], ['C']]);
  });

  it('is empty without enough data', () => {
    assert.deepEqual(matchups([]), { best: [], worst: [], mostFaced: [], baseline: 0 });
  });

  it(`lists up to ${TOP_COUNT} by default`, () => {
    const many = 'ABCDEFGHIJKL'.split('').flatMap((name, i) => record(name, i % 2 ? 3 : 0, i % 2 ? 0 : 3));
    const { best, worst, mostFaced } = matchups(many);
    assert.deepEqual([best.length, worst.length, mostFaced.length], [TOP_COUNT, TOP_COUNT, TOP_COUNT]);
  });
});

describe('attendance', () => {
  const team = ['A', 'B', 'C', 'D', 'E', 'F'];
  const battles = [
    game({ team, brought: ['A', 'B', 'C', 'D'] }),
    game({ team, brought: ['A', 'B', 'C', 'E'] }),
    game({ team, brought: ['A', 'B', 'D', 'E'] }),
  ];

  it('ranks every team member, and lists the highest and lowest without overlap', () => {
    assert.deepEqual(attendance(battles).all.map(p => p.name), ['A', 'B', 'C', 'D', 'E', 'F']);
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

describe('toSlices', () => {
  const totals = (obj) => new Map(Object.entries(obj));

  it('orders by uses with shares', () => {
    const { total, slices } = toSlices(totals({ 'Fake Out': 2, Protect: 4 }));
    assert.equal(total, 6);
    assert.deepEqual(slices.map(s => [s.name, s.count, s.share]), [['Protect', 4, 4 / 6], ['Fake Out', 2, 2 / 6]]);
  });

  it('folds the tail into "Other" past the top moves, but never a single leftover', () => {
    const many = totals(Object.fromEntries('ABCDEFGH'.split('').map((m, i) => [m, 8 - i])));
    const { slices } = toSlices(many, 5);
    assert.equal(slices.length, 6);
    assert.deepEqual(slices.at(-1).name, 'Other');
    assert.equal(slices.at(-1).count, 3 + 2 + 1);
    assert.equal(toSlices(totals({ A: 1, B: 1, C: 1, D: 1, E: 1, F: 1 }), 5).slices.some(s => s.other), false);
  });

  it('handles nothing', () => {
    assert.deepEqual(toSlices(new Map()), { total: 0, slices: [] });
  });
});

describe('movesByPokemon', () => {
  const battles = [
    game({ moves: { Rillaboom: { 'Fake Out': 1, 'Grassy Glide': 2 }, Incineroar: { 'Fake Out': 1 } } }),
    game({ moves: { Rillaboom: { 'Fake Out': 1 }, Sneasler: { 'Close Combat': 3 } } }),
  ];

  it('totals each Pokémon\'s moves separately', () => {
    const rilla = movesByPokemon(battles).find(p => p.species === 'Rillaboom');
    assert.equal(rilla.total, 4);
    assert.deepEqual(rilla.slices.map(s => [s.name, s.count]), [['Fake Out', 2], ['Grassy Glide', 2]]);
  });

  it('follows the team order, then most used', () => {
    assert.deepEqual(movesByPokemon(battles, ['Incineroar', 'Rillaboom']).map(p => p.species), ['Incineroar', 'Rillaboom', 'Sneasler']);
    assert.deepEqual(movesByPokemon(battles).map(p => p.species), ['Rillaboom', 'Sneasler', 'Incineroar']);
  });

  it('ignores the older per-player shape and junk counts', () => {
    const legacy = [game({ moves: { Protect: 3 } }), game({ moves: { Rillaboom: { Protect: 'x' } } }), game({ moves: null })];
    assert.deepEqual(movesByPokemon(legacy), []);
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
