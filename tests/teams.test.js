import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePokepasteId, speciesFromPaste, organizeBattles } from '../src/domain/teams.js';

describe('parsePokepasteId', () => {
  it('accepts PokéPaste links in their usual forms', () => {
    for (const input of [
      'https://pokepast.es/5c46f9ec443664cb',
      'pokepast.es/5c46f9ec443664cb',
      'https://www.pokepast.es/5c46f9ec443664cb/',
      'https://pokepast.es/5C46F9EC443664CB/raw',
      '  https://pokepast.es/5c46f9ec443664cb/json  ',
    ]) {
      assert.equal(parsePokepasteId(input), '5c46f9ec443664cb', input);
    }
  });

  it('rejects other sites, other paths and non-hex ids', () => {
    for (const input of [
      'https://pokepast.es.evil.example/5c46f9ec443664cb',
      'https://evil.example/pokepast.es/5c46f9ec443664cb',
      'https://pokepast.es/5c46f9ec443664cb/../admin',
      'https://pokepast.es/create',
      'https://pokepast.es/xyz',
      'Rillaboom @ Miracle Seed',
      '', null,
    ]) {
      assert.equal(parsePokepasteId(input), null, String(input));
    }
  });
});

describe('speciesFromPaste', () => {
  const paste = [
    'Drummer (Rillaboom) (F) @ Miracle Seed\nAbility: Grassy Surge\n- Fake Out',
    'Incineroar @ Sitrus Berry\nAbility: Intimidate',
    'Charizard-Mega-Y @ Charizardite Y',
    'Indeedee-F @ Psychic Seed',
  ].join('\r\n\r\n');

  it('reads species, skipping nicknames, gender and items, with megas as their base', () => {
    assert.deepEqual(speciesFromPaste(paste), ['Rillaboom', 'Incineroar', 'Charizard', 'Indeedee-F']);
  });

  it('stops at six and handles empty input', () => {
    assert.equal(speciesFromPaste(Array(8).fill('Rillaboom').join('\n\n')).length, 6);
    assert.deepEqual(speciesFromPaste(''), []);
    assert.deepEqual(speciesFromPaste(null), []);
  });
});

describe('organizeBattles', () => {
  const A = ['Rillaboom', 'Incineroar', 'Salamence', 'Sneasler', 'Garchomp', 'Gholdengo'];
  const B = [...A.slice(0, 5), 'Kingambit'];
  const teams = [
    { id: 1, name: 'Sun v1', species: A, created_at: '2026-10-01T00:00:00Z' },
    { id: 2, name: 'Sun v2', species: B, created_at: '2026-10-03T00:00:00Z' },
  ];
  const periods = [
    { team_id: 1, started_at: '2026-10-01T00:00:00Z' },
    { team_id: 2, started_at: '2026-10-03T00:00:00Z' },
  ];
  let id = 0;
  const game = (played_at, team = A, extra = {}) => ({ id: ++id, played_at, team, result: 'win', brought: team.slice(0, 4), opponent_brought: [], ...extra });

  it('puts games in the team that was current when they were played', () => {
    const { current, older } = organizeBattles(
      [game('2026-10-04T10:00:00Z', B), game('2026-10-02T10:00:00Z', A), game('2026-10-01T05:00:00Z', A)],
      teams, periods,
    );
    assert.equal(current.saved.name, 'Sun v2');
    assert.equal(current.record.games, 1);
    assert.equal(older[0].saved.name, 'Sun v1');
    assert.equal(older[0].record.games, 2);
  });

  it('counts every game played while a team is current, even with a different six', () => {
    const { current } = organizeBattles([game('2026-10-05T00:00:00Z', ['Pikachu'])], teams, periods);
    assert.equal(current.record.games, 1);
  });

  it('groups games from before any saved team by their exact six Pokémon', () => {
    const { iterations } = organizeBattles(
      [game('2026-09-01T00:00:00Z', A), game('2026-09-02T00:00:00Z', [...A].reverse()), game('2026-09-03T00:00:00Z', B)],
      teams, periods,
    );
    assert.deepEqual(iterations.map(g => g.record.games).sort(), [1, 2]);
  });

  it('lets a moved game override the date rule', () => {
    const { current, older } = organizeBattles([game('2026-10-05T00:00:00Z', A, { team_id: 1 })], teams, periods);
    assert.equal(current.record.games, 0);
    assert.equal(older[0].record.games, 1);
  });

  it('ignores a move to a team that no longer exists', () => {
    const { current } = organizeBattles([game('2026-10-05T00:00:00Z', A, { team_id: 99 })], teams, periods);
    assert.equal(current.record.games, 1);
  });

  it('making an old team current again continues its record', () => {
    const backToV1 = [...periods, { team_id: 1, started_at: '2026-10-06T00:00:00Z' }];
    const { current, older } = organizeBattles(
      [game('2026-10-02T00:00:00Z'), game('2026-10-04T00:00:00Z', B), game('2026-10-07T00:00:00Z')],
      teams, backToV1,
    );
    assert.equal(current.saved.name, 'Sun v1');
    assert.equal(current.record.games, 2);
    assert.equal(older[0].record.games, 1);
  });

  it('keeps saved teams with no games, and orders older teams by most recent use', () => {
    const three = [...teams, { id: 3, name: 'Rain', species: B, created_at: '2026-10-02T00:00:00Z' }];
    const { older } = organizeBattles([], three, periods);
    assert.deepEqual(older.map(g => g.saved.name), ['Rain', 'Sun v1']);
    assert.equal(older[0].record.games, 0);
  });

  it('with no saved teams, everything is an iteration and there is no current team', () => {
    const result = organizeBattles([game('2026-10-01T00:00:00Z')], [], []);
    assert.equal(result.current, null);
    assert.deepEqual(result.older, []);
    assert.equal(result.iterations.length, 1);
  });

  it('ignores history rows for deleted teams', () => {
    const { current } = organizeBattles([game('2026-10-05T00:00:00Z')], [teams[0]], periods);
    assert.equal(current.saved.name, 'Sun v1');
    assert.equal(current.record.games, 1);
  });

  it('compares dates as times, whatever their precision', () => {
    const { current, older } = organizeBattles(
      [game('2026-10-03T00:00:00.5+00:00', B), game('2026-10-02T23:59:59+00:00', A)],
      teams, [{ team_id: 1, started_at: '2026-10-01T00:00:00+00:00' }, { team_id: 2, started_at: '2026-10-03T00:00:00.123456+00:00' }],
    );
    assert.equal(current.record.games, 1);
    assert.equal(older[0].record.games, 1);
  });
});
