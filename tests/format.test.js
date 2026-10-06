import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Dex, formatFor, regMB, regMC } from './helpers.js';
import { buildFormat, megaBaseName, isDynamaxForme } from '../src/domain/format.js';
import { defineRegulation } from '../src/regulations/extend.js';

const format = formatFor(regMC);
const names = (list) => list.map(e => e.name);

describe('buildFormat: species', () => {
  it('lists every regulation Pokémon and mega exactly once, sorted by name', () => {
    assert.equal(format.species.length, regMC.pokemon.length + regMC.megas.length);
    assert.equal(new Set(names(format.species)).size, format.species.length);
    assert.deepEqual(names(format.species), [...names(format.species)].sort((a, b) => a.localeCompare(b)));
  });

  it('includes the Reg C formes as separate entries', () => {
    for (const name of ['Persian-Alola', 'Toxtricity-Low-Key', 'Indeedee-F', 'Squawkabilly-Blue', 'Squawkabilly-Yellow', 'Squawkabilly-White']) {
      assert.ok(format.getSpecies(name), name);
    }
  });

  it('excludes cosmetic and Totem formes that the dex lists under legal species', () => {
    for (const name of ['Pikachu-Original', 'Vivillon-Polar', 'Alcremie-Ruby-Cream', 'Mimikyu-Totem', 'Greninja-Bond']) {
      assert.equal(format.getSpecies(name), null, name);
    }
  });

  it('never lists Gigantamax or Dynamax formes', () => {
    assert.deepEqual(format.species.filter(s => /Gmax|Eternamax/.test(s.forme)), []);
  });

  it('resolves a Gigantamax name to the forme it comes from (old saves, pastes)', () => {
    assert.equal(format.getSpecies('Charizard-Gmax')?.name, 'Charizard');
    assert.equal(format.getSpecies('Rillaboom-Gmax')?.name, 'Rillaboom');
    assert.equal(format.getSpecies('Toxtricity-Low-Key-Gmax')?.name, 'Toxtricity-Low-Key');
    assert.equal(format.getSpecies('Urshifu-Gmax'), null); // Urshifu itself isn't legal
  });

  it('does not list Reg C additions in Reg B', () => {
    const b = formatFor(regMB);
    for (const name of ['Salamence', 'Rillaboom', 'Absol-Mega-Z', 'Persian-Alola']) assert.equal(b.getSpecies(name), null, name);
  });

  it('gives megas their real dex types, abilities and stats (not the base forme)', () => {
    const raichuX = format.getSpecies('Raichu-Mega-X');
    assert.deepEqual([...raichuX.types], ['Electric']);
    assert.equal(raichuX.abilities[0], 'Surge Surfer');

    const meowsticF = format.getSpecies('Meowstic-F-Mega');
    assert.equal(meowsticF.abilities[0], 'Trace');
    assert.equal(meowsticF.baseSpeciesName, 'Meowstic-F');

    const absolZ = format.getSpecies('Absol-Mega-Z');
    assert.deepEqual([...absolZ.types], ['Dark', 'Ghost']);
    assert.notDeepEqual(absolZ.baseStats, format.getSpecies('Absol').baseStats);
  });

  it('links every mega to its base forme, stone and the base learnset', () => {
    for (const mega of format.megas) {
      assert.ok(mega.isMega);
      const base = format.getBaseOf(mega);
      assert.ok(base && !base.isMega, `${mega.name} base`);
      assert.equal(mega.num, base.num);
      assert.equal(mega.learnsetId, base.id);
      assert.ok(format.getItem(mega.megaStone), `${mega.name} stone`);
    }
  });

  it('treats non-megas as their own base', () => {
    const rillaboom = format.getSpecies('Rillaboom');
    assert.equal(rillaboom.isMega, false);
    assert.equal(rillaboom.megaStone, null);
    assert.equal(format.getBaseOf(rillaboom), rillaboom);
    assert.equal(format.getBaseOf(null), null);
  });

  it('records the forme index used for numbered sprites', () => {
    assert.equal(format.getSpecies('Squawkabilly').formeIndex, 0);
    assert.equal(format.getSpecies('Squawkabilly-White').formeIndex, 3);
    assert.equal(format.getSpecies('Persian-Alola').formeIndex, 1);
  });

  it('returns frozen entries', () => {
    assert.ok(Object.isFrozen(format.getSpecies('Salamence')));
    assert.ok(Object.isFrozen(format.getSpecies('Salamence').types));
  });
});

