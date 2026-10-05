import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Dex, slotWith, moveSlots } from './helpers.js';
import { makeEmptyTeam } from '../src/domain/team.js';
import {
  filledSlots, slotDisplayName, damagingMoves, getCoverage, getCoverageDetails, getWeaknessDetails,
  getTypeDetails, countByType, analyzeMetaList, resolveMetaEntries,
} from '../src/domain/analysis.js';
import { ALL_TYPES } from '../src/domain/typeChart.js';

const teamOf = (...slots) => [...slots, ...makeEmptyTeam()].slice(0, 6);

describe('team helpers', () => {
  it('filledSlots skips empty slots', () => {
    assert.equal(filledSlots(makeEmptyTeam()).length, 0);
    assert.equal(filledSlots(teamOf(slotWith('Rillaboom'))).length, 1);
  });

  it('slotDisplayName prefers the nickname', () => {
    assert.equal(slotDisplayName(slotWith('Rillaboom')), 'Rillaboom');
    assert.equal(slotDisplayName(slotWith('Rillaboom', { nickname: 'Drummer' })), 'Drummer');
  });

  it('damagingMoves drops status moves and applies -ate abilities', () => {
    const slot = slotWith('Salamence-Mega', { ability: 'Aerilate', moves: moveSlots('Double-Edge', 'Protect', 'Flamethrower') });
    assert.deepEqual(damagingMoves(slot).map(m => [m.move.name, m.type]), [['Double-Edge', 'Flying'], ['Flamethrower', 'Fire']]);
  });
});

describe('getCoverage', () => {
  it('an empty team covers nothing', () => {
    const { covered, uncovered, attackTypes } = getCoverage(makeEmptyTeam());
    assert.equal(covered.size, 0);
    assert.equal(uncovered.size, ALL_TYPES.length);
    assert.equal(attackTypes.size, 0);
  });

  it('status moves give no coverage', () => {
    assert.equal(getCoverage(teamOf(slotWith('Indeedee-F', { moves: moveSlots('Follow Me', 'Protect') }))).covered.size, 0);
  });

  it('covered and uncovered partition all types', () => {
    const team = teamOf(slotWith('Rillaboom', { moves: moveSlots('Wood Hammer', 'Knock Off') }));
    const { covered, uncovered } = getCoverage(team);
    assert.equal(covered.size + uncovered.size, ALL_TYPES.length);
    assert.ok(covered.has('Water') && covered.has('Ghost'));
    assert.ok(uncovered.has('Fire'));
  });

  it('ignores moves left on an empty slot', () => {
    const ghost = { ...makeEmptyTeam()[0], moves: moveSlots('Surf') };
    assert.equal(getCoverage(teamOf(ghost)).covered.size, 0);
  });
});

describe('detail maps', () => {
  it('coverage details list each Pokémon/move once per type', () => {
    const slot = slotWith('Inteleon', { moves: moveSlots('Surf', 'Surf', 'Ice Beam') });
    const details = getCoverageDetails(teamOf(slot));
    assert.deepEqual(details.Fire, [{ pokeName: 'Inteleon', moveName: 'Surf', moveType: 'Water' }]);
    assert.equal(details.Dragon.length, 1);
  });

  it('weakness details respect abilities and show multipliers', () => {
    const details = getWeaknessDetails(teamOf(slotWith('Salamence'), slotWith('Golisopod')));
    assert.deepEqual(details.Ice.map(d => [d.pokeName, d.eff]), [['Salamence', 4]]);
    assert.equal(countByType(details).Rock, 2);
    assert.equal(countByType(details).Fire, undefined);
    assert.equal(countByType(details).Ground, undefined); // Salamence is immune
  });

  it('type details group members by shared type', () => {
    const counts = countByType(getTypeDetails(teamOf(slotWith('Salamence'), slotWith('Baxcalibur'), slotWith('Garchomp'))));
    assert.deepEqual(counts, { Dragon: 3, Flying: 1, Ice: 1, Ground: 1 });
  });

  it('countByType of nothing is empty', () => {
    assert.deepEqual(countByType({}), {});
  });
});

describe('analyzeMetaList', () => {
  const meta = [{ name: 'Salamence', usage: 20, types: ['Dragon', 'Flying'] }];

  it('finds covering moves (with ×4 noted) and STAB threats', () => {
    const team = teamOf(
      slotWith('Baxcalibur', { moves: moveSlots('Icicle Crash') }),
      slotWith('Rillaboom', { moves: moveSlots('Wood Hammer') }),
    );
    const [result] = analyzeMetaList(team, meta);
    assert.equal(result.covered, true);
    assert.deepEqual(result.coveringMoves.map(m => [m.pokeName, m.eff]), [['Baxcalibur', 4]]);
    assert.deepEqual(result.threatened.map(t => [t.pokeName, t.via]), [['Baxcalibur', 'Dragon'], ['Rillaboom', 'Flying']]);
  });

  it('an empty team covers nothing and is threatened by nothing', () => {
    const [result] = analyzeMetaList(makeEmptyTeam(), meta);
    assert.equal(result.covered, false);
    assert.deepEqual(result.threatened, []);
    assert.equal(result.usage, 20);
  });

  it('an empty meta list yields an empty analysis', () => {
    assert.deepEqual(analyzeMetaList(makeEmptyTeam(), []), []);
  });
});

describe('resolveMetaEntries', () => {
  it('attaches types and keeps entry data, resolving formes by slug', () => {
    const [entry] = resolveMetaEntries([{ name: 'Indeedee', slug: 'Indeedee-F', usage: 20.25 }], Dex);
    assert.deepEqual(entry.types, ['Psychic', 'Normal']);
    assert.equal(entry.usage, 20.25);
  });

  it('drops names the dex cannot resolve and respects the limit', () => {
    const entries = [{ name: 'Notamon', usage: 50 }, { name: 'Rillaboom', usage: 40 }, { name: 'Sneasler', usage: 30 }];
    assert.deepEqual(resolveMetaEntries(entries, Dex).map(e => e.name), ['Rillaboom', 'Sneasler']);
    assert.deepEqual(resolveMetaEntries(entries, Dex, 2).map(e => e.name), ['Rillaboom']);
  });

  it('handles missing data', () => {
    assert.deepEqual(resolveMetaEntries(undefined, Dex), []);
    assert.deepEqual(resolveMetaEntries([], Dex), []);
  });
});
