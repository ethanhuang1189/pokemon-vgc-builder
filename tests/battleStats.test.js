import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeBattles, groupByTeam, formatsIn, formatPercent, formatRecord } from '../src/domain/battleStats.js';

const battle = (result, brought, opponent_brought, format = 'Reg M-C') => ({ result, brought, opponent_brought, format });

describe('summarizeBattles', () => {
  const battles = [
    battle('win', ['Rillaboom', 'Incineroar'], ['Salamence']),
    battle('loss', ['Rillaboom'], ['Salamence', 'Sneasler']),
    battle('tie', ['Incineroar'], ['Sneasler']),
    battle('win', ['Rillaboom'], ['Garchomp']),
  ];
  const summary = summarizeBattles(battles);

  it('counts the record; ties are games but not wins', () => {
    assert.deepEqual(summary.record, { games: 4, wins: 2, losses: 1, ties: 1, winRate: 0.5 });
  });

  it('tallies your Pokémon by games brought, most used first', () => {
    assert.deepEqual(summary.yourPokemon.map(p => [p.name, p.games, p.wins]), [['Rillaboom', 3, 2], ['Incineroar', 2, 1]]);
    assert.equal(summary.yourPokemon[0].winRate, 2 / 3);
  });

  it('tallies opponents\' Pokémon with your win rate against them', () => {
    const salamence = summary.opponentPokemon.find(p => p.name === 'Salamence');
    assert.deepEqual([salamence.games, salamence.wins, salamence.winRate], [2, 1, 0.5]);
  });

  it('breaks ties in usage by wins, then name', () => {
    const rows = summarizeBattles([battle('win', ['B'], []), battle('loss', ['A'], []), battle('loss', ['C'], [])]).yourPokemon;
    assert.deepEqual(rows.map(r => r.name), ['B', 'A', 'C']);
  });

  it('handles no battles and missing lists', () => {
    assert.deepEqual(summarizeBattles([]).record, { games: 0, wins: 0, losses: 0, ties: 0, winRate: 0 });
    assert.deepEqual(summarizeBattles([{ result: 'win' }]).yourPokemon, []);
  });
});

describe('helpers', () => {
  it('formatsIn keeps first-seen order without duplicates', () => {
    assert.deepEqual(formatsIn([battle('win', [], [], 'B'), battle('win', [], [], 'A'), battle('win', [], [], 'B')]), ['B', 'A']);
  });

  it('formatPercent rounds to whole percent', () => {
    assert.equal(formatPercent(2 / 3), '67%');
    assert.equal(formatPercent(0), '0%');
  });
});

describe('groupByTeam', () => {
  const TEAM_A = ['Rillaboom', 'Incineroar', 'Salamence', 'Sneasler', 'Garchomp', 'Gholdengo'];
  const TEAM_B = ['Basculegion', 'Pelipper', 'Archaludon', 'Sneasler', 'Kingambit', 'Farigiraf'];
  const game = (team, result, played_at) => ({ team, result, played_at, brought: team.slice(0, 4), opponent_brought: [] });

  it('groups by the six Pokémon regardless of preview order', () => {
    const groups = groupByTeam([
      game(TEAM_A, 'win', '2026-10-05'),
      game([...TEAM_A].reverse(), 'loss', '2026-10-04'),
      game(TEAM_B, 'win', '2026-10-03'),
    ]);
    assert.equal(groups.length, 2);
    assert.deepEqual(groups[0].record, { games: 2, wins: 1, losses: 1, ties: 0, winRate: 0.5 });
    assert.deepEqual(groups[0].species, TEAM_A); // order from the newest game
  });

  it('orders teams by most recent game', () => {
    const groups = groupByTeam([game(TEAM_A, 'win', '2026-10-01'), game(TEAM_B, 'win', '2026-10-06')]);
    assert.deepEqual(groups.map(g => g.lastPlayed), ['2026-10-06', '2026-10-01']);
  });

  it('treats a one-Pokémon change as a different team', () => {
    const changed = [...TEAM_A.slice(0, 5), 'Kingambit'];
    assert.equal(groupByTeam([game(TEAM_A, 'win', '2026-01-01'), game(changed, 'win', '2026-01-02')]).length, 2);
  });

  it('handles battles without a team, and no battles', () => {
    assert.equal(groupByTeam([{ result: 'win', played_at: '2026-01-01' }])[0].species.length, 0);
    assert.deepEqual(groupByTeam([]), []);
  });
});

describe('formatRecord', () => {
  it('shows ties only when there are some', () => {
    assert.equal(formatRecord({ wins: 3, losses: 1, ties: 0 }), '3-1');
    assert.equal(formatRecord({ wins: 3, losses: 1, ties: 2 }), '3-1-2');
  });
});
