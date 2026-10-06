# Pokémon Champions Team Builder

A mobile-first team builder for the Pokémon Champions VGC format (currently **Regulation M-C**).
Pick Pokémon, items, abilities, moves, natures and stat points, check type coverage against the
usage-stats meta, and export to Pokémon Showdown / PokéPaste. The **Battles** tab tracks your
Showdown games: sign in, link your Showdown names, and import replays for win rates and matchups.

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
    replay.js      replay ids, battle-log parsing → stored battle records
    battleStats.js record and per-Pokémon win rates
    bookmarklet.js the one-tap "save this battle" bookmarklet
  context/       FormatContext (static data), TeamContext, PickerContext (sheet UI), AuthContext (session)
  services/      the only code that talks to Supabase or /api
  hooks/         small React hooks (drag-reorder, learnable moves, meta stats, autofocus)
  components/    UI only — team/, sheet/, pickers/, stats/, analysis/, layout/
  utils/         browser-side helpers (storage, clipboard, meta fetch)
api/             Vercel functions: import-replay, sync-replays (thin wrappers over server/)
server/          server-only code: auth check, Showdown client, import logic, database access
supabase/        database schema and row-level security policies
tests/           node:test suite for regulations, domain logic, server and security guards
scripts/         legality CLI, sprite audit, stat-table generator, meta validator
  scraper/       Pikalytics scraper — its own package so the app install stays light
```

The rule of thumb: anything that can be expressed without React lives in `domain/` and has tests.

## Battle tracking setup

Battle tracking needs a free [Supabase](https://supabase.com) project and runs its API as
Vercel functions. Without the environment variables the Battles tab just says it isn't set up.

1. **Create a Supabase project**, open the SQL editor and run each file in
   `supabase/migrations/` in order (`0001_…`, then `0002_…`).
2. **Authentication → Sign In / Providers → Email:** keep email/password on, and turn on
   *Confirm email*. Under password settings set the **minimum length to 8 or more**. Supabase's
   default is 6. If you're on the Pro plan, turn on **leaked password protection**, which rejects
   passwords found in data breaches (HaveIBeenPwned).
3. **Authentication → URL Configuration:** set *Site URL* to your site (e.g. `https://vgc.builder`)
   and add it under *Redirect URLs*, so confirmation and reset links come back here.
4. **Vercel → Settings → Environment Variables** (and `.env.local` for `vercel dev`; see `.env.example`):
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are public and safe in the browser.
   - `SUPABASE_SECRET_KEY` is **server only**. Never give it a `VITE_` prefix, commit it, or
     paste it anywhere public.
5. Locally, `npm run dev` serves the app; the `/api` functions need `vercel dev`.

### Security design

- **Passwords never touch our code or database.** Supabase Auth stores them as salted bcrypt
  hashes, sends confirmation and reset emails, and rate-limits sign-in attempts. The app checks
  NIST-style rules before submitting (8+ characters, ≤72 bytes because bcrypt ignores the rest,
  not your email, no composition rules) and uses `autocomplete` so password managers work.
  Messages are generic, so they never reveal whether an email has an account.
- **Row-level security** limits every query from the browser to the signed-in user's own rows.
- **Battles can't be forged.** Browsers have no permission to insert battles. Only the
  `/api` functions can, after fetching the replay from Showdown's own server and checking that
  one of the user's linked names played it.
- **Sync** pages back through each linked name's public Showdown replays (up to 10 pages,
  ~500 games), imports oldest first in batches of 10, and records replays it can't use in
  `skipped_replays` so they aren't fetched again. The Battles tab syncs on open, at most every
  two minutes per browser.
- **The bookmarklet carries no secrets.** It presses Showdown's upload button and opens
  `/?import=<replay>`; everything else happens on our server.
- **Content-Security-Policy** (`vercel.json`) allows only our own scripts and the listed image
  and API hosts, and forbids framing. This limits what an injected script could do with a
  session token.
- `tests/security.test.js` fails `npm test` if the secret key appears in browser code, a table
  lacks row-level security, browsers gain write access to battles, or the CSP is loosened.

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
| `replay.test.js` | replay ids, battle-log parsing (real anonymized replay), stored records |
| `battleStats.test.js` | record and per-Pokémon win rates |
| `bookmarklet.test.js` | bookmarklet run against a fake Showdown page |
| `passwordPolicy.test.js` | password rules |
| `server.test.js` | API auth and errors, import/sync logic, Showdown client limits |
| `security.test.js` | secrets, row-level security, CSP guards |
| `validateMeta.test.js` | usage-stats validation in the update workflow |

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
