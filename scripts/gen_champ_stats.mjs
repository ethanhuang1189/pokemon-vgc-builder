// Writes champions_stats.txt: Champions base stats (dex stats + 15) for every legal Pokémon.
// Edit the output for any Pokémon whose in-game Champions stats differ from this baseline.
//   node scripts/gen_champ_stats.mjs [regulation id]
import { Dex } from '@pkmn/dex';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildFormat } from '../src/domain/format.js';
import { CHAMPIONS, STAT_KEYS } from '../src/domain/stats.js';
import { CURRENT_REGULATION, getRegulation } from '../src/regulations/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const regId = process.argv[2];
const format = buildFormat(regId ? getRegulation(regId) : CURRENT_REGULATION, Dex);

const lines = [
  `# Pokémon Champions base stats (${format.regulation.label}) — HP Atk Def SpA SpD Spe`,
  `# Baseline: standard dex stats + ${CHAMPIONS.BASE_STAT_BUFF}`,
  '# Edit lines where the actual Champions game shows different values',
  '',
  ...format.species.map(s => [s.name, ...STAT_KEYS.map(k => s.baseStats[k] + CHAMPIONS.BASE_STAT_BUFF)].join(' ')),
];

writeFileSync(join(ROOT, 'champions_stats.txt'), `${lines.join('\n')}\n`);
console.log(`Written champions_stats.txt — ${format.species.length} Pokémon`);
