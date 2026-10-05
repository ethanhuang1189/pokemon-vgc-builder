import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Dex, formatFor, regMC } from './helpers.js';
import { collectLearnset, createLearnsets } from '../src/domain/learnsets.js';
import { extendRegulation } from '../src/regulations/extend.js';
import { buildFormat } from '../src/domain/format.js';

const format = formatFor();
const learnsets = createLearnsets(Dex, format);
const sp = (name) => format.getSpecies(name);

describe('collectLearnset', () => {
  it('includes moves only learned by pre-evolutions', async () => {
    const thwackey = await collectLearnset(Dex, 'thwackey');
    const rillaboom = await collectLearnset(Dex, 'rillaboom');
    for (const move of thwackey) assert.ok(rillaboom.has(move), move);
  });

  it('follows regional pre-evolutions (Alolan Meowth → Alolan Persian)', async () => {
    const ids = await collectLearnset(Dex, 'persianalola');
    const meowthAlola = await collectLearnset(Dex, 'meowthalola');
    assert.ok([...meowthAlola].every(m => ids.has(m)));
  });

  it('returns an empty set for unknown species', async () => {
    assert.equal((await collectLearnset(Dex, 'notamon')).size, 0);
    assert.equal((await collectLearnset(Dex, '')).size, 0);
  });
});

describe('createLearnsets', () => {
  it('every Reg C species has learnset data', async () => {
    for (const species of format.species) {
      assert.ok((await learnsets.learnableIds(species)).size > 0, species.name);
    }
  });

  it('megas use their base forme\'s learnset', async () => {
    const mega = await learnsets.learnableIds(sp('Baxcalibur-Mega'));
    const base = await learnsets.learnableIds(sp('Baxcalibur'));
    assert.deepEqual(mega, base);
  });

  it('applies regulation learnset additions (Froslass-Mega gains Nasty Plot)', async () => {
    assert.ok((await learnsets.learnableIds(sp('Froslass-Mega'))).has('nastyplot'));
  });

  it('learnableMoves returns format move objects', async () => {
    const moves = await learnsets.learnableMoves(sp('Rillaboom'));
    assert.ok(moves.some(m => m.name === 'Grassy Glide'));
    assert.ok(moves.every(m => format.getMove(m.id) === m));
  });

  it('offers every format move when a species has no learnset data', async () => {
    const fake = { ...sp('Rillaboom'), id: 'fakemon', learnsetId: 'fakemon' };
    assert.equal(await learnsets.learnableMoves(fake), format.moves);
  });

  it('caches lookups per species', () => {
    assert.equal(learnsets.learnableIds(sp('Salamence')), learnsets.learnableIds(sp('Salamence')));
  });

  it('additions declared for a mega do not leak to the base forme', async () => {
    const reg = extendRegulation(regMC, { id: 'T', label: 'T', learnsetAdditions: { salamencemega: ['spore'] } });
    const f = buildFormat(reg, Dex);
    const service = createLearnsets(Dex, f);
    assert.ok((await service.learnableIds(f.getSpecies('Salamence-Mega'))).has('spore'));
    assert.equal((await service.learnableIds(f.getSpecies('Salamence'))).has('spore'), false);
  });

  it('builds a move → learners index covering megas', async () => {
    const index = await learnsets.buildMoveIndex();
    const fakeOut = index.get('fakeout');
    assert.ok(fakeOut.has('rillaboom'));
    assert.ok(fakeOut.has('incineroar'));
    assert.equal(fakeOut.has('salamence'), false);
    assert.ok(index.get('dragondance').has('salamencemega'));
  });
});
