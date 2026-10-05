import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatFor, slotWith, moveSlots, regMB } from './helpers.js';
import { exportToShowdown, importFromShowdown } from '../src/domain/showdown.js';
import { makeEmptyTeam, teamFromSlots } from '../src/domain/team.js';
import { totalEvs, CHAMPIONS } from '../src/domain/stats.js';

const format = formatFor();
const importOne = (text) => importFromShowdown(text, format).slots[0];

const RILLABOOM_PASTE = `Drummer (Rillaboom) @ Miracle Seed
Ability: Grassy Surge
Level: 50
EVs: 32 HP / 32 Atk / 2 SpD
Adamant Nature
- Fake Out
- Grassy Glide
- Wood Hammer
- Protect`;

describe('exportToShowdown', () => {
  it('writes the standard paste format', () => {
    const slot = slotWith('Rillaboom', {
      nickname: 'Drummer', item: 'Miracle Seed', ability: 'Grassy Surge', nature: 'Adamant',
      moves: moveSlots('Fake Out', 'Grassy Glide', 'Wood Hammer', 'Protect'),
      evs: { hp: 32, atk: 32, def: 0, spa: 0, spd: 2, spe: 0 },
    });
    assert.equal(exportToShowdown([slot]), RILLABOOM_PASTE);
  });

  it('omits empty item, nickname, EVs and moves', () => {
    assert.equal(exportToShowdown([slotWith('Salamence', { ability: 'Intimidate' })]),
      'Salamence\nAbility: Intimidate\nLevel: 50\nHardy Nature');
  });

  it('skips empty slots and separates Pokémon with a blank line', () => {
    const team = teamFromSlots([slotWith('Salamence'), slotWith('Rillaboom')]);
    team.splice(1, 0, makeEmptyTeam()[0]);
    const blocks = exportToShowdown(team).split('\n\n');
    assert.equal(blocks.length, 2);
    assert.ok(blocks[1].startsWith('Rillaboom'));
  });

  it('exports an empty team as an empty string', () => {
    assert.equal(exportToShowdown(makeEmptyTeam()), '');
  });
});

describe('importFromShowdown', () => {
  it('round-trips an export', () => {
    const slot = importOne(RILLABOOM_PASTE);
    assert.equal(exportToShowdown([slot]), RILLABOOM_PASTE);
  });

  it('parses nickname, gender and item from the first line', () => {
    const slot = importOne('Bubbles (Indeedee-F) (F) @ Psychic Seed\nAbility: Psychic Surge');
    assert.equal(slot.nickname, 'Bubbles');
    assert.equal(slot.species.name, 'Indeedee-F');
    assert.equal(slot.item, 'Psychic Seed');
  });

  it('accepts a gendered species with no nickname', () => {
    assert.equal(importOne('Indeedee (M)').species.name, 'Indeedee');
  });

  it('accepts names with apostrophes, dots and spaces', () => {
    assert.equal(importOne("Sirfetch'd @ Leek").species.name, 'Sirfetch’d');
    assert.equal(importOne('Mr. Mime').species.name, 'Mr. Mime');
  });

  it('a mega stone on a base species imports as the mega', () => {
    const slot = importOne('Absol @ Absolite Z\nAbility: Pressure');
    assert.equal(slot.species.name, 'Absol-Mega-Z');
    assert.equal(slot.ability, 'Magic Bounce');
  });

  it('a Gigantamax forme imports as the regular forme (and can still mega evolve)', () => {
    assert.equal(importOne('Rillaboom-Gmax @ Miracle Seed').species.name, 'Rillaboom');
    assert.equal(importOne('Charizard-Gmax @ Charizardite Y').species.name, 'Charizard-Mega-Y');
  });

  it('a mega species without its stone imports as the base forme', () => {
    assert.equal(importOne('Salamence-Mega @ Leftovers').species.name, 'Salamence');
    assert.equal(importOne('Salamence-Mega').species.name, 'Salamence');
  });

  it('a mega species with its stone stays a mega', () => {
    const slot = importOne('Charizard-Mega-X @ Charizardite X\nAbility: Tough Claws');
    assert.equal(slot.species.name, 'Charizard-Mega-X');
    assert.equal(slot.ability, 'Tough Claws');
  });

  it('clamps EVs to Champions limits (252-EV pastes from other formats)', () => {
    const slot = importOne('Salamence\nEVs: 252 Atk / 4 Def / 252 Spe');
    assert.deepEqual(slot.evs, { hp: 0, atk: 32, def: 4, spa: 0, spd: 0, spe: 30 });
    assert.equal(totalEvs(slot.evs), CHAMPIONS.MAX_TOTAL_EV);
  });

  it('reads EV labels case-insensitively and ignores junk', () => {
    const slot = importOne('Salamence\nEVs: 10 atk / x SpA / 5 Luck / 3 spe');
    assert.deepEqual(slot.evs, { hp: 0, atk: 10, def: 0, spa: 0, spd: 0, spe: 3 });
  });

  it('drops unknown or illegal items, abilities, natures and moves', () => {
    const slot = importOne(`Salamence @ Choice Band
Ability: Levitate
Silly Nature
- Not A Move
- Dragon Dance
- Dragon Dance
- Hurricane`);
    assert.equal(slot.item, null);
    assert.equal(slot.ability, 'Intimidate');
    assert.equal(slot.nature, 'Hardy');
    assert.deepEqual(slot.moves.map(m => m?.name ?? null), ['Dragon Dance', 'Hurricane', null, null]);
  });

  it('keeps only the first four moves', () => {
    const slot = importOne('Salamence\n- Protect\n- Dragon Dance\n- Hurricane\n- Fly\n- Earthquake');
    assert.deepEqual(slot.moves.map(m => m.name), ['Protect', 'Dragon Dance', 'Hurricane', 'Fly']);
  });

  it('ignores lines it does not know (Tera Type, IVs, Shiny…)', () => {
    const slot = importOne('Salamence\nTera Type: Fire\nIVs: 0 Atk\nShiny: Yes\nHappiness: 0\nJolly Nature');
    assert.equal(slot.nature, 'Jolly');
  });

  it('handles Windows line endings and extra blank lines', () => {
    const text = '\r\n\r\nSalamence\r\nJolly Nature\r\n- Protect\r\n\r\n\r\n\r\nRillaboom\r\n';
    const { slots } = importFromShowdown(text, format);
    assert.deepEqual(slots.map(s => s.species.name), ['Salamence', 'Rillaboom']);
    assert.equal(slots[0].nature, 'Jolly');
    assert.equal(slots[0].moves[0].name, 'Protect');
  });

  it('reports Pokémon that are not legal in the format', () => {
    const { slots, skipped } = importFromShowdown('Mewtwo @ Leftovers\n\nSalamence\n\nNotamon', format);
    assert.deepEqual(slots.map(s => s.species.name), ['Salamence']);
    assert.deepEqual(skipped, ['Mewtwo', 'Notamon']);
  });

  it('is regulation-aware: Reg C Pokémon are skipped under Reg B', () => {
    const { slots, skipped } = importFromShowdown('Salamence\n\nGengar', formatFor(regMB));
    assert.deepEqual(slots.map(s => s.species.name), ['Gengar']);
    assert.deepEqual(skipped, ['Salamence']);
  });

  it('returns nothing for empty or blank input', () => {
    for (const text of ['', '   \n\n  ', null, undefined]) {
      assert.deepEqual(importFromShowdown(text, format), { slots: [], skipped: [] }, String(text));
    }
  });
});
