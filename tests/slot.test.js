import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatFor, slotWith, moveSlots } from './helpers.js';
import {
  makeEmptySlot, withSpecies, withItem, withMove, nextEmptyMoveIndex, defaultAbility, speciesHasAbility, MOVE_SLOTS,
} from '../src/domain/slot.js';

const format = formatFor();
const sp = (name) => format.getSpecies(name);
const item = (name) => format.getItem(name);

const builtCharizard = () => slotWith('Charizard', {
  nickname: 'Zard',
  item: 'Leftovers',
  nature: 'Timid',
  moves: moveSlots('Flamethrower', 'Air Slash'),
  evs: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 },
});

describe('makeEmptySlot', () => {
  it('creates independent slots (no shared arrays)', () => {
    const a = makeEmptySlot();
    const b = makeEmptySlot();
    a.moves[0] = 'x';
    a.evs.hp = 5;
    assert.equal(b.moves[0], null);
    assert.equal(b.evs.hp, 0);
    assert.equal(a.moves.length, MOVE_SLOTS);
  });
});

describe('withSpecies', () => {
  it('fills an empty slot with the species and its first ability', () => {
    const slot = withSpecies(makeEmptySlot(), sp('Salamence'), format);
    assert.equal(slot.species.name, 'Salamence');
    assert.equal(slot.ability, 'Intimidate');
    assert.equal(slot.item, null);
  });

  it('starts a blank build when switching to a different Pokémon, keeping the nickname', () => {
    const slot = withSpecies(builtCharizard(), sp('Rillaboom'), format);
    assert.equal(slot.species.name, 'Rillaboom');
    assert.deepEqual(slot.moves, [null, null, null, null]);
    assert.equal(slot.nature, 'Hardy');
    assert.equal(slot.evs.spa, 0);
    assert.equal(slot.item, null);
    assert.equal(slot.nickname, 'Zard');
  });

  it('keeps the build when switching formes of the same Pokémon', () => {
    const slot = withSpecies(slotWith('Toxtricity', { item: 'Life Orb', nature: 'Modest', moves: moveSlots('Sludge Bomb') }),
      sp('Toxtricity-Low-Key'), format);
    assert.equal(slot.species.name, 'Toxtricity-Low-Key');
    assert.equal(slot.item, 'Life Orb');
    assert.equal(slot.nature, 'Modest');
    assert.equal(slot.moves[0].name, 'Sludge Bomb');
  });

  it('picking a mega equips its stone and mega ability', () => {
    const slot = withSpecies(builtCharizard(), sp('Charizard-Mega-Y'), format);
    assert.equal(slot.item, 'Charizardite Y');
    assert.equal(slot.ability, 'Drought');
    assert.equal(slot.moves[0].name, 'Flamethrower');
  });

  it('switching from a mega back to its base drops the stone', () => {
    const mega = withSpecies(builtCharizard(), sp('Charizard-Mega-X'), format);
    const back = withSpecies(mega, sp('Charizard'), format);
    assert.equal(back.item, null);
    assert.equal(back.ability, 'Blaze');
  });

  it('null empties the slot but keeps the nickname', () => {
    const slot = withSpecies(builtCharizard(), null, format);
    assert.equal(slot.species, null);
    assert.equal(slot.item, null);
    assert.deepEqual(slot.moves, [null, null, null, null]);
    assert.equal(slot.nickname, 'Zard');
  });

  it('does not mutate the input slot', () => {
    const before = builtCharizard();
    const snapshot = JSON.stringify(before);
    withSpecies(before, sp('Salamence'), format);
    assert.equal(JSON.stringify(before), snapshot);
  });
});

