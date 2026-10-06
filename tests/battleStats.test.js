import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeBattles, formatsIn, formatPercent } from '../src/domain/battleStats.js';

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
