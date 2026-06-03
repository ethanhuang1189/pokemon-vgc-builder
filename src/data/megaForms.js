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
};

export const MEGA_STONE_NAMES = new Set(Object.values(MEGA_STONE_MAP));

function parseMegaNames(raw) {
  return raw.split('\n').map(s => s.trim()).filter(Boolean);
}

function getBaseSpeciesName(megaName) {
  const base = megaName.replace(/^Mega /, '');
  if (base.startsWith('Charizard')) return 'Charizard';
  if (base === 'Meowstic (Male)') return 'Meowstic';
  if (base === 'Meowstic (Female)') return 'Meowstic-F';
  return base;
}

function getMegaDexId(megaName) {
  const base = megaName.replace(/^Mega /, '');
  if (base === 'Charizard X') return 'charizardmegax';
  if (base === 'Charizard Y') return 'charizardmegay';
  return base.toLowerCase().replace(/[^a-z0-9]/g, '') + 'mega';
}

// Converts @pkmn/dex id to Showdown CDN sprite path segment
// e.g. venusaurmega → venusaur-mega, charizardmegax → charizard-mega-x
export function toShowdownId(dexId) {
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
      name: megaName,
      id: megaId,
      num: baseSpecies.num,
      types: source.types,
      abilities: source.abilities,
      baseStats: source.baseStats ?? baseSpecies.baseStats,
      exists: true,
      isMega: true,
      baseId: baseSpecies.id,
      stoneItem: MEGA_STONE_MAP[megaId] ?? null,
    }];
  });
}
