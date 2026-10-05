import { toId } from '../domain/ids.js';

// Every list a regulation defines. All entries are @pkmn/dex (Showdown) names.
//   pokemon — exact species/forme names ("Persian-Alola", "Indeedee-F")
//   megas   — mega forme names ("Absol-Mega-Z"); each stone must also be in `items`
//   items   — held items, mega stones included
//   moves   — the format's move list
export const LIST_KEYS = ['pokemon', 'megas', 'items', 'moves'];

function findDuplicates(names) {
  const seen = new Set();
  const dupes = new Set();
  for (const name of names) {
    const id = toId(name);
    if (seen.has(id)) dupes.add(name);
    seen.add(id);
  }
  return [...dupes];
}

function assertKnownKeys(regulationId, section, obj) {
  const unknown = Object.keys(obj).filter(k => !LIST_KEYS.includes(k));
  if (unknown.length) {
    throw new Error(`Regulation ${regulationId}: unknown ${section} list(s): ${unknown.join(', ')}`);
  }
}

function freezeAdditions(additions) {
  return Object.freeze(Object.fromEntries(
    Object.entries(additions).map(([speciesId, moveIds]) => [speciesId, Object.freeze([...moveIds])]),
  ));
}

/**
 * Validates and freezes a complete regulation.
 * `learnsetAdditions` maps a species id to move ids it gains in this format.
 */
export function defineRegulation({ id, label, learnsetAdditions = {}, ...lists }) {
  if (!id || !label) throw new Error('A regulation needs an id and a label');
  assertKnownKeys(id, 'top-level', lists);

  const frozen = {};
  for (const key of LIST_KEYS) {
    const names = lists[key] ?? [];
    const dupes = findDuplicates(names);
    if (dupes.length) throw new Error(`Regulation ${id}: duplicate ${key}: ${dupes.join(', ')}`);
    frozen[key] = Object.freeze([...names]);
  }

  return Object.freeze({ id, label, ...frozen, learnsetAdditions: freezeAdditions(learnsetAdditions) });
}

/**
 * Builds a new regulation from an older one. Only the differences are listed:
 *   extendRegulation(regMB, { id: 'M-C', label: '…', add: { pokemon: ['Salamence'] }, remove: { items: ['Leek'] } })
 * Adding something already legal, or removing something that isn't, throws — both are usually typos.
 */
export function extendRegulation(base, { id, label, add = {}, remove = {}, learnsetAdditions = {} }) {
  assertKnownKeys(id, 'add', add);
  assertKnownKeys(id, 'remove', remove);

  const lists = {};
  for (const key of LIST_KEYS) {
    const baseIds = new Set(base[key].map(toId));
    const removeIds = new Set((remove[key] ?? []).map(toId));

    const notInBase = (remove[key] ?? []).filter(n => !baseIds.has(toId(n)));
    if (notInBase.length) {
      throw new Error(`Regulation ${id}: cannot remove ${key} not in ${base.id}: ${notInBase.join(', ')}`);
    }
    const alreadyLegal = (add[key] ?? []).filter(n => baseIds.has(toId(n)) && !removeIds.has(toId(n)));
    if (alreadyLegal.length) {
      throw new Error(`Regulation ${id}: ${key} already in ${base.id}: ${alreadyLegal.join(', ')}`);
    }

    lists[key] = [...base[key].filter(n => !removeIds.has(toId(n))), ...(add[key] ?? [])];
  }

  const mergedAdditions = { ...base.learnsetAdditions };
  for (const [speciesId, moveIds] of Object.entries(learnsetAdditions)) {
    mergedAdditions[speciesId] = [...new Set([...(mergedAdditions[speciesId] ?? []), ...moveIds])];
  }

  return defineRegulation({ id, label, ...lists, learnsetAdditions: mergedAdditions });
}

/** What changed between two regulations, per list (useful when reviewing a new regulation). */
export function diffRegulations(from, to) {
  const diff = {};
  for (const key of LIST_KEYS) {
    const fromIds = new Set(from[key].map(toId));
    const toIds = new Set(to[key].map(toId));
    diff[key] = {
      added: to[key].filter(n => !fromIds.has(toId(n))),
      removed: from[key].filter(n => !toIds.has(toId(n))),
    };
  }
  return diff;
}
