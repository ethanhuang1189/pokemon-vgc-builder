import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Dex, regMB, regMC } from './helpers.js';
import { defineRegulation, extendRegulation, diffRegulations, LIST_KEYS } from '../src/regulations/extend.js';
import { REGULATIONS, CURRENT_REGULATION, getRegulation } from '../src/regulations/index.js';
import { validateRegulation } from '../src/domain/format.js';
import { toId } from '../src/domain/ids.js';

const REG_C_NEW_POKEMON = [
  'Wigglytuff', 'Persian', 'Persian-Alola', 'Farfetch’d', 'Mr. Mime', 'Swalot', 'Salamence', 'Gogoat',
  'Golisopod', 'Rillaboom', 'Cinderace', 'Inteleon', 'Thievul', 'Toxtricity', 'Toxtricity-Low-Key',
  'Grapploct', 'Perrserker', 'Sirfetch’d', 'Pincurchin', 'Indeedee', 'Indeedee-F', 'Arboliva',
  'Squawkabilly', 'Squawkabilly-Blue', 'Squawkabilly-Yellow', 'Squawkabilly-White', 'Mabosstiff', 'Baxcalibur',
];
const REG_C_NEW_MEGAS = ['Absol-Mega-Z', 'Salamence-Mega', 'Garchomp-Mega-Z', 'Lucario-Mega-Z', 'Golisopod-Mega', 'Baxcalibur-Mega'];
const REG_C_NEW_ITEMS = [
  'Leek', 'Rocky Helmet', 'Air Balloon', 'Red Card', 'Binding Band', 'Eject Button', 'Normal Gem',
  'Salamencite', 'Terrain Extender', 'Electric Seed', 'Psychic Seed', 'Misty Seed', 'Grassy Seed',
  'Absolite Z', 'Garchompite Z', 'Lucarionite Z', 'Golisopite', 'Baxcalibrite',
];

const base = () => defineRegulation({ id: 'T-1', label: 'Test 1', pokemon: ['Pikachu', 'Raichu'], items: ['Leftovers'] });

describe('regulation data', () => {
  for (const regulation of Object.values(REGULATIONS)) {
    it(`${regulation.id} resolves completely against @pkmn/dex`, () => {
      assert.deepEqual(validateRegulation(regulation, Dex), []);
    });
  }

  it('the current regulation is M-C', () => {
    assert.equal(CURRENT_REGULATION, regMC);
  });

  it('M-C adds exactly the announced Pokémon, megas and items, and removes nothing', () => {
    const diff = diffRegulations(regMB, regMC);
    assert.deepEqual(new Set(diff.pokemon.added), new Set(REG_C_NEW_POKEMON));
    assert.deepEqual(new Set(diff.megas.added), new Set(REG_C_NEW_MEGAS));
    assert.deepEqual(new Set(diff.items.added), new Set(REG_C_NEW_ITEMS));
    assert.deepEqual(diff.moves.added, []);
    for (const key of LIST_KEYS) assert.deepEqual(diff[key].removed, [], `${key} removed`);
  });

  it('every legal mega has its stone and base species legal (stones and megas pair up)', () => {
    for (const regulation of [regMB, regMC]) {
      const items = new Set(regulation.items.map(toId));
      for (const mega of regulation.megas) {
        assert.ok(items.has(toId(Dex.species.get(mega).requiredItem)), `${regulation.id} ${mega}`);
      }
    }
  });

  it('regulations are frozen so nothing can edit them at runtime', () => {
    assert.ok(Object.isFrozen(regMC));
    assert.ok(Object.isFrozen(regMC.pokemon));
    assert.throws(() => { regMC.pokemon.push('Mew'); }, TypeError);
  });
});

describe('getRegulation', () => {
  it('finds regulations case-insensitively', () => {
    assert.equal(getRegulation('m-c'), regMC);
  });

  it('throws a helpful error for unknown ids', () => {
    assert.throws(() => getRegulation('Z-9'), /Unknown regulation "Z-9"\. Known: M-B, M-C/);
    assert.throws(() => getRegulation(undefined), /Unknown regulation/);
  });
});

describe('defineRegulation', () => {
  it('requires an id and a label', () => {
    assert.throws(() => defineRegulation({ label: 'x' }), /needs an id/);
    assert.throws(() => defineRegulation({ id: 'x' }), /needs an id/);
  });

  it('defaults missing lists to empty', () => {
    const reg = defineRegulation({ id: 'E', label: 'Empty' });
    for (const key of LIST_KEYS) assert.deepEqual(reg[key], []);
  });

  it('rejects duplicates, including spelling variants of the same name', () => {
    assert.throws(() => defineRegulation({ id: 'D', label: 'D', pokemon: ['Farfetch’d', "Farfetch'd"] }), /duplicate pokemon/);
  });

  it('rejects unknown list names (typos like "pokemons")', () => {
    assert.throws(() => defineRegulation({ id: 'U', label: 'U', pokemons: [] }), /unknown top-level list/);
  });
});