describe('buildFormat: lookups', () => {
  it('finds species by any spelling (case, punctuation, curly or straight apostrophes)', () => {
    for (const spelling of ["Farfetch'd", 'farfetch’d', 'FARFETCHD', 'farfetchd']) {
      assert.equal(format.getSpecies(spelling)?.name, 'Farfetch’d', spelling);
    }
    assert.equal(format.getSpecies('mr mime')?.name, 'Mr. Mime');
    assert.equal(format.getSpecies('Kommo o')?.name, 'Kommo-o');
  });

  it('resolves dex aliases', () => {
    assert.equal(format.getSpecies('Meowstic-M')?.name, 'Meowstic');
  });

  it('returns null for empty, unknown or illegal names', () => {
    for (const name of [null, undefined, '', 'Missingno', 'Mewtwo']) assert.equal(format.getSpecies(name), null, String(name));
    assert.equal(format.getItem('Choice Band'), null);
    assert.equal(format.getItem(null), null);
    assert.equal(format.getMove('Not A Move'), null);
    assert.equal(format.getAbility(''), null);
  });

  it('finds the mega a stone produces, only for the matching base forme', () => {
    const absol = format.getSpecies('Absol');
    assert.equal(format.getMegaFor(absol, 'Absolite')?.name, 'Absol-Mega');
    assert.equal(format.getMegaFor(absol, 'Absolite Z')?.name, 'Absol-Mega-Z');
    assert.equal(format.getMegaFor(absol, 'Garchompite'), null);
    assert.equal(format.getMegaFor(absol, 'Leftovers'), null);
    assert.equal(format.getMegaFor(null, 'Absolite'), null);
  });

  it('maps one stone to different megas by forme (Meowsticite)', () => {
    assert.equal(format.getMegaFor(format.getSpecies('Meowstic'), 'Meowsticite')?.name, 'Meowstic-M-Mega');
    assert.equal(format.getMegaFor(format.getSpecies('Meowstic-F'), 'Meowsticite')?.name, 'Meowstic-F-Mega');
  });

  it('lets plain Floette mega evolve (the dex says only Floette-Eternal can)', () => {
    assert.equal(format.getMegaFor(format.getSpecies('Floette'), 'Floettite')?.name, 'Floette-Mega');
  });
});

describe('displaySpecies', () => {
  it('returns legal species unchanged', () => {
    assert.equal(format.displaySpecies('Rillaboom'), format.getSpecies('Rillaboom'));
  });

  it('describes real species outside the format so they can show a sprite', () => {
    const fancy = format.displaySpecies('Vivillon-Fancy');
    assert.equal(format.getSpecies('Vivillon-Fancy'), null);
    assert.deepEqual([fancy.name, fancy.num, fancy.forme], ['Vivillon-Fancy', 666, 'Fancy']);
    assert.equal(format.displaySpecies('Vivillon-Fancy'), fancy, 'cached');
  });

  it('returns null for names the dex does not know', () => {
    for (const name of ['Notamon', '', null]) assert.equal(format.displaySpecies(name), null, String(name));
  });
});

describe('buildFormat: items, moves, abilities', () => {
  it('lists exactly the regulation items, with stones flagged', () => {
    assert.equal(format.items.length, regMC.items.length);
    assert.ok(format.getItem('Baxcalibrite').megaStone);
    assert.equal(format.getItem('Rocky Helmet').megaStone, null);
  });

  it('offers legal moves the dex marks nonstandard (King\'s Shield, Light of Ruin)', () => {
    assert.ok(format.getMove("King's Shield"));
    assert.ok(format.getMove('Light of Ruin'));
    assert.ok(format.isLegalMove(format.getMove('Protect')));
    assert.equal(format.isLegalMove(format.getMove('Dragon Pulse')), false);
  });

  it('never offers Z-moves or Max moves', () => {
    assert.ok(format.moves.every(m => !m.isZ && !m.isMax));
  });

  it('exposes standard abilities for searching', () => {
    assert.ok(format.abilities.some(a => a.name === 'Intimidate'));
    assert.ok(format.abilities.every(a => !a.isNonstandard));
  });
});

describe('buildFormat: invalid data', () => {
  it('throws listing every problem', () => {
    const bad = defineRegulation({ id: 'BAD', label: 'Bad', pokemon: ['Notamon'], items: ['Fake Orb'] });
    assert.throws(() => buildFormat(bad, Dex), /unknown pokemon "Notamon"[\s\S]*unknown items "Fake Orb"/);
  });

  it('handles an empty regulation', () => {
    const empty = buildFormat(defineRegulation({ id: 'E', label: 'Empty' }), Dex);
    assert.deepEqual(empty.species, []);
    assert.deepEqual(empty.items, []);
    assert.equal(empty.getSpecies('Pikachu'), null);
  });
});

describe('megaBaseName', () => {
  it('prefers changesFrom, then battleOnly, then baseSpecies, picking the first legal one', () => {
    assert.equal(megaBaseName(Dex.species.get('Meowstic-F-Mega')), 'Meowstic-F');
    assert.equal(megaBaseName(Dex.species.get('Absol-Mega-Z')), 'Absol');
    assert.equal(megaBaseName(Dex.species.get('Floette-Mega')), 'Floette-Eternal');
    assert.equal(megaBaseName(Dex.species.get('Floette-Mega'), n => n === 'Floette'), 'Floette');
  });

  it('falls back to the first candidate when none is legal', () => {
    assert.equal(megaBaseName(Dex.species.get('Floette-Mega'), () => false), 'Floette-Eternal');
  });
});

describe('isDynamaxForme', () => {
  it('matches Gigantamax and Eternamax formes only', () => {
    for (const name of ['Charizard-Gmax', 'Toxtricity-Low-Key-Gmax', 'Urshifu-Rapid-Strike-Gmax', 'Eternatus-Eternamax']) {
      assert.ok(isDynamaxForme(Dex.species.get(name)), name);
    }
    for (const name of ['Charizard', 'Charizard-Mega-X', 'Toxtricity-Low-Key', 'Absol-Mega-Z']) {
      assert.equal(isDynamaxForme(Dex.species.get(name)), false, name);
    }
    assert.equal(isDynamaxForme(null), false);
  });
});
