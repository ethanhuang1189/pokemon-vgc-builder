import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_TYPES, getEffectiveness, getEffectiveMoveType, resistsAll } from '../src/domain/typeChart.js';
import { formatFor } from './helpers.js';

const move = (name) => formatFor().getMove(name);

describe('getEffectiveness', () => {
  it('covers the basics: neutral, SE, resisted, immune', () => {
    assert.equal(getEffectiveness('Normal', ['Water']), 1);
    assert.equal(getEffectiveness('Water', ['Fire']), 2);
    assert.equal(getEffectiveness('Fire', ['Water']), 0.5);
    assert.equal(getEffectiveness('Normal', ['Ghost']), 0);
  });

  it('multiplies dual types (×4, ×0.25, cancel out)', () => {
    assert.equal(getEffectiveness('Ice', ['Dragon', 'Flying']), 4); // Salamence
    assert.equal(getEffectiveness('Fighting', ['Ghost', 'Fairy']), 0);
    assert.equal(getEffectiveness('Grass', ['Fire', 'Dragon']), 0.25);
    assert.equal(getEffectiveness('Fire', ['Grass', 'Water']), 1);
  });

  it('immunity in either type wins over a weakness in the other', () => {
    assert.equal(getEffectiveness('Ground', ['Electric', 'Flying']), 0);
  });

  it('ability immunities override the chart', () => {
    assert.equal(getEffectiveness('Ground', ['Electric'], 'Levitate'), 0);
    assert.equal(getEffectiveness('Water', ['Fire'], 'Water Absorb'), 0);
    assert.equal(getEffectiveness('Fire', ['Grass'], 'Flash Fire'), 0);
  });

  it('Thick Fat / Heatproof / Fluffy scale specific types', () => {
    assert.equal(getEffectiveness('Fire', ['Grass'], 'Thick Fat'), 1);
    assert.equal(getEffectiveness('Ice', ['Dragon', 'Flying'], 'Thick Fat'), 2);
    assert.equal(getEffectiveness('Fire', ['Steel'], 'Heatproof'), 1);
    assert.equal(getEffectiveness('Fire', ['Normal'], 'Fluffy'), 2);
    assert.equal(getEffectiveness('Water', ['Normal'], 'Thick Fat'), 1);
  });

  it('Filter / Solid Rock only reduce super-effective hits', () => {
    assert.equal(getEffectiveness('Water', ['Fire'], 'Filter'), 1.5);
    assert.equal(getEffectiveness('Ice', ['Dragon', 'Flying'], 'Solid Rock'), 3);
    assert.equal(getEffectiveness('Normal', ['Normal'], 'Filter'), 1);
    assert.equal(getEffectiveness('Fire', ['Water'], 'Prism Armor'), 0.5);
  });

  it('is neutral for missing inputs, unknown types and unknown abilities', () => {
    assert.equal(getEffectiveness(null, ['Fire']), 1);
    assert.equal(getEffectiveness('Fire', []), 1);
    assert.equal(getEffectiveness('Fire', undefined), 1);
    assert.equal(getEffectiveness('Fire', ['NotAType']), 1);
    assert.equal(getEffectiveness('Fire', ['Grass'], 'Made Up Ability'), 2);
  });

  it('every attacking type has a defined result against every type', () => {
    for (const atk of ALL_TYPES) for (const def of ALL_TYPES) {
      assert.ok([0, 0.5, 1, 2].includes(getEffectiveness(atk, [def])), `${atk} vs ${def}`);
    }
  });
});

describe('getEffectiveMoveType', () => {
  it('-ate abilities convert Normal moves only', () => {
    assert.equal(getEffectiveMoveType(move('Hyper Beam'), 'Aerilate'), 'Flying');
    assert.equal(getEffectiveMoveType(move('Double-Edge'), 'Pixilate'), 'Fairy');
    assert.equal(getEffectiveMoveType(move('Flamethrower'), 'Pixilate'), 'Fire');
  });

  it('Liquid Voice converts sound moves only', () => {
    assert.equal(getEffectiveMoveType(move('Sparkling Aria'), 'Liquid Voice'), 'Water');
    assert.equal(getEffectiveMoveType(move('Moonblast'), 'Liquid Voice'), 'Fairy');
  });

  it('Normalize converts everything', () => {
    assert.equal(getEffectiveMoveType(move('Thunderbolt'), 'Normalize'), 'Normal');
  });

  it('passes through without an ability, and handles a missing move', () => {
    assert.equal(getEffectiveMoveType(move('Surf'), null), 'Water');
    assert.equal(getEffectiveMoveType(move('Surf'), 'Intimidate'), 'Water');
    assert.equal(getEffectiveMoveType(null, 'Pixilate'), null);
  });
});

describe('resistsAll', () => {
  it('requires resisting (or being immune to) every type', () => {
    assert.ok(resistsAll(['Steel'], ['Normal', 'Dragon']));
    assert.ok(resistsAll(['Ghost'], ['Normal']));
    assert.equal(resistsAll(['Steel'], ['Fire']), false);
    assert.equal(resistsAll(['Water'], ['Water', 'Normal']), false);
  });

  it('is vacuously true with no types', () => {
    assert.ok(resistsAll(['Fire'], []));
  });
});