describe('extendRegulation', () => {
  it('adds and removes entries without touching the base', () => {
    const next = extendRegulation(base(), {
      id: 'T-2', label: 'Test 2',
      add: { pokemon: ['Pichu'], items: ['Life Orb'] },
      remove: { pokemon: ['Raichu'] },
    });
    assert.deepEqual([...next.pokemon], ['Pikachu', 'Pichu']);
    assert.deepEqual([...next.items], ['Leftovers', 'Life Orb']);
    assert.deepEqual([...base().pokemon], ['Pikachu', 'Raichu']);
  });

  it('rejects adding something already legal', () => {
    assert.throws(() => extendRegulation(base(), { id: 'T-2', label: 'x', add: { pokemon: ['pikachu'] } }), /already in T-1: pikachu/);
  });

  it('allows re-adding something removed in the same step (a swap)', () => {
    const next = extendRegulation(base(), { id: 'T-2', label: 'x', add: { pokemon: ['Raichu'] }, remove: { pokemon: ['Raichu'] } });
    assert.deepEqual([...next.pokemon], ['Pikachu', 'Raichu']);
  });

  it('rejects removing something that was never legal', () => {
    assert.throws(() => extendRegulation(base(), { id: 'T-2', label: 'x', remove: { items: ['Choice Band'] } }), /cannot remove items not in T-1/);
  });

  it('rejects unknown keys in add/remove', () => {
    assert.throws(() => extendRegulation(base(), { id: 'T-2', label: 'x', add: { mons: ['Mew'] } }), /unknown add list/);
    assert.throws(() => extendRegulation(base(), { id: 'T-2', label: 'x', remove: { mons: ['Mew'] } }), /unknown remove list/);
  });

  it('merges learnset additions without duplicating moves', () => {
    const withExtra = extendRegulation(base(), { id: 'T-2', label: 'x', learnsetAdditions: { pikachu: ['surf'] } });
    const again = extendRegulation(withExtra, { id: 'T-3', label: 'y', learnsetAdditions: { pikachu: ['surf', 'fly'], raichu: ['fly'] } });
    assert.deepEqual([...again.learnsetAdditions.pikachu], ['surf', 'fly']);
    assert.deepEqual([...again.learnsetAdditions.raichu], ['fly']);
  });

  it('chains: a regulation extended from an extension keeps everything', () => {
    const regD = extendRegulation(regMC, { id: 'M-D', label: 'D', add: { pokemon: ['Mew'] } });
    assert.equal(regD.pokemon.length, regMC.pokemon.length + 1);
    assert.deepEqual(regD.learnsetAdditions, regMC.learnsetAdditions);
  });
});

describe('validateRegulation edge cases', () => {
  it('reports unknown names in every list', () => {
    const reg = defineRegulation({ id: 'V', label: 'V', pokemon: ['Notamon'], megas: [], items: ['Fake Orb'], moves: ['Fake Move'] });
    assert.deepEqual(validateRegulation(reg, Dex), [
      'V: unknown pokemon "Notamon"',
      'V: unknown items "Fake Orb"',
      'V: unknown moves "Fake Move"',
    ]);
  });

  it('reports a mega without its stone, without its base, or a non-mega in the mega list', () => {
    const reg = defineRegulation({ id: 'V', label: 'V', pokemon: ['Gengar'], megas: ['Gengar-Mega', 'Absol-Mega', 'Pikachu'] });
    assert.deepEqual(validateRegulation(reg, Dex), [
      'V: Gengar-Mega is legal but its stone Gengarite is not',
      'V: Absol-Mega is legal but its stone Absolite is not',
      'V: Absol-Mega is legal but Absol is not',
      'V: "Pikachu" is not a mega forme',
    ]);
  });

  it('reports a legal stone whose mega is not legal', () => {
    const reg = defineRegulation({ id: 'V', label: 'V', pokemon: ['Gengar'], items: ['Gengarite'] });
    assert.deepEqual(validateRegulation(reg, Dex), ['V: stone Gengarite is legal but none of Gengar-Mega are']);
  });

  it('rejects Gigantamax / Dynamax formes, pointing at the forme to list instead', () => {
    const reg = defineRegulation({ id: 'V', label: 'V', pokemon: ['Charizard-Gmax', 'Toxtricity-Low-Key-Gmax'] });
    assert.deepEqual(validateRegulation(reg, Dex), [
      'V: "Charizard-Gmax" is a Dynamax forme; list Charizard instead',
      'V: "Toxtricity-Low-Key-Gmax" is a Dynamax forme; list Toxtricity-Low-Key instead',
    ]);
  });

  it('reports learnset additions for species outside the format', () => {
    const reg = defineRegulation({ id: 'V', label: 'V', pokemon: ['Gengar'], learnsetAdditions: { mew: ['surf'] } });
    assert.deepEqual(validateRegulation(reg, Dex), ['V: learnsetAdditions for unknown species "mew"']);
  });
});
