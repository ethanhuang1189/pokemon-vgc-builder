// Geometry for drag-to-reorder lists. `tops`/`heights` are each item's measured layout, by index.

const center = (tops, heights, i) => tops[i] + heights[i] / 2;

/** Index of the item whose center is nearest the dragged item's center after moving `deltaY`. */
export function nearestIndex(fromIdx, deltaY, tops, heights) {
  if (tops[fromIdx] === undefined) return fromIdx;
  const dragCenter = center(tops, heights, fromIdx) + deltaY;
  let best = fromIdx;
  let bestDist = Infinity;
  tops.forEach((top, i) => {
    if (top === undefined) return;
    const dist = Math.abs(dragCenter - center(tops, heights, i));
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  return best;
}

/** Vertical offset (px) for item `i` while `drag` is in progress, so the others make room. */
export function dragOffset(i, drag, fallbackHeight = 60) {
  if (!drag) return 0;
  const { fromIdx, toIdx, deltaY, heights } = drag;
  if (i === fromIdx) return deltaY;
  const gap = heights[fromIdx] ?? fallbackHeight;
  if (toIdx > fromIdx && i > fromIdx && i <= toIdx) return -gap;
  if (toIdx < fromIdx && i < fromIdx && i >= toIdx) return gap;
  return 0;
}
