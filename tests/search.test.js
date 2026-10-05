import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatFor } from './helpers.js';
import { parseResistQuery, filterSpecies, filterMoves, filterByText, typesIn } from '../src/domain/search.js';
import { nearestIndex, dragOffset } from '../src/utils/dragMath.js';

const format = formatFor();
const names = (list) => list.map(e => e.name);

describe('parseResistQuery', () => {
  it('returns null for normal queries', () => {
    assert.equal(parseResistQuery('salamence'), null);
    assert.equal(parseResistQuery(''), null);
    assert.equal(parseResistQuery(undefined), null);
  });

  it('parses type names by prefix, case-insensitively, ignoring junk and duplicates', () => {
    assert.deepEqual(parseResistQuery('Resist: fi WAT zzz fire'), ['Fire', 'Water']);
    assert.deepEqual(parseResistQuery('resist:'), []);
    assert.deepEqual(parseResistQuery('  resist:ground  '), ['Ground']);
  });
});

describe('filterSpecies', () => {
  it('matches names case-insensitively', () => {
    assert.deepEqual(names(filterSpecies(format.species, { query: 'SQUAWK' })),
      ['Squawkabilly', 'Squawkabilly-Blue', 'Squawkabilly-White', 'Squawkabilly-Yellow']);
  });

  it('requires every selected type', () => {
    const result = filterSpecies(format.species, { types: ['Dragon', 'Ice'] });
    assert.ok(result.length > 0);
    assert.ok(result.every(s => s.types.includes('Dragon') && s.types.includes('Ice')));
    assert.ok(names(result).includes('Baxcalibur'));
  });

  it('filters by learners of a move (null = index not ready, so no filter)', () => {
    assert.deepEqual(names(filterSpecies(format.species, { learnerIds: new Set(['rillaboom']) })), ['Rillaboom']);
    assert.equal(filterSpecies(format.species, { learnerIds: null }).length, format.species.length);
    assert.deepEqual(filterSpecies(format.species, { learnerIds: new Set() }), []);
  });

  it('filters by ability, including hidden abilities', () => {
    assert.ok(names(filterSpecies(format.species, { ability: 'Grassy Surge' })).includes('Rillaboom'));
  });

  it('resist mode ignores the other filters', () => {
    const result = filterSpecies(format.species, { query: 'resist: ground', types: ['Water'], ability: 'Levitate' });
    assert.deepEqual(result, filterSpecies(format.species, { query: 'resist: ground' }));
    assert.ok(names(result).includes('Salamence'));
    assert.equal(names(result).includes('Incineroar'), false);
  });

  it('resist mode with no types lists everything', () => {
    assert.equal(filterSpecies(format.species, { query: 'resist:' }).length, format.species.length);
  });

  it('no filters returns everything; impossible filters return nothing', () => {
    assert.equal(filterSpecies(format.species).length, format.species.length);
    assert.deepEqual(filterSpecies(format.species, { query: 'zzzz' }), []);
  });
});

describe('filterMoves / filterByText / typesIn', () => {
  it('combines text, type and category filters', () => {
    const result = filterMoves(format.moves, { query: 'punch', type: 'Fire', category: 'Physical' });
    assert.deepEqual(names(result), ['Fire Punch']);
  });

  it('searches names and short descriptions', () => {
    assert.ok(names(filterByText(format.items, 'terrain')).includes('Terrain Extender'));
    assert.ok(names(filterByText(format.items, 'electric terrain')).includes('Electric Seed'));
    assert.equal(filterByText(format.items, ''), format.items);
  });

  it('lists move types in canonical order', () => {
    const moves = ['Surf', 'Ember', 'Tackle'].map(format.getMove);
    assert.deepEqual(typesIn(moves), ['Normal', 'Fire', 'Water']);
    assert.deepEqual(typesIn([]), []);
  });
});

describe('drag reorder math', () => {
  const tops = [0, 60, 120, 180];
  const heights = [60, 60, 60, 60];

  it('finds the nearest slot to the dragged center', () => {
    assert.equal(nearestIndex(0, 0, tops, heights), 0);
    assert.equal(nearestIndex(0, 70, tops, heights), 1);
    assert.equal(nearestIndex(0, 500, tops, heights), 3);
    assert.equal(nearestIndex(3, -500, tops, heights), 0);
  });

  it('ignores unmeasured slots and stays put if the dragged one is unmeasured', () => {
    assert.equal(nearestIndex(0, 70, [0, undefined, 120], heights), 2);
    assert.equal(nearestIndex(1, 50, [], []), 1);
  });

  it('offsets the dragged slot by the pointer and shifts the slots it passes', () => {
    const drag = { fromIdx: 0, toIdx: 2, deltaY: 130, heights };
    assert.deepEqual([0, 1, 2, 3].map(i => dragOffset(i, drag)), [130, -60, -60, 0]);
    const up = { fromIdx: 3, toIdx: 1, deltaY: -130, heights };
    assert.deepEqual([0, 1, 2, 3].map(i => dragOffset(i, up)), [0, 60, 60, -130]);
    assert.equal(dragOffset(1, null), 0);
  });
});