describe('withItem', () => {
  it('a matching stone mega evolves the slot and sets the mega ability', () => {
    const slot = withItem(slotWith('Salamence'), item('Salamencite'), format);
    assert.equal(slot.species.name, 'Salamence-Mega');
    assert.equal(slot.item, 'Salamencite');
    assert.equal(slot.ability, 'Aerilate');
  });

  it('picks the right mega when a Pokémon has two stones (Absolite vs Absolite Z)', () => {
    assert.equal(withItem(slotWith('Absol'), item('Absolite'), format).species.name, 'Absol-Mega');
    assert.equal(withItem(slotWith('Absol'), item('Absolite Z'), format).species.name, 'Absol-Mega-Z');
  });

  it('swaps directly between a Pokémon\'s megas (X ↔ Y)', () => {
    const x = withItem(slotWith('Charizard'), item('Charizardite X'), format);
    const y = withItem(x, item('Charizardite Y'), format);
    assert.equal(y.species.name, 'Charizard-Mega-Y');
    assert.equal(y.ability, 'Drought');
  });

  it('a regular item reverts a mega to its base forme with a base ability', () => {
    const mega = withItem(slotWith('Garchomp'), item('Garchompite Z'), format);
    const slot = withItem(mega, item('Life Orb'), format);
    assert.equal(slot.species.name, 'Garchomp');
    assert.equal(slot.item, 'Life Orb');
    assert.ok(speciesHasAbility(slot.species, slot.ability), `${slot.ability} is a Garchomp ability`);
  });

  it('clearing the item reverts a mega', () => {
    const mega = withItem(slotWith('Golisopod'), item('Golisopite'), format);
    const slot = withItem(mega, null, format);
    assert.equal(slot.species.name, 'Golisopod');
    assert.equal(slot.item, null);
  });

  it('another Pokémon\'s stone is just held (no mega), and reverts a current mega', () => {
    const held = withItem(slotWith('Rillaboom'), item('Baxcalibrite'), format);
    assert.equal(held.species.name, 'Rillaboom');
    assert.equal(held.item, 'Baxcalibrite');

    const mega = withItem(slotWith('Lucario'), item('Lucarionite Z'), format);
    const wrong = withItem(mega, item('Absolite'), format);
    assert.equal(wrong.species.name, 'Lucario');
    assert.equal(wrong.item, 'Absolite');
  });

  it('keeps the ability when the species does not change', () => {
    const slot = withItem(slotWith('Salamence', { ability: 'Moxie' }), item('Leftovers'), format);
    assert.equal(slot.ability, 'Moxie');
  });

  it('works on an empty slot', () => {
    assert.equal(withItem(makeEmptySlot(), item('Leftovers'), format).item, 'Leftovers');
    assert.equal(withItem(makeEmptySlot(), null, format).item, null);
  });
});

describe('withMove / nextEmptyMoveIndex', () => {
  it('sets and clears one move slot', () => {
    const [surf] = moveSlots('Surf');
    const slot = withMove(makeEmptySlot(), 2, surf);
    assert.equal(slot.moves[2], surf);
    assert.equal(withMove(slot, 2, null).moves[2], null);
    assert.equal(withMove(slot, 2, undefined).moves[2], null);
  });

  it('ignores out-of-range indexes', () => {
    const slot = makeEmptySlot();
    assert.equal(withMove(slot, -1, moveSlots('Surf')[0]), slot);
    assert.equal(withMove(slot, 4, moveSlots('Surf')[0]), slot);
  });

  it('finds the next empty move after an index, or -1', () => {
    const filled = moveSlots('Surf', 'Ice Beam');
    assert.equal(nextEmptyMoveIndex(filled, 0), 2);
    assert.equal(nextEmptyMoveIndex(filled, 2), 3);
    assert.equal(nextEmptyMoveIndex(moveSlots('Surf', 'Ice Beam', 'Protect', 'Scald'), 0), -1);
    assert.equal(nextEmptyMoveIndex([null, null, null, null], 3), -1);
  });
});

describe('ability helpers', () => {
  it('defaultAbility handles missing species and empty ability tables', () => {
    assert.equal(defaultAbility(null), '');
    assert.equal(defaultAbility({ abilities: {} }), '');
    assert.equal(defaultAbility({ abilities: { 0: '', 1: 'Static' } }), 'Static');
  });

  it('speciesHasAbility checks every ability slot including hidden', () => {
    assert.ok(speciesHasAbility(sp('Rillaboom'), 'Grassy Surge'));
    assert.equal(speciesHasAbility(sp('Rillaboom'), 'Levitate'), false);
    assert.equal(speciesHasAbility(null, 'Levitate'), false);
  });
});
