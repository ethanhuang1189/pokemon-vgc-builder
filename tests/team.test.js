import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatFor, slotWith, moveSlots, regMB } from './helpers.js';
import {
  TEAM_SIZE, makeEmptyTeam, serializeTeam, deserializeTeam, reorderTeam, teamFromSlots,
} from '../src/domain/team.js';
import { makeEmptySlot } from '../src/domain/slot.js';

const format = formatFor();

const sampleTeam = () => teamFromSlots([
  slotWith('Rillaboom', { item: 'Miracle Seed', nature: 'Adamant', moves: moveSlots('Fake Out', 'Wood Hammer'), evs: { hp: 32, atk: 32, def: 2, spa: 0, spd: 0, spe: 0 } }),
  slotWith('Charizard-Mega-Y', { item: 'Charizardite Y', ability: 'Drought', nickname: 'Sunny' }),
]);

describe('serialize / deserialize', () => {
  it('round-trips a team', () => {
    const team = sampleTeam();
    const restored = deserializeTeam(JSON.parse(JSON.stringify(serializeTeam(team))), format);
    assert.equal(restored.length, TEAM_SIZE);
    assert.equal(restored[0].species, team[0].species);
    assert.deepEqual(restored[0].moves.map(m => m?.name ?? null), ['Fake Out', 'Wood Hammer', null, null]);
    assert.deepEqual(restored[0].evs, team[0].evs);
    assert.equal(restored[1].species.name, 'Charizard-Mega-Y');
    assert.equal(restored[1].nickname, 'Sunny');
    assert.equal(restored[2].species, null);
  });

  it('stores species and moves by name only', () => {
    const [first] = serializeTeam(sampleTeam());
    assert.equal(first.species, 'Rillaboom');
    assert.deepEqual(first.moves, ['Fake Out', 'Wood Hammer', null, null]);
  });

  it('returns an empty team for non-array data', () => {
    for (const raw of [null, undefined, 'team', 42, {}]) {
      assert.deepEqual(deserializeTeam(raw, format), makeEmptyTeam(), String(raw));
    }
  });

  it('pads short saves and truncates long ones to six slots', () => {
    assert.equal(deserializeTeam([{ species: 'Rillaboom' }], format).length, TEAM_SIZE);
    const long = Array.from({ length: 9 }, () => ({ species: 'Rillaboom' }));
    assert.equal(deserializeTeam(long, format).length, TEAM_SIZE);
  });

  it('turns corrupt slots into empty ones', () => {
    const restored = deserializeTeam([null, 'x', 7, { species: 'Notamon' }, {}], format);
    assert.ok(restored.every(slot => slot.species === null));
  });

  it('drops species that are not legal in the format', () => {
    const regB = formatFor(regMB);
    const restored = deserializeTeam([{ species: 'Salamence' }, { species: 'Gengar' }], regB);
    assert.equal(restored[0].species, null);
    assert.equal(restored[1].species.name, 'Gengar');
  });

  it('sanitizes every field', () => {
    const [slot] = deserializeTeam([{
      species: 'Rillaboom', item: 'Choice Band', ability: 'Levitate', nature: 'Silly', nickname: 42,
      moves: ['Fake Out', 'Not A Move', null, 'Grassy Glide', 'Protect'],
      evs: { hp: 252, atk: 252, def: -4, spa: 'x' },
    }], format);
    assert.equal(slot.item, null); // Choice Band isn't legal
    assert.equal(slot.ability, 'Overgrow');
    assert.equal(slot.nature, 'Hardy');
    assert.equal(slot.nickname, '');
    assert.deepEqual(slot.moves.map(m => m?.name ?? null), ['Fake Out', null, null, 'Grassy Glide']);
    assert.deepEqual(slot.evs, { hp: 32, atk: 32, def: 0, spa: 0, spd: 0, spe: 0 });
  });

  it('restores saved Gigantamax formes as the regular forme, keeping the build', () => {
    const [slot] = deserializeTeam([{ species: 'Charizard-Gmax', item: 'Life Orb', moves: ['Flamethrower'] }], format);
    assert.equal(slot.species.name, 'Charizard');
    assert.equal(slot.item, 'Life Orb');
    assert.equal(slot.moves[0].name, 'Flamethrower');
  });

  it('migrates old saves: legacy megaFormId and old Meowstic mega names', () => {
    const restored = deserializeTeam([
      { species: 'Absol', megaFormId: 'absolmega' },
      { species: 'Meowstic-Mega-Female' },
      { species: 'Raichu', megaFormId: 'raichuxmega' }, // unresolvable id → keep the base species
    ], format);
    assert.equal(restored[0].species.name, 'Absol-Mega');
    assert.equal(restored[1].species.name, 'Meowstic-F-Mega');
    assert.equal(restored[2].species.name, 'Raichu');
  });
});

describe('reorderTeam', () => {
  const team = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('moves a slot down or up, shifting the others', () => {
    assert.deepEqual(reorderTeam(team, 0, 2), ['b', 'c', 'a', 'd', 'e', 'f']);
    assert.deepEqual(reorderTeam(team, 5, 0), ['f', 'a', 'b', 'c', 'd', 'e']);
  });

  it('returns the same array for no-ops and invalid indexes', () => {
    for (const [from, to] of [[2, 2], [-1, 2], [0, 6], [1.5, 2], [undefined, 1]]) {
      assert.equal(reorderTeam(team, from, to), team, `${from}→${to}`);
    }
  });

  it('does not mutate the input', () => {
    const copy = [...team];
    reorderTeam(team, 0, 5);
    assert.deepEqual(team, copy);
  });
});

describe('teamFromSlots', () => {
  it('fills from the start and pads with empty slots', () => {
    const team = teamFromSlots([slotWith('Rillaboom')]);
    assert.equal(team.length, TEAM_SIZE);
    assert.equal(team[0].species.name, 'Rillaboom');
    assert.deepEqual(team[5], makeEmptySlot());
  });

  it('keeps only the first six', () => {
    const many = Array.from({ length: 8 }, () => slotWith('Rillaboom'));
    assert.equal(teamFromSlots(many).length, TEAM_SIZE);
  });

  it('handles no slots', () => {
    assert.deepEqual(teamFromSlots([]), makeEmptyTeam());
  });
});
