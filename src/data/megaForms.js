import legalMegaRaw from '../../legal_mega.txt?raw';

// Maps mega dex ID → canonical mega stone name
const MEGA_STONE_MAP = {
  venusaurmega:        'Venusaurite',
  charizardmegax:      'Charizardite X',
  charizardmegay:      'Charizardite Y',
  blastoisemega:       'Blastoisinite',
  beedrillmega:        'Beedrillite',
  pidgeotmega:         'Pidgeotite',
  clefablemega:        'Clefablite',
  alakazammega:        'Alakazite',
  victreebelmega:      'Victreebelite',
  slowbromega:         'Slowbronite',
  gengarmega:          'Gengarite',
  kangaskhanmega:      'Kangaskhanite',
  starmiemega:         'Starminite',
  pinsirmega:          'Pinsirite',
  gyaradosmega:        'Gyaradosite',
  aerodactylmega:      'Aerodactylite',
  dragonitemega:       'Dragoninite',
  meganiummega:        'Meganiumite',
  feraligatrmega:      'Feraligite',
  ampharosmega:        'Ampharosite',
  steelixmega:         'Steelixite',
  scizormega:          'Scizorite',
  heracrossmega:       'Heracronite',
  skarmorymega:        'Skarmorite',
  houndoommega:        'Houndoominite',
  tyranitarmega:       'Tyranitarite',
  gardevoirmega:       'Gardevoirite',
  sableyemega:         'Sablenite',
  aggronmega:          'Aggronite',
  medichammega:        'Medichamite',
  manectricmega:       'Manectite',
  sharpedomega:        'Sharpedonite',
  cameruptmega:        'Cameruptite',
  altariamega:         'Altarianite',
  banettemega:         'Banettite',
  chimechomega:        'Chimechite',
  absolmega:           'Absolite',
  glaliemega:          'Glalitite',
  lopunnymega:         'Lopunnite',
  garchompmega:        'Garchompite',
  lucariomega:         'Lucarionite',
  abomasnowmega:       'Abomasite',
  gallademega:         'Galladite',
  froslassmega:        'Froslassite',
  emboarmega:          'Emboarite',
  excadrillmega:       'Excadrite',
  audinomega:          'Audinite',
  chandeluremega:      'Chandelurite',
  golurkmega:          'Golurkite',
  chesnaughtmega:      'Chesnaughtite',
  delphoxmega:         'Delphoxite',
  greninjamega:        'Greninjite',
  floettemega:         'Floettite',
  meowsticmalemega:    'Meowsticite',
  meowsticfemalemega:  'Meowsticite',
  hawluchamega:        'Hawluchanite',
  crabominablemega:    'Crabominite',
  drampamega:          'Drampanite',
  scovillainmega:      'Scovillainite',
  glimmoramega:        'Glimmoranite',
  raichuxmega:         'Raichunite X',
  raichuymega:         'Raichunite Y',
  sceptilemega:        'Sceptilite',
  blazikenmega:        'Blazikenite',
  swampertmega:        'Swampertite',
  mawilemega:          'Mawilite',
  metagrossmega:       'Metagrossite',
  staraptormega:       'Staraptite',
  scolipedemega:       'Scolipite',
  scraftymega:         'Scraftinite',
  eelektrossmega:      'Eelektrossite',
  pyroarmega:          'Pyroarite',
  malamarmega:         'Malamarite',
  barbaraclemega:      'Barbaracite',
  dragalgemega:        'Dragalgite',
  falinksmega:         'Falinksite',
};

export const MEGA_STONE_NAMES = new Set(Object.values(MEGA_STONE_MAP));

// "Mega Venusaur" → "Venusaur-Mega", "Mega Charizard X" → "Charizard-Mega-X"
export function toShowdownMegaName(megaName) {
  const base = megaName.replace(/^Mega /, '');
  const xy = base.match(/^(.+?)\s+([XY])$/);
  if (xy) return `${xy[1]}-Mega-${xy[2]}`;
  const form = base.match(/^(.+?)\s+\((.+)\)$/);
  if (form) return `${form[1]}-Mega-${form[2]}`;
  return `${base}-Mega`;
}

function parseMegaNames(raw) {
  return raw.split('\n').map(s => s.trim()).filter(Boolean);
}

function getBaseSpeciesName(megaName) {
  const base = megaName.replace(/^Mega /, '');
  if (base.startsWith('Charizard')) return 'Charizard';
  if (base === 'Raichu X' || base === 'Raichu Y') return 'Raichu';
  if (base === 'Meowstic (Male)') return 'Meowstic';
  if (base === 'Meowstic (Female)') return 'Meowstic-F';
  return base;
}

function getMegaDexId(megaName) {
  const base = megaName.replace(/^Mega /, '');
  if (base === 'Charizard X') return 'charizardmegax';
  if (base === 'Charizard Y') return 'charizardmegay';
  if (base === 'Raichu X') return 'raichuxmega';
  if (base === 'Raichu Y') return 'raichuymega';
  return base.toLowerCase().replace(/[^a-z0-9]/g, '') + 'mega';
}

// Converts @pkmn/dex id to Showdown sprite path segment
// e.g. venusaurmega → venusaur-mega, charizardmegax → charizard-mega-x
export function toShowdownId(dexId) {
  if (dexId === 'raichuxmega') return 'raichu-mega-x';
  if (dexId === 'raichuymega') return 'raichu-mega-y';
  return dexId
    .replace(/mega([xy])$/, '-mega-$1')
    .replace(/mega$/, '-mega');
}

export function buildMegaForms(Dex) {
  const megaNames = parseMegaNames(legalMegaRaw);
  const seen = new Set();

  return megaNames.flatMap(megaName => {
    const megaId = getMegaDexId(megaName);
    if (seen.has(megaId)) return [];
    seen.add(megaId);

    const baseName = getBaseSpeciesName(megaName);
    const baseSpecies = Dex.species.get(baseName);
    if (!baseSpecies?.exists) return [];

    const megaDex = Dex.species.get(megaId);
    const source = megaDex?.exists ? megaDex : baseSpecies;

    return [{
      name:            toShowdownMegaName(megaName),  // e.g. "Charizard-Mega-X"
      id:              megaId,
      num:             baseSpecies.num,
      types:           source.types,
      abilities:       source.abilities,
      baseStats:       source.baseStats ?? baseSpecies.baseStats,
      exists:          true,
      isMega:          true,
      baseId:          baseSpecies.id,
      baseSpeciesName: baseSpecies.name,
      stoneItem:       MEGA_STONE_MAP[megaId] ?? null,
    }];
  });
}
