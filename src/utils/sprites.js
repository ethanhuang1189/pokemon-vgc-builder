export function nameToSlug(name) {
  return name
    .replace(/♀/g, '-f').replace(/♂/g, '-m')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['''..:]/g, '').replace(/\s+/g, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export const GIF_SPRITE      = n   => `https://projectpokemon.org/images/normal-sprite/${nameToSlug(n)}.gif`;
export const SWSH_SPRITE     = n   => `https://projectpokemon.org/images/sprites-models/swsh-normal-sprites/${nameToSlug(n)}.gif`;
export const SHOWDOWN_GIF    = n   => `https://play.pokemonshowdown.com/sprites/ani/${nameToSlug(n)}.gif`;
export const SHOWDOWN_STATIC = n   => `https://play.pokemonshowdown.com/sprites/dex/${nameToSlug(n)}.png`;
export const STATIC_SPRITE   = num => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${num}.png`;

export function handleSpriteError(e, name, num) {
  const src = e.target.src;
  if (src.includes('normal-sprite/')) e.target.src = SWSH_SPRITE(name);
  else if (src.includes('swsh-normal-sprites/')) e.target.src = SHOWDOWN_GIF(name);
  else if (src.includes('/sprites/ani/')) e.target.src = SHOWDOWN_STATIC(name);
  else e.target.src = STATIC_SPRITE(num);
}
