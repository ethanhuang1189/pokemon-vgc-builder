import { useMemo } from 'react';
import FallbackImage from './FallbackImage';
import { useFormat } from '../context/FormatContext';
import { pokemonSpriteUrls } from '../domain/sprites.js';

// Soft light cone drawn behind mega evolutions. `size` is the sprite's box in px.
function MegaGlow({ size }) {
  return (
    <div className="absolute pointer-events-none"
      style={{ top: 0, left: '50%', transform: 'translateX(-50%)', filter: 'blur(4px)', zIndex: 0 }}>
      <div style={{
        width: size * 1.25,
        height: size * 1.3,
        clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
        background: 'linear-gradient(to bottom, rgba(255,255,215,0.3) 0%, rgba(255,255,215,0) 100%)',
      }} />
    </div>
  );
}

/** A species sprite with the full fallback chain; megas get a glow unless `glow` is false. */
export default function PokemonSprite({ species, size = 48, glow = true, lazy = false, alt, className = '' }) {
  const { format } = useFormat();
  const urls = useMemo(() => pokemonSpriteUrls(species, format.getBaseOf), [species, format]);
  if (!species) return null;

  return (
    <span className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      {glow && species.isMega && <MegaGlow size={size} />}
      <FallbackImage
        key={species.id}
        urls={urls}
        alt={alt ?? species.name}
        title={alt ?? species.name}
        loading={lazy ? 'lazy' : undefined}
        className={`object-contain relative ${className}`}
        style={{ width: size, height: size, zIndex: 1 }}
      />
    </span>
  );
}
