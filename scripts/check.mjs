#!/usr/bin/env node
// Legality checker CLI — uses the same regulation data and domain code as the app.
// Run `npm run check` for usage. Add --reg=M-B to check against another regulation.

import { Dex } from '@pkmn/dex';
import { buildFormat } from '../src/domain/format.js';
import { createLearnsets } from '../src/domain/learnsets.js';
import { CHAMPIONS, STAT_KEYS, STAT_LABELS, calcStat } from '../src/domain/stats.js';
import { diffRegulations, LIST_KEYS } from '../src/regulations/extend.js';
import { REGULATIONS, CURRENT_REGULATION, getRegulation } from '../src/regulations/index.js';
import { toId } from '../src/domain/ids.js';

// ── Output helpers ───────────────────────────────────────────────────────────
const paint = (code) => (s) => `\x1b[${code}m${s}\x1b[0m`;
const [bold, green, red, yellow, cyan, gray, purple] = [1, 32, 31, 33, 36, 90, 35].map(paint);
const PASS = green('✓');
const FAIL = red('✗');
const RULE = gray('─'.repeat(50));
const mark = (ok) => (ok ? PASS : FAIL);
const score = (passed, total) => (passed === total ? green : red)(`${passed}/${total} passed`);

class UsageError extends Error {}

// ── Arguments ────────────────────────────────────────────────────────────────
const rawArgs = process.argv.slice(2);
const regFlag = rawArgs.find(a => a.startsWith('--reg='));
const [command, ...args] = rawArgs.filter(a => a !== regFlag);
const regulation = regFlag ? getRegulation(regFlag.slice('--reg='.length)) : CURRENT_REGULATION;
const format = buildFormat(regulation, Dex);
const learnsets = createLearnsets(Dex, format);

// Any dex species (not only legal ones), so the CLI can explain why something is illegal.
function findSpecies(name) {
  const dexSpecies = Dex.species.get(name);
  const species = format.getSpecies(name) ?? (dexSpecies?.exists ? dexSpecies : null);
  if (!species) throw new UsageError(`Species "${name}" not found in the dex. Quote multi-word names.`);
  return species;
}

const isLegal = (species) => Boolean(format.getSpecies(species.name));

/** Learnable move ids; species outside the format are looked up straight from the dex. */
const learnableIds = (species) => learnsets.learnableIds(
  format.getSpecies(species.name) ?? { id: species.id, learnsetId: species.id },
);

const megasOf = (species) => format.megas.filter(m => m.baseSpeciesId === species.id);

// Greedy multi-word matching: "draco meteor fly" → ["Draco Meteor", "Fly"].
function greedyMatch(words, lookup) {
  const results = [];
  for (let i = 0; i < words.length;) {
    const len = [3, 2, 1].find(n => i + n <= words.length && lookup(words.slice(i, i + n).join(' ')));
    const take = len ?? 1;
    const raw = words.slice(i, i + take).join(' ');
    results.push({ raw, entry: len ? lookup(raw) : null });
    i += take;
  }
  return results;
}

function header(species) {
  console.log(`\n${RULE}`);
  console.log(bold(`  ${species.name}`) + gray(` #${species.num}`) + `  ${species.types.join(' / ')}`);
}

// ── Commands ─────────────────────────────────────────────────────────────────
async function cmdPokemon(name, moveWords) {
  const species = findSpecies(name);
  const ids = await learnableIds(species);
  const legalCount = [...ids].filter(id => format.isLegalMove(id)).length;

  header(species);
  console.log(`  Legal in ${regulation.id}: ${mark(isLegal(species))}`);
  console.log(`  Legal moves available: ${cyan(legalCount)}`);
  console.log(RULE);
  if (!moveWords.length) return console.log(gray('  (Pass move names after the Pokémon to test them)\n'));

  const matches = greedyMatch(moveWords, n => Dex.moves.get(n)?.exists ? Dex.moves.get(n) : null);
  let passed = 0;
  for (const { raw, entry: move } of matches) {
    if (!move) { console.log(`  ${FAIL}  ${red(raw.padEnd(22))}  not found in dex`); continue; }
    const legal = format.isLegalMove(move);
    const learnable = ids.has(move.id);
    if (legal && learnable) passed++;
    console.log(`  ${mark(legal && learnable)}  ${(legal && learnable ? green : yellow)(move.name.padEnd(22))}  ` +
      `${legal ? green('legal ✓') : red('illegal ✗')}   ${learnable ? green('learnable ✓') : red('not learnable ✗')}`);
  }
  console.log(`${RULE}\n  ${score(passed, matches.length)}\n`);
}

