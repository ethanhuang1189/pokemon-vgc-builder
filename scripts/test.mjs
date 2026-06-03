#!/usr/bin/env node
/**
 * Pokemon Champions Test CLI
 *
 * Usage:
 *   npm test pokemon <name> [move1] [move2] ...
 *   npm test ability <name> [ability1] ...
 *   npm test mega    <name>
 *   npm test moves   <name>
 *   npm test item    <item name>
 *   npm test legal   <name>           (full legality report)
 *
 * Multi-word names: quote them or use hyphens
 *   npm test pokemon charizard "draco meteor" fly
 *   npm test pokemon charizard draco-meteor fly
 */

import { Dex } from '../node_modules/@pkmn/dex/build/index.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const bold   = s => `\x1b[1m${s}\x1b[0m`;
const green  = s => `\x1b[32m${s}\x1b[0m`;
const red    = s => `\x1b[31m${s}\x1b[0m`;
const yellow = s => `\x1b[33m${s}\x1b[0m`;
const cyan   = s => `\x1b[36m${s}\x1b[0m`;
const gray   = s => `\x1b[90m${s}\x1b[0m`;
const purple = s => `\x1b[35m${s}\x1b[0m`;
const PASS   = green('✓');
const FAIL   = red('✗');
const line   = gray('─'.repeat(50));

