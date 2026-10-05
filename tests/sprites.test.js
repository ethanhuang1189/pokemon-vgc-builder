import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatFor } from './helpers.js';
import {
  projectPokemonSlug, showdownSpriteId, svHomeFileName, ownSpriteUrls, pokemonSpriteUrls, itemSpriteUrls,
} from '../src/domain/sprites.js';

const format = formatFor();
const sp = (name) => format.getSpecies(name);
const urls = (name) => pokemonSpriteUrls(sp(name), format.getBaseOf);

describe('projectPokemonSlug (verified against projectpokemon.org file names)', () => {
  const cases = {
    'Charizard': 'charizard',
    'Charizard-Mega-X': 'charizard-megax',
    'Absol-Mega-Z': 'absol-megaz',
    'Salamence-Mega': 'salamence-mega',
    'Mr. Mime': 'mr.mime',
    'Mr. Rime': 'mr.rime',
    'Farfetch’d': 'farfetchd',
    "Sirfetch'd": 'sirfetchd',
    'Persian-Alola': 'persian-alola',
    'Toxtricity-Low-Key': 'toxtricity-low-key',
    'Indeedee-F': 'indeedee-f',
    'Kommo-o': 'kommo-o',
    'Flabébé': 'flabebe',
  };
  for (const [name, slug] of Object.entries(cases)) {
    it(`${name} → ${slug}`, () => assert.equal(projectPokemonSlug(name), slug));
  }
});

describe('showdownSpriteId', () => {
  it('joins base species and forme ids', () => {
    assert.equal(showdownSpriteId(sp('Absol-Mega-Z')), 'absol-megaz');
    assert.equal(showdownSpriteId(sp('Baxcalibur-Mega')), 'baxcalibur-mega');
    assert.equal(showdownSpriteId(sp('Squawkabilly-Blue')), 'squawkabilly-blue');
    assert.equal(showdownSpriteId(sp('Mr. Mime')), 'mrmime');
    assert.equal(showdownSpriteId(sp('Kommo-o')), 'kommoo');
  });
});

describe('svHomeFileName', () => {
  it('zero-pads the dex number and appends the forme index', () => {
    assert.equal(svHomeFileName(sp('Baxcalibur')), '0998');
    assert.equal(svHomeFileName(sp('Squawkabilly-Blue')), '0931_01');
    assert.equal(svHomeFileName(sp('Squawkabilly-White')), '0931_03');
    assert.equal(svHomeFileName(sp('Tauros-Paldea-Aqua')), '0128_03');
    assert.equal(svHomeFileName(sp('Persian-Alola')), '0053_01');
  });
});

describe('pokemonSpriteUrls', () => {
  it('tries Project Pokémon first, with Showdown and official art as fallbacks', () => {
    const list = urls('Salamence');
    assert.match(list[0], /projectpokemon\.org\/images\/normal-sprite\/salamence\.gif$/);
    assert.ok(list.some(u => u.includes('play.pokemonshowdown.com')));
    assert.match(list.at(-1), /official-artwork\/373\.png$/);
  });

  it('skips Project Pokémon animated sets that stop before a species\' generation', () => {
    const list = urls('Baxcalibur');
    assert.equal(list.some(u => u.includes('normal-sprite') || u.includes('swsh-normal')), false);
    assert.match(list[0], /sv-sprites-home\/0998\.png$/);
  });

  it('uses the Sword/Shield set for Gen 8 species', () => {
    assert.match(urls('Rillaboom')[0], /swsh-normal-sprites\/rillaboom\.gif$/);
  });

  it('megas try their own sprites before falling back to the base forme', () => {
    const list = urls('Golisopod-Mega');
    const own = ownSpriteUrls(sp('Golisopod-Mega'));
    assert.deepEqual(list.slice(0, own.length), own);
    assert.ok(list.includes('https://projectpokemon.org/images/normal-sprite/golisopod.gif'));
  });

  it('contains no duplicates', () => {
    for (const species of format.species) {
      const list = pokemonSpriteUrls(species, format.getBaseOf);
      assert.equal(new Set(list).size, list.length, species.name);
    }
  });

  it('returns nothing for no species', () => {
    assert.deepEqual(pokemonSpriteUrls(null), []);
  });
});

describe('itemSpriteUrls', () => {
  it('uses pokesprite when it has the item, with Serebii as fallback', () => {
    assert.deepEqual(itemSpriteUrls(format.getItem('Leftovers')), [
      'https://raw.githubusercontent.com/msikma/pokesprite/master/items/hold-item/leftovers.png',
      'https://www.serebii.net/itemdex/sprites/leftovers.png',
    ]);
  });

  it('falls back to Serebii for new stones pokesprite lacks', () => {
    assert.deepEqual(itemSpriteUrls(format.getItem('Baxcalibrite')), ['https://www.serebii.net/itemdex/sprites/baxcalibrite.png']);
  });

  it('every Reg C item has at least one candidate', () => {
    for (const item of format.items) assert.ok(itemSpriteUrls(item).length > 0, item.name);
  });

  it('returns nothing for no item', () => {
    assert.deepEqual(itemSpriteUrls(null), []);
  });
});