function cmdAbility(name, abilityWords) {
  const species = findSpecies(name);
  const abilities = Object.values(species.abilities).filter(Boolean);
  console.log(`\n${RULE}\n${bold(`  ${species.name}`)}  abilities:`);
  for (const a of abilities) {
    const desc = Dex.abilities.get(a)?.shortDesc;
    console.log(`    ${cyan(a)}${desc ? gray(`  — ${desc}`) : ''}`);
  }
  console.log(RULE);
  if (!abilityWords.length) return console.log();

  const matches = greedyMatch(abilityWords, n => Dex.abilities.get(n)?.exists ? Dex.abilities.get(n) : null);
  let passed = 0;
  for (const { raw, entry: ability } of matches) {
    if (!ability) { console.log(`  ${FAIL}  ${red(raw)}  not found in dex`); continue; }
    const has = abilities.includes(ability.name);
    if (has) passed++;
    console.log(`  ${mark(has)}  ${(has ? green : yellow)(ability.name)}`);
  }
  console.log(`${RULE}\n  ${score(passed, matches.length)}\n`);
}

function cmdMega(name) {
  const species = findSpecies(name);
  const megas = megasOf(species);
  console.log(`\n${RULE}\n${bold(`  Mega forms for ${species.name} in ${regulation.id}:`)}`);
  if (!megas.length) console.log(gray('  None'));
  for (const mega of megas) console.log(`  ${PASS}  ${purple(mega.name)}  ${cyan(`@ ${mega.megaStone}`)}  ${gray(mega.types.join(' / '))}`);
  console.log(`${RULE}\n`);
}

async function cmdMoves(name) {
  const species = findSpecies(name);
  const ids = await learnableIds(species);
  const moves = format.moves.filter(m => ids.has(m.id) && format.isLegalMove(m));
  console.log(`\n${RULE}\n${bold(`  ${species.name}`)}  —  ${cyan(moves.length)} legal moves\n${RULE}`);
  for (let i = 0; i < moves.length; i += 3) {
    console.log(`  ${gray(moves.slice(i, i + 3).map(m => m.name.padEnd(25)).join(''))}`);
  }
  console.log();
}

function cmdItem(name) {
  const dexItem = Dex.items.get(name);
  const item = format.getItem(name);
  console.log(`\n${RULE}\n${bold(`  Item: ${dexItem?.exists ? dexItem.name : name}`)}`);
  console.log(`  ${`Legal in ${regulation.id}:`.padEnd(16)}${mark(Boolean(item))}`);
  console.log(`  ${'In @pkmn/dex:'.padEnd(16)}${mark(Boolean(dexItem?.exists))}`);
  if (dexItem?.megaStone) {
    const megas = format.megas.filter(m => toId(m.megaStone) === dexItem.id).map(m => m.name);
    console.log(`  ${purple('★ Mega Stone')} → ${megas.length ? megas.join(', ') : gray('no legal mega')}`);
  }
  console.log(`${RULE}\n`);
}

async function cmdLegal(name) {
  const species = findSpecies(name);
  const ids = await learnableIds(species);
  const megas = megasOf(species);
  header(species);
  console.log(`  Legal:     ${isLegal(species) ? `${PASS}  in ${regulation.id}` : `${FAIL}  NOT in ${regulation.id}`}`);
  console.log(`  Moves:     ${cyan([...ids].filter(id => format.isLegalMove(id)).length)} legal moves available`);
  console.log(`  Abilities: ${Object.values(species.abilities).filter(Boolean).map(cyan).join(', ')}`);
  console.log(`  Megas:     ${megas.length ? megas.map(m => purple(m.name)).join(', ') : gray('none')}`);
  console.log(`${RULE}\n`);
}

