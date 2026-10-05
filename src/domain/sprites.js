import { toId } from './ids.js';
import { pokespritePath } from './pokespriteItems.js';

// Sprite URL fallback chains. Components try each URL in order until one loads.
// Primary source: Project Pokémon's sprite index — https://projectpokemon.org/home/docs/spriteindex_148/

const PROJECT_POKEMON = 'https://projectpokemon.org/images';
const SHOWDOWN = 'https://play.pokemonshowdown.com/sprites';
const OFFICIAL_ART = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';

// Highest dex number each Project Pokémon animated set covers (megas use their base number).
const LAST_3DS_MODEL = 809; // 3D-model GIFs: Gen 1–7 + megas
const LAST_SWSH_MODEL = 898; // Sword/Shield GIFs: through Gen 8

/**
 * Project Pokémon file name: lowercase, spaces and separators as "-", apostrophes dropped,
 * dots kept ("mr.mime"), and lettered megas glued together ("charizard-megax", "absol-megaz").
 */
export function projectPokemonSlug(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['’‘:]/g, '')
    .replace(/\.\s+/g, '.')
    .replace(/\s+/g, '-')
    .replace(/-mega-([xyz])$/, '-mega$1');
}

/** Showdown sprite id: base species id plus forme id ("Absol-Mega-Z" → "absol-megaz"). */
export function showdownSpriteId(species) {
  const base = toId(species.dexBaseSpecies ?? species.name);
  const forme = toId(species.forme);
  return forme ? `${base}-${forme}` : base;
}

/** Project Pokémon SV HOME file: zero-padded dex number plus forme index ("0931_01"). */
export function svHomeFileName(species) {
  const num = String(species.num).padStart(4, '0');
  return species.formeIndex > 0 ? `${num}_${String(species.formeIndex).padStart(2, '0')}` : num;
}

/** Sprite URLs that depict exactly this species/forme. */
export function ownSpriteUrls(species) {
  const slug = projectPokemonSlug(species.name);
  const showdownId = showdownSpriteId(species);
  return [
    species.num <= LAST_3DS_MODEL && `${PROJECT_POKEMON}/normal-sprite/${slug}.gif`,
    species.num <= LAST_SWSH_MODEL && `${PROJECT_POKEMON}/sprites-models/swsh-normal-sprites/${slug}.gif`,
    `${PROJECT_POKEMON}/sprites-models/sv-sprites-home/${svHomeFileName(species)}.png`,
    `${SHOWDOWN}/ani/${showdownId}.gif`,
    `${SHOWDOWN}/gen5/${showdownId}.png`,
  ].filter(Boolean);
}

/**
 * Every sprite URL to try for a format species, best first. Megas fall back to their
 * base forme's sprites, and official artwork is the last resort.
 */
export function pokemonSpriteUrls(species, getBaseOf = () => null) {
  if (!species) return [];
  const base = species.isMega ? getBaseOf(species) : null;
  const urls = [
    ...ownSpriteUrls(species),
    ...(base ? ownSpriteUrls(base) : []),
    `${OFFICIAL_ART}/${species.num}.png`,
  ];
  return [...new Set(urls)];
}

const POKESPRITE_ITEMS = 'https://raw.githubusercontent.com/msikma/pokesprite/master/items';
const SEREBII_ITEMS = 'https://www.serebii.net/itemdex/sprites';

/** Item icon URLs: pokesprite (by item number) first, Serebii (by id) for newer items. */
export function itemSpriteUrls(item) {
  if (!item) return [];
  const path = pokespritePath(item.num);
  return [path && `${POKESPRITE_ITEMS}/${path}.png`, `${SEREBII_ITEMS}/${item.id}.png`].filter(Boolean);
}
