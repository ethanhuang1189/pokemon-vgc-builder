import { CHAMPIONS, STAT_KEYS, STAT_LABELS, isNature, setEv } from './stats.js';
import { MOVE_SLOTS, makeEmptySlot, withItem, speciesHasAbility, defaultAbility } from './slot.js';
import { filledSlots } from './analysis.js';

// Showdown paste format: https://pokepast.es/syntax.html

function exportSlot(slot) {
  const name = slot.nickname ? `${slot.nickname} (${slot.species.name})` : slot.species.name;
  const lines = [slot.item ? `${name} @ ${slot.item}` : name];

  if (slot.ability) lines.push(`Ability: ${slot.ability}`);
  lines.push(`Level: ${CHAMPIONS.LEVEL}`);

  const evParts = STAT_KEYS.filter(k => slot.evs[k] > 0).map(k => `${slot.evs[k]} ${STAT_LABELS[k]}`);
  if (evParts.length) lines.push(`EVs: ${evParts.join(' / ')}`);

  if (slot.nature) lines.push(`${slot.nature} Nature`);
  for (const move of slot.moves) if (move?.name) lines.push(`- ${move.name}`);
  return lines.join('\n');
}

export const exportToShowdown = (team) => filledSlots(team).map(exportSlot).join('\n\n');

const STAT_BY_LABEL = Object.fromEntries(STAT_KEYS.map(k => [STAT_LABELS[k].toLowerCase(), k]));

// "Nick (Species) (F) @ Item" → { nickname, speciesName, itemName }
function parseHeader(line) {
  const [namePart, itemPart] = line.split(/\s+@\s+/, 2);
  const withoutGender = namePart.trim().replace(/\s+\([MF]\)$/, '');
  const nicknamed = withoutGender.match(/^(.+?)\s+\((.+)\)$/);
  return {
    nickname: nicknamed ? nicknamed[1].trim() : '',
    speciesName: (nicknamed ? nicknamed[2] : withoutGender).trim(),
    itemName: itemPart?.trim() ?? null,
  };
}

function parseEvs(text) {
  let evs = makeEmptySlot().evs;
  for (const part of text.split('/')) {
    const match = part.trim().match(/^(\d+)\s+(\w+)$/);
    const key = match && STAT_BY_LABEL[match[2].toLowerCase()];
    if (key) evs = setEv(evs, key, Number(match[1]));
  }
  return evs;
}

function parseBlock(block, format) {
  const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const { nickname, speciesName, itemName } = parseHeader(lines[0]);
  const species = format.getSpecies(speciesName);
  if (!species) return { skipped: speciesName };

  let slot = { ...makeEmptySlot(), species, nickname, ability: defaultAbility(species) };
  const moves = [];

  for (const line of lines.slice(1)) {
    if (/^Ability:/i.test(line)) {
      const ability = line.replace(/^Ability:/i, '').trim();
      if (speciesHasAbility(species, ability)) slot.ability = ability;
    } else if (/^EVs:/i.test(line)) {
      slot.evs = parseEvs(line.replace(/^EVs:/i, ''));
    } else if (/ Nature$/i.test(line)) {
      const nature = line.replace(/ Nature$/i, '').trim();
      if (isNature(nature)) slot.nature = nature;
    } else if (line.startsWith('-') && moves.length < MOVE_SLOTS) {
      const move = format.getMove(line.replace(/^-\s*/, ''));
      if (move && !moves.includes(move)) moves.push(move);
    }
  }
  slot.moves = Array.from({ length: MOVE_SLOTS }, (_, i) => moves[i] ?? null);

  // Applying the item last lets "Charizard @ Charizardite X" import as Charizard-Mega-X.
  const item = itemName ? format.getItem(itemName) : null;
  if (item) slot = withItem(slot, item, format);
  else if (species.isMega) slot = withItem(slot, null, format);
  return { slot };
}

/**
 * Parses a Showdown paste into slots. Species not legal in the format are skipped and
 * reported; unknown items, moves, abilities and natures are dropped; EVs are clamped to
 * Champions limits (so 252-EV pastes from other formats stay within the budget).
 */
export function importFromShowdown(text, format) {
  const slots = [];
  const skipped = [];
  for (const block of String(text ?? '').trim().split(/\r?\n\s*\r?\n/)) {
    if (!block.trim()) continue;
    const result = parseBlock(block, format);
    if (result.slot) slots.push(result.slot);
    else skipped.push(result.skipped);
  }
  return { slots, skipped };
}