function cmdStat(name, statArgs) {
  const species = findSpecies(name);
  const base = species.baseStats;
  const champ = Object.fromEntries(STAT_KEYS.map(k => [k, calcStat(k, base[k], 0)]));
  const sum = (f) => STAT_KEYS.reduce((s, k) => s + f(k), 0);

  console.log(`\n${RULE}\n${bold(`  ${species.name}`)}${gray(` #${species.num}  ${species.types.join(' / ')}`)}\n${RULE}`);
  console.log(`  ${gray('     ')}  ${gray('Dex')}  ${gray('Champions base')}  ${gray('L50 (0 EV)')}\n${RULE}`);
  for (const k of STAT_KEYS) {
    console.log(`  ${gray(STAT_LABELS[k].padEnd(4))}  ${gray(String(base[k]).padStart(3))}` +
      `  ${cyan(String(base[k] + CHAMPIONS.BASE_STAT_BUFF).padStart(14))}  ${green(String(champ[k]).padStart(10))}`);
  }
  console.log(`  ${gray('BST ')}  ${gray(String(sum(k => base[k])).padStart(3))}  ${cyan(String(sum(k => base[k] + CHAMPIONS.BASE_STAT_BUFF)).padStart(14))}`);
  if (!statArgs.length) return console.log();

  const given = statArgs.map(Number);
  if (given.some(n => !Number.isInteger(n))) throw new UsageError('All stat arguments must be whole numbers.');

  console.log(`${RULE}\n${gray('  Checking against Champions L50 (0 EV, neutral):')}\n${RULE}`);
  const checks = STAT_KEYS.slice(0, given.length).map((k, i) => ({ k, expected: champ[k], actual: given[i] }));
  for (const { k, expected, actual } of checks) {
    console.log(expected === actual
      ? `  ${PASS}  ${gray(STAT_LABELS[k].padEnd(4))}  ${green(String(actual).padStart(3))}`
      : `  ${FAIL}  ${gray(STAT_LABELS[k].padEnd(4))}  ${red(String(actual).padStart(3))}  ${gray('(actual:')} ${cyan(expected)}${gray(')')}`);
  }
  console.log(`${RULE}\n  ${score(checks.filter(c => c.expected === c.actual).length, checks.length)}\n`);
}

function cmdDiff(fromId, toId_) {
  if (!fromId) throw new UsageError('Usage: diff <from> [to]');
  const from = getRegulation(fromId);
  const to = toId_ ? getRegulation(toId_) : regulation;
  const diff = diffRegulations(from, to);
  console.log(`\n${RULE}\n${bold(`  ${from.id} → ${to.id}`)}\n${RULE}`);
  for (const key of LIST_KEYS) {
    const { added, removed } = diff[key];
    if (!added.length && !removed.length) continue;
    console.log(bold(`  ${key}`));
    if (added.length) console.log(`    ${green('+')} ${added.join(', ')}`);
    if (removed.length) console.log(`    ${red('−')} ${removed.join(', ')}`);
  }
  console.log();
}

function printHelp() {
  console.log(`
${bold('Pokémon Champions legality checker')}  ${gray(`(regulations: ${Object.keys(REGULATIONS).join(', ')}; default ${CURRENT_REGULATION.id})`)}

${bold('Commands:')}
  ${cyan('pokemon')} <name> [moves...]       Check if moves are legal & learnable
  ${cyan('ability')} <name> [abilities...]   Check abilities for a Pokémon
  ${cyan('mega')}    <name>                  Mega forms and their stones
  ${cyan('moves')}   <name>                  Every legal move a Pokémon learns
  ${cyan('item')}    <item name>             Is an item legal (and what it mega evolves)
  ${cyan('stat')}    <name> [hp atk def spa spd spe]   Champions stats, optionally checked
  ${cyan('legal')}   <name>                  Full legality summary
  ${cyan('diff')}    <from> [to]             What changed between regulations

${bold('Options:')}
  --reg=<id>   Check against another regulation (e.g. --reg=M-B)

${bold('Examples:')}
  npm run check -- pokemon rillaboom fake out grassy glide wood hammer
  npm run check -- mega absol
  npm run check -- item absolite z
  npm run check -- legal salamence --reg=M-B
  npm run check -- diff M-B
`);
}

const COMMANDS = {
  pokemon: () => cmdPokemon(args[0], args.slice(1)),
  ability: () => cmdAbility(args[0], args.slice(1)),
  mega: () => cmdMega(args.join(' ')),
  moves: () => cmdMoves(args.join(' ')),
  item: () => cmdItem(args.join(' ')),
  stat: () => cmdStat(args[0], args.slice(1)),
  legal: () => cmdLegal(args.join(' ')),
  diff: () => cmdDiff(args[0], args[1]),
};

try {
  if (!command || command === 'help') printHelp();
  else if (!COMMANDS[command]) throw new UsageError(`Unknown command: ${command}. Run with "help" for usage.`);
  else if (command !== 'diff' && !args.length) throw new UsageError(`Usage: ${command} <name> …`);
  else await COMMANDS[command]();
} catch (err) {
  if (!(err instanceof UsageError)) throw err;
  console.log(red(`\n  ${err.message}\n`));
  process.exit(1);
}
