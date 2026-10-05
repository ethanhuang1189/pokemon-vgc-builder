import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAMPIONS, NATURES, findNature, isNature, natureEffect, emptyEvs, totalEvs, setEv, sanitizeEvs, calcStat, applyNatureChoice,
} from '../src/domain/stats.js';

describe('natures', () => {
  it('has all 25 natures, 5 of them neutral', () => {
    assert.equal(Object.keys(NATURES).length, 25);
    assert.equal(Object.values(NATURES).filter(n => !n.plus).length, 5);
  });

  it('findNature maps every +/− pair to exactly one nature', () => {
    for (const [name, { plus, minus }] of Object.entries(NATURES)) {
      if (plus) assert.equal(findNature(plus, minus), name);
    }
  });

  it('findNature is neutral (Hardy) for incomplete or same-stat pairs', () => {
    assert.equal(findNature(null, null), 'Hardy');
    assert.equal(findNature('atk', null), 'Hardy');
    assert.equal(findNature(undefined, 'spe'), 'Hardy');
    assert.equal(findNature('atk', 'atk'), 'Hardy');
  });

  it('isNature rejects unknown names and inherited object keys', () => {
    assert.ok(isNature('Adamant'));
    for (const bad of ['adamant', '', null, undefined, 'toString', 'constructor']) assert.equal(isNature(bad), false, String(bad));
  });

  it('natureEffect of an unknown nature is neutral', () => {
    assert.deepEqual(natureEffect('Nope'), {});
  });
});

describe('EV budget', () => {
  it('totals EVs, treating junk values as 0', () => {
    assert.equal(totalEvs({ hp: 10, atk: '5', def: 'x', spa: -3, spd: null, spe: 2.9 }), 17);
    assert.equal(totalEvs(undefined), 0);
  });

  it('setEv caps a single stat at MAX_EV', () => {
    assert.equal(setEv(emptyEvs(), 'atk', 99).atk, CHAMPIONS.MAX_EV);
  });

  it('setEv caps at what the total budget has left', () => {
    const evs = { ...emptyEvs(), hp: 32, atk: 32 }; // 64 of 66 used
    assert.equal(setEv(evs, 'spe', 32).spe, 2);
  });

  it('setEv counts the stat being edited as available budget', () => {
    const evs = { ...emptyEvs(), hp: 32, atk: 32, spe: 2 };
    assert.equal(setEv(evs, 'atk', 20).atk, 20);
    assert.equal(setEv(evs, 'atk', 32).atk, 32);
  });

  it('setEv clamps negatives, NaN and fractions', () => {
    assert.equal(setEv(emptyEvs(), 'hp', -5).hp, 0);
    assert.equal(setEv(emptyEvs(), 'hp', 'abc').hp, 0);
    assert.equal(setEv(emptyEvs(), 'hp', 7.8).hp, 7);
  });

  it('setEv ignores unknown stats and never mutates', () => {
    const evs = emptyEvs();
    assert.equal(setEv(evs, 'luck', 5), evs);
    setEv(evs, 'hp', 5);
    assert.equal(evs.hp, 0);
  });

  it('setEv handles an over-budget spread without going negative', () => {
    const over = { ...emptyEvs(), hp: 40, atk: 40 };
    assert.equal(setEv(over, 'spe', 10).spe, 0);
  });

  it('sanitizeEvs turns any input into a legal spread', () => {
    assert.deepEqual(sanitizeEvs(null), emptyEvs());
    const evs = sanitizeEvs({ hp: 252, atk: 252, def: 252, spa: 'x', extra: 9 });
    assert.deepEqual(evs, { hp: 32, atk: 32, def: 2, spa: 0, spd: 0, spe: 0 });
    assert.equal(totalEvs(evs), CHAMPIONS.MAX_TOTAL_EV);
  });
});

describe('calcStat (level 50, +15 base buff)', () => {
  // Charizard: 78 HP / 84 Atk / 109 SpA / 100 Spe
  it('computes HP', () => {
    assert.equal(calcStat('hp', 78, 0), 153);
    assert.equal(calcStat('hp', 78, 32), 185);
  });

  it('computes other stats with nature multipliers', () => {
    assert.equal(calcStat('spa', 109, 0), 129);
    assert.equal(calcStat('spa', 109, 32, 'spa', 'atk'), 177);
    assert.equal(calcStat('atk', 84, 0, 'spa', 'atk'), 93);
  });

  it('nature only affects its own stats, and never HP', () => {
    assert.equal(calcStat('spe', 100, 0, 'spa', 'atk'), calcStat('spe', 100, 0));
    assert.equal(calcStat('hp', 78, 0, 'hp', null), calcStat('hp', 78, 0));
  });

  it('returns 0 without a base stat', () => {
    assert.equal(calcStat('atk', 0, 32), 0);
    assert.equal(calcStat('atk', undefined, 32), 0);
  });
});

describe('applyNatureChoice', () => {
  const neutral = { plus: null, minus: null };

  it('one side only stays pending (no nature committed)', () => {
    assert.deepEqual(applyNatureChoice(neutral, 'atk', 'plus'), { plus: 'atk', minus: null, nature: null });
  });

  it('commits once both sides are chosen', () => {
    const half = applyNatureChoice(neutral, 'atk', 'plus');
    assert.equal(applyNatureChoice(half, 'spa', 'minus').nature, 'Adamant');
  });

  it('moving a stat from + to − clears its + side', () => {
    const adamant = { plus: 'atk', minus: 'spa' };
    assert.deepEqual(applyNatureChoice(adamant, 'spa', 'plus'), { plus: 'spa', minus: null, nature: null });
  });

  it('centering a stat clears its effect; centering both commits neutral', () => {
    const adamant = { plus: 'atk', minus: 'spa' };
    const half = applyNatureChoice(adamant, 'atk', null);
    assert.equal(half.nature, null);
    assert.equal(applyNatureChoice(half, 'spa', null).nature, 'Hardy');
  });

  it('centering an unaffected stat changes nothing', () => {
    assert.deepEqual(applyNatureChoice({ plus: 'atk', minus: 'spa' }, 'spe', null), { plus: 'atk', minus: 'spa', nature: 'Adamant' });
  });
});
