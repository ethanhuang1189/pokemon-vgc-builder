import FallbackImage from './FallbackImage';
import { itemSpriteUrls } from '../domain/sprites.js';

export default function ItemSprite({ item, size = 20 }) {
  const placeholder = <span className="shrink-0" style={{ width: size, height: size }} />;
  if (!item) return placeholder;
  return (
    <FallbackImage
      key={item.id}
      urls={itemSpriteUrls(item)}
      fallback={placeholder}
      alt=""
      loading="lazy"
      className="object-contain shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
