import { useState } from 'react';

/**
 * <img> that walks through `urls` until one loads; renders `fallback` once all fail.
 * Give it a `key` that changes with the subject so the walk restarts for new content.
 */
export default function FallbackImage({ urls, fallback = null, ...imgProps }) {
  const [index, setIndex] = useState(0);
  if (index >= urls.length) return fallback;
  return (
    <img
      {...imgProps}
      src={urls[index]}
      draggable="false"
      onError={() => setIndex(i => i + 1)}
    />
  );
}
