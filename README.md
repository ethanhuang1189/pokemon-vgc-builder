# Pokémon Champions Team Builder

A mobile-first team builder for the Pokémon Champions VGC format (currently **Regulation M-C**).
Pick Pokémon, items, abilities, moves, natures and stat points, check type coverage against the
usage-stats meta, and export to Pokémon Showdown / PokéPaste.

```bash
npm install
npm run dev          # start the app
npm test             # run the test suite
npm run lint
npm run build
```

## Project layout

```
src/
  regulations/   What is legal in each regulation (pure data) — see "Adding a regulation"
  domain/        Pure game logic, no React; shared by the app, tests and scripts
    format.js      regulation + @pkmn/dex → species/items/moves lists and lookups
    slot.js        slot state transitions (pick species, hold item → mega evolve, set move)
    team.js        save/load (with sanitizing + legacy migration), reorder
    stats.js       Champions stat rules, natures, EV budget
    typeChart.js   effectiveness incl. ability immunities / modifiers
    analysis.js    coverage, weaknesses, meta-threat analysis
    showdown.js    paste import/export
    learnsets.js   learnable moves (walks pre-evolutions, applies regulation additions)
    search.js      picker filtering
    sprites.js     sprite URL fallback chains
  context/       FormatContext (static data), TeamContext (team state), PickerContext (sheet UI)
  hooks/         small React hooks (drag-reorder, learnable moves, meta stats, autofocus)
  components/    UI only — team/, sheet/, pickers/, stats/, analysis/, layout/
  utils/         browser-side helpers (storage, clipboard, meta fetch)
tests/           node:test suite for regulations and domain logic
scripts/         legality CLI, sprite audit, stat-table generator, meta validator
  scraper/       Pikalytics scraper — its own package so the app install stays light
```

The rule of thumb: anything that can be expressed without React lives in `domain/` and has tests.

## Adding a regulation

1. Create `src/regulations/regMD.js` listing only what changed:

   ```js
   import regMC from './regMC.js';
   import { extendRegulation } from './extend.js';

   export default extendRegulation(regMC, {
     id: 'M-D',
     label: 'Regulation M-D (Pokémon Champions)',
     add: {
       pokemon: ['Dragonite'],          // exact @pkmn/dex names, one entry per forme
       megas: ['Dragonite-Mega'],       // each mega's stone must also be in items
       items: ['Choice Band'],
       moves: ['Dragon Claw'],
     },
     remove: { items: ['Leek'] },
     learnsetAdditions: { dragonitemega: ['extremespeed'] }, // optional
   });
   ```

2. Register it in `src/regulations/index.js` and point `CURRENT_REGULATION` at it.
3. `npm test` — validates every name against the dex, checks each mega has its stone and base
   species, and catches typos (adding something already legal, removing something that isn't).
4. `npm run check -- diff M-C` to review the changes, and `npm run check:sprites` (needs network)
   to confirm every new Pokémon and item has art.

Names are Showdown/@pkmn names: `Persian-Alola`, `Toxtricity-Low-Key`, `Indeedee-F`,
`Squawkabilly-Blue`, `Absol-Mega-Z`. Use `npm run check -- legal <name>` if unsure.

## Tests

`npm test` runs everything in `tests/` with Node's built-in test runner (no extra dependencies):

| File | Covers |
| --- | --- |
| `regulations.test.js` | regulation data validity, Reg C additions, `extendRegulation` rules |
| `format.test.js` | species/mega/item resolution, name lookups, stone → mega mapping |
| `slot.test.js` | species changes, mega evolution via items, move edits |
| `team.test.js` | save/load sanitizing, legacy save migration, reordering |
| `showdown.test.js` | paste export/import round-trips and malformed input |
| `stats.test.js` | Champions stat formula, EV budget, nature slider logic |
| `typeChart.test.js` | effectiveness, ability immunities and modifiers |
| `analysis.test.js` | coverage, weaknesses, meta analysis |
| `learnsets.test.js` | pre-evolution moves, mega learnsets, regulation additions |
| `sprites.test.js` | sprite file naming and fallback order |
| `search.test.js` | picker filters, "resist:" search, drag-reorder math |

Run one file with `node --test tests/showdown.test.js`.

## Legality CLI

`npm run check -- <command>` checks data against the current regulation (add `--reg=M-B` for another):

```
pokemon <name> [moves...]   are these moves legal and learnable?
ability <name> [abilities]  does it have these abilities?
mega <name>                 legal megas and their stones
moves <name>                every legal move it learns
item <name>                 is the item legal / which mega does it make?
stat <name> [hp atk ...]    Champions base and level-50 stats, optionally checked
legal <name>                full summary
diff <from> [to]            what changed between regulations
```

Multi-word names can be quoted or typed plainly: `npm run check -- pokemon garchomp draco meteor earthquake`.

## Sprites

Pokémon sprites come from the [Project Pokémon sprite index](https://projectpokemon.org/home/docs/spriteindex_148/):
3D-model GIFs (Gen 1–7 and megas), Sword/Shield GIFs (Gen 8), then SV HOME renders (all
Pokémon and formes). Pokémon Showdown sprites cover the Champions / Legends Z-A megas the index
doesn't have yet; official artwork is the last resort. Item icons come from pokesprite, with Serebii
for newer stones.

## Usage stats

`.github/workflows/update-meta.yml` scrapes Pikalytics daily into `src/data/metaStats.json`; the
app fetches the latest committed copy and falls back to the bundled one.

The workflow is split so third-party code never holds write access:

- **scrape** (read-only token) installs `scripts/scraper` from its lockfile with
  `npm ci --ignore-scripts` and drives the runner's preinstalled Chrome via `puppeteer-core`.
- **commit** (the only job that can push) installs nothing; it runs `scripts/validate-meta.mjs`
  on the scraped file and commits only `metaStats.json`.

Actions are pinned to commit SHAs and Dependabot (`.github/dependabot.yml`) opens weekly update PRs.
To run the scraper locally: `cd scripts/scraper && npm ci --ignore-scripts && npm run scrape`
(set `CHROME_PATH` if Chrome isn't in a standard location).