// ── Legal data (reads .txt files directly — no Vite ?raw needed) ──────────────
const normalize = n => n.toLowerCase().replace(/[-.']/g, '').replace(/\s+/g, ' ').trim();
const parseNames = raw => raw.split('\n').flatMap(l => l.split('\t')).map(s => s.trim()).filter(Boolean);
const readSet = file => new Set(parseNames(readFileSync(join(ROOT, file), 'utf8')).map(normalize));

const LEGAL_MONS  = readSet('legal_mons.txt');
const LEGAL_MOVES = readSet('legal_moves.txt');
const LEGAL_ITEMS = readSet('legal_items.txt');

const LEGAL_MEGA_NAMES = parseNames(readFileSync(join(ROOT, 'legal_mega.txt'), 'utf8'))
  .filter(n => n.startsWith('Mega '));

// ── Mega stone mapping (mirrors megaForms.js) ─────────────────────────────────
const MEGA_STONE_MAP = {
  venusaurmega:       'Venusaurite',
  charizardmegax:     'Charizardite X',
  charizardmegay:     'Charizardite Y',
  blastoisemega:      'Blastoisinite',
  beedrillmega:       'Beedrillite',
  pidgeotmega:        'Pidgeotite',
  clefablemega:       'Clefablite',
  alakazammega:       'Alakazite',
  victreebelmega:     'Victreebelite',
  slowbromega:        'Slowbronite',
  gengarmega:         'Gengarite',
  kangaskhanmega:     'Kangaskhanite',
  starmiemega:        'Starminite',
  pinsirmega:         'Pinsirite',
  gyaradosmega:       'Gyaradosite',
  aerodactylmega:     'Aerodactylite',
  dragonitemega:      'Dragoninite',
  meganiummega:       'Meganiumite',
  feraligatrmega:     'Feraligite',
  ampharosmega:       'Ampharosite',
  steelixmega:        'Steelixite',
  scizormega:         'Scizorite',
  heracrossmega:      'Heracronite',
  skarmorymega:       'Skarmorite',
  houndoommega:       'Houndoominite',
  tyranitarmega:      'Tyranitarite',
  gardevoirmega:      'Gardevoirite',
  sableyemega:        'Sablenite',
  aggronmega:         'Aggronite',
  medichammega:       'Medichamite',
  manectricmega:      'Manectite',
  sharpedomega:       'Sharpedonite',
  cameruptmega:       'Cameruptite',
  altariamega:        'Altarianite',
  banettemega:        'Banettite',
  chimechomega:       'Chimechite',
  absolmega:          'Absolite',
  glaliemega:         'Glalitite',
  lopunnymega:        'Lopunnite',
  garchompmega:       'Garchompite',
  lucariomega:        'Lucarionite',
  abomasnowmega:      'Abomasite',
  gallademega:        'Galladite',
  froslassmega:       'Froslassite',
  emboarmega:         'Emboarite',
  excadrillmega:      'Excadrite',
  audinomega:         'Audinite',
  chandeluremega:     'Chandelurite',
  golurkmega:         'Golurkite',
  chesnaughtmega:     'Chesnaughtite',
  delphoxmega:        'Delphoxite',
  greninjamega:       'Greninjite',
  floettemega:        'Floettite',
  meowsticmalemega:   'Meowsticite',
  meowsticfemalemega: 'Meowsticite',
  hawluchamega:       'Hawluchanite',
  crabominablemega:   'Crabominite',
  drampamega:         'Drampanite',
  scovillainmega:     'Scovillainite',
  glimmoramega:       'Glimmoranite',
};

const MEGA_STONE_NAMES = new Set(Object.values(MEGA_STONE_MAP));

// ── Dex lookup helpers ────────────────────────────────────────────────────────
// Pre-build normalized lookup maps for O(1) access
const speciesByNorm = new Map();
for (const s of Dex.species.all()) {
  if (s.exists) speciesByNorm.set(normalize(s.name), s);
}

const movesByNorm = new Map();
for (const m of Dex.moves.all()) {
  if (m.exists) movesByNorm.set(normalize(m.name), m);
}

const abilitiesByNorm = new Map();
for (const a of Dex.abilities.all()) {
  if (a.exists) abilitiesByNorm.set(normalize(a.name), a);
}

function findSpecies(name) {
  return speciesByNorm.get(normalize(name)) ?? Dex.species.get(name);
}

function getMegaDexId(megaName) {
  const base = megaName.replace(/^Mega /, '');
  if (base === 'Charizard X') return 'charizardmegax';
  if (base === 'Charizard Y') return 'charizardmegay';
  return base.toLowerCase().replace(/[^a-z0-9]/g, '') + 'mega';
}

function getBaseSpeciesName(megaName) {
  const base = megaName.replace(/^Mega /, '');
  if (base.startsWith('Charizard')) return 'Charizard';
  if (base === 'Meowstic (Male)') return 'Meowstic';
  if (base === 'Meowstic (Female)') return 'Meowstic-F';
  return base;
}

async function getLearnset(species) {
  // Walk the full pre-evolution chain — egg moves are often only on earlier forms
  const allIds = new Set();
  let current = species;
  while (current?.exists) {
    const ls = await Dex.learnsets.get(current.id);
    if (ls?.learnset) for (const id of Object.keys(ls.learnset)) allIds.add(id);
    current = current.prevo ? Dex.species.get(current.prevo) : null;
  }
  return allIds;
}

// Greedy multi-word argument matching — tries 3-word, 2-word, then 1-word combos
function greedyMatch(args, lookup) {
  const results = [];
  let i = 0;
  while (i < args.length) {
    let matched = false;
    for (let len = Math.min(3, args.length - i); len >= 1; len--) {
      const candidate = args.slice(i, i + len).join(' ');
      const entry = lookup(candidate);
      if (entry) {
        results.push({ raw: candidate, entry });
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      results.push({ raw: args[i], entry: null });
      i++;
    }
  }
  return results;
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function cmdPokemon(name, moveArgs) {
  const species = findSpecies(name);
  if (!species?.exists) {
    console.log(red(`\n  Species "${name}" not found in dex.\n`));
    return;
  }

  const isLegalMon = LEGAL_MONS.has(normalize(species.name));
  console.log(`\n${line}`);
  console.log(bold(`  ${species.name}`) + gray(` #${species.num}`) + `  ${species.types.join(' / ')}`);
  console.log(`  In legal_mons.txt: ${isLegalMon ? PASS : FAIL}`);

  const learnableIds = await getLearnset(species);

  // Count legal+learnable moves
  let legalLearnableCount = 0;
  for (const id of learnableIds) {
    const m = Dex.moves.get(id);
    if (m?.exists && LEGAL_MOVES.has(normalize(m.name))) legalLearnableCount++;
  }
  console.log(`  Legal moves available: ${cyan(String(legalLearnableCount))}`);
  console.log(line);

  if (moveArgs.length === 0) {
    console.log(gray('  (No moves specified to test — pass move names after the Pokemon name)'));
    console.log();
    return;
  }

  const matches = greedyMatch(moveArgs, c => movesByNorm.get(normalize(c)));
  let passed = 0;

  for (const { raw, entry: move } of matches) {
    if (!move) {
      console.log(`  ${FAIL}  ${red(raw.padEnd(22))}  not found in dex`);
      continue;
    }

    const isLegal    = LEGAL_MOVES.has(normalize(move.name));
    const isLearnable = learnableIds.has(move.id);
    const ok = isLegal && isLearnable;
    if (ok) passed++;

    const legalTag     = isLegal    ? green('legal ✓')    : red('illegal ✗');
    const learnTag     = isLearnable ? green('learnable ✓') : red('not learnable ✗');
    const nameStr      = ok ? green(move.name.padEnd(22)) : yellow(move.name.padEnd(22));
    console.log(`  ${ok ? PASS : FAIL}  ${nameStr}  ${legalTag}   ${learnTag}`);
  }

  console.log(line);
  const total = matches.length;
  const status = passed === total ? green(`${passed}/${total} passed`) : red(`${passed}/${total} passed`);
  console.log(`  ${status}\n`);
}

async function cmdAbility(name, abilityArgs) {
  const species = findSpecies(name);
  if (!species?.exists) {
    console.log(red(`\n  Species "${name}" not found.\n`));
    return;
  }

  const abilities = Object.values(species.abilities).filter(Boolean);
  console.log(`\n${line}`);
  console.log(bold(`  ${species.name}`) + `  abilities:`);
  for (const a of abilities) {
    const abil = Dex.abilities.get(a);
    console.log(`    ${cyan(a)}${abil?.shortDesc ? gray('  — ' + abil.shortDesc) : ''}`);
  }
  console.log(line);

  if (abilityArgs.length === 0) {
    console.log();
    return;
  }

  const matches = greedyMatch(abilityArgs, c => abilitiesByNorm.get(normalize(c)));
  let passed = 0;
  for (const { raw, entry: abil } of matches) {
    if (!abil) {
      console.log(`  ${FAIL}  ${red(raw)}  not found in dex`);
      continue;
    }
    const has = abilities.some(a => normalize(a) === normalize(abil.name));
    if (has) passed++;
    console.log(`  ${has ? PASS : FAIL}  ${has ? green(abil.name) : yellow(abil.name)}`);
  }

  const total = abilityArgs.length;
  console.log(line);
  console.log(`  ${passed === total ? green(`${passed}/${total} passed`) : red(`${passed}/${total} passed`)}\n`);
}

async function cmdMega(name) {
  const species = findSpecies(name);
  if (!species?.exists) {
    console.log(red(`\n  Species "${name}" not found.\n`));
    return;
  }

  const megas = LEGAL_MEGA_NAMES.filter(megaName => {
    const baseName = getBaseSpeciesName(megaName);
    const base = findSpecies(baseName);
    return base?.id === species.id;
  });

  console.log(`\n${line}`);
  console.log(bold(`  Mega forms for ${species.name}:`));

  if (megas.length === 0) {
    console.log(gray('  None in legal_mega.txt'));
  } else {
    for (const megaName of megas) {
      const megaId = getMegaDexId(megaName);
      const stone  = MEGA_STONE_MAP[megaId];
      const stoneStr = stone ? cyan(`@ ${stone}`) : gray('(no stone)');
      console.log(`  ${PASS}  ${purple(megaName)}  ${stoneStr}`);
    }
  }

  console.log(line + '\n');
}

async function cmdMoves(name) {
  const species = findSpecies(name);
  if (!species?.exists) {
    console.log(red(`\n  Species "${name}" not found.\n`));
    return;
  }

  const learnableIds = await getLearnset(species);
  const legalMoves = [...learnableIds]
    .map(id => Dex.moves.get(id))
    .filter(m => m?.exists && LEGAL_MOVES.has(normalize(m.name)))
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log(`\n${line}`);
  console.log(bold(`  ${species.name}`) + `  —  ${cyan(String(legalMoves.length))} legal moves`);
  console.log(line);

  const COL = 3;
  const WIDTH = 25;
  for (let i = 0; i < legalMoves.length; i += COL) {
    const row = legalMoves.slice(i, i + COL).map(m => m.name.padEnd(WIDTH)).join('');
    console.log('  ' + gray(row));
  }
  console.log();
}

async function cmdItem(itemName) {
  const normName = normalize(itemName);
  const inLegal  = LEGAL_ITEMS.has(normName);
  const isStone  = MEGA_STONE_NAMES.has(itemName) ||
    [...MEGA_STONE_NAMES].some(s => normalize(s) === normName);
  const item     = Dex.items.get(itemName);

  console.log(`\n${line}`);
  console.log(bold(`  Item: ${itemName}`));
  console.log(`  In legal_items.txt:  ${inLegal ? PASS : FAIL}`);
  console.log(`  In @pkmn/dex:        ${item?.exists ? PASS : FAIL}`);
  if (isStone) console.log(`  ${purple('★ Mega Stone')} (activated via Mega button, not item dropdown)`);
  console.log(line + '\n');
}

async function cmdLegal(name) {
  const species = findSpecies(name);
  if (!species?.exists) {
    console.log(red(`\n  Species "${name}" not found.\n`));
    return;
  }

  const isLegal = LEGAL_MONS.has(normalize(species.name));
  const learnableIds = await getLearnset(species);

  const legalMoves = [...learnableIds]
    .map(id => Dex.moves.get(id))
    .filter(m => m?.exists && LEGAL_MOVES.has(normalize(m.name)));

  const abilities = Object.values(species.abilities).filter(Boolean);

  const megas = LEGAL_MEGA_NAMES.filter(megaName => {
    const base = findSpecies(getBaseSpeciesName(megaName));
    return base?.id === species.id;
  });

  console.log(`\n${line}`);
  console.log(bold(`  ${species.name}`) + gray(` #${species.num}`) + `  ${species.types.join(' / ')}`);
  console.log(`  Legal:    ${isLegal ? PASS + '  in legal_mons.txt' : FAIL + '  NOT in legal_mons.txt'}`);
  console.log(`  Moves:    ${cyan(String(legalMoves.length))} legal moves available`);
  console.log(`  Abilities: ${abilities.map(a => cyan(a)).join(', ')}`);
  if (megas.length > 0) {
    console.log(`  Megas:    ${megas.map(m => purple(m)).join(', ')}`);
  } else {
    console.log(`  Megas:    ${gray('none')}`);
  }
  console.log(line + '\n');
}

const STAT_KEYS      = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const STAT_LABELS    = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
const CHAMPIONS_BUFF = 15; // Pokemon Champions adds +15 to every base stat

function champStat(key, dexBase) {
  const b     = dexBase + CHAMPIONS_BUFF;
  const inner = Math.floor((2 * b * 50) / 100);
  return key === 'hp' ? inner + 60 : inner + 5;
}

async function cmdStat(name, statArgs) {
  const species = findSpecies(name);
  if (!species?.exists) {
    console.log(red(`\n  Species "${name}" not found.\n`));
    return;
  }

  const base       = species.baseStats;
  const champBases = Object.fromEntries(STAT_KEYS.map(k => [k, (base[k] ?? 0) + CHAMPIONS_BUFF]));
  const champStats = Object.fromEntries(STAT_KEYS.map(k => [k, champStat(k, base[k] ?? 0)]));
  const dexBst     = STAT_KEYS.reduce((s, k) => s + (base[k] ?? 0), 0);
  const champBst   = STAT_KEYS.reduce((s, k) => s + champBases[k], 0);

  console.log(`\n${line}`);
  console.log(bold(`  ${species.name}`) + gray(` #${species.num}  ${species.types.join(' / ')}`));
  console.log(line);
  console.log(`  ${gray('     ')}  ${gray('Dex')}  ${gray('Champions base')}  ${gray('L50 (0 EV)')}`);
  console.log(line);
  for (const k of STAT_KEYS) {
    console.log(
      `  ${gray(STAT_LABELS[k].padEnd(4))}  ${gray(String(base[k] ?? 0).padStart(3))}` +
      `  ${cyan(String(champBases[k]).padStart(14))}  ${green(String(champStats[k]).padStart(10))}`
    );
  }
  console.log(`  ${gray('BST '.padEnd(4))}  ${gray(String(dexBst).padStart(3))}  ${cyan(String(champBst).padStart(14))}`);

  if (statArgs.length === 0) { console.log(); return; }

  // Compare provided numbers against Champions L50 stats (0 EV, neutral nature)
  const provided = statArgs.map(a => parseInt(a, 10));
  if (provided.some(isNaN)) {
    console.log(red('\n  All stat arguments must be numbers.\n'));
    process.exit(1);
  }

  console.log(line);
  console.log(gray('  Checking against Champions L50 (0 EV, neutral):'));
  console.log(line);

  let passed = 0;
  const checkCount = Math.min(provided.length, 6);
  for (let i = 0; i < checkCount; i++) {
    const k      = STAT_KEYS[i];
    const actual = champStats[k];
    const given  = provided[i];
    const ok     = actual === given;
    if (ok) passed++;
    if (ok) {
      console.log(`  ${PASS}  ${gray(STAT_LABELS[k].padEnd(4))}  ${green(String(given).padStart(3))}`);
    } else {
      console.log(`  ${FAIL}  ${gray(STAT_LABELS[k].padEnd(4))}  ${red(String(given).padStart(3))}  ${gray('(actual:')} ${cyan(String(actual).padStart(3))}${gray(')')}`);
    }
  }
  console.log(line);
  console.log(`  ${passed === checkCount ? green(`${passed}/${checkCount} passed`) : red(`${passed}/${checkCount} passed`)}\n`);
}

function printHelp() {
  console.log(`
${bold('Pokemon Champions Test CLI')}

${bold('Commands:')}
  ${cyan('pokemon')} <name> [move1] [move2] ...   Check if moves are legal & learnable
  ${cyan('ability')} <name> [ability1] ...         Check abilities for a Pokemon
  ${cyan('mega')}    <name>                        Show mega forms and their stones
  ${cyan('moves')}   <name>                        List all legal moves for a Pokemon
  ${cyan('item')}    <item name>                   Check if an item is legal
  ${cyan('stat')}    <name> [hp] [atk] [def] [spa] [spd] [spe] [bst]  Check base stats
  ${cyan('legal')}   <name>                        Full legality summary

${bold('Examples:')}
  npm test pokemon charizard flamethrower fly earthquake
  npm test pokemon garchomp "draco meteor" earthquake "scale shot"
  npm test ability gengar "shadow tag"
  npm test mega charizard
  npm test moves pikachu
  npm test item leftovers
  npm test item venusaurite
  npm test stat charizard 78 84 78 109 85 100
  npm test stat charizard 78 84 78 109 85 100 534
  npm test legal gardevoir

${bold('Tip:')} Multi-word names auto-resolve (e.g. draco meteor, air slash).
       You can also quote them: "draco meteor" or use hyphens: draco-meteor
`);
}

// ── Dispatch ──────────────────────────────────────────────────────────────────
const [,, command, ...args] = process.argv;

if (!command || command === 'help') {
  printHelp();
} else if (command === 'pokemon') {
  const [pokeName, ...moveArgs] = args;
  if (!pokeName) { console.log(red('Usage: pokemon <name> [moves...]')); process.exit(1); }
  await cmdPokemon(pokeName, moveArgs);
} else if (command === 'ability') {
  const [pokeName, ...abilArgs] = args;
  if (!pokeName) { console.log(red('Usage: ability <name> [abilities...]')); process.exit(1); }
  await cmdAbility(pokeName, abilArgs);
} else if (command === 'mega') {
  const pokeName = args.join(' ');
  if (!pokeName) { console.log(red('Usage: mega <name>')); process.exit(1); }
  await cmdMega(pokeName);
} else if (command === 'moves') {
  const pokeName = args.join(' ');
  if (!pokeName) { console.log(red('Usage: moves <name>')); process.exit(1); }
  await cmdMoves(pokeName);
} else if (command === 'item') {
  const itemName = args.join(' ');
  if (!itemName) { console.log(red('Usage: item <name>')); process.exit(1); }
  await cmdItem(itemName);
} else if (command === 'stat') {
  const [pokeName, ...statArgs] = args;
  if (!pokeName) { console.log(red('Usage: stat <name> [hp] [atk] [def] [spa] [spd] [spe] [bst]')); process.exit(1); }
  await cmdStat(pokeName, statArgs);
} else if (command === 'legal') {
  const pokeName = args.join(' ');
  if (!pokeName) { console.log(red('Usage: legal <name>')); process.exit(1); }
  await cmdLegal(pokeName);
} else {
  console.log(red(`\n  Unknown command: ${command}`));
  printHelp();
  process.exit(1);
}
