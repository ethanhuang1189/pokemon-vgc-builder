import { useCallback, useRef, useState } from 'react';
import { nearestIndex, dragOffset } from '../utils/dragMath.js';

/**
 * Pointer-driven drag-to-reorder for a vertical list of `count` items.
 * Returns refs to attach, a `startDrag(index, clientY)` handler and per-item styles.
 */
export function useDragReorder(count, onReorder) {
  const [drag, setDrag] = useState(null); // { fromIdx, toIdx, deltaY, tops, heights }
  // Skips the transition for the commit frame so items don't slide back before the reorder paints.
  const [suppressTransition, setSuppressTransition] = useState(false);
  const itemRefs = useRef([]);

  const startDrag = useCallback((fromIdx, startY) => {
    const tops = [];
    const heights = [];
    for (let i = 0; i < count; i++) {
      const rect = itemRefs.current[i]?.getBoundingClientRect();
      if (rect) { tops[i] = rect.top; heights[i] = rect.height; }
    }
    setDrag({ fromIdx, toIdx: fromIdx, deltaY: 0, tops, heights });

    const targetAt = (clientY) => nearestIndex(fromIdx, clientY - startY, tops, heights);

    function onMove(e) {
      setDrag(d => d && { ...d, deltaY: e.clientY - startY, toIdx: targetAt(e.clientY) });
    }
    function onUp(e) {
      const toIdx = targetAt(e.clientY);
      if (toIdx !== fromIdx) onReorder(fromIdx, toIdx);
      setSuppressTransition(true);
      setDrag(null);
      requestAnimationFrame(() => setSuppressTransition(false));
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [count, onReorder]);

  const itemStyle = (i) => {
    const isDragging = drag?.fromIdx === i;
    return {
      position: 'relative',
      transform: drag ? `translateY(${dragOffset(i, drag)}px)` : 'none',
      zIndex: isDragging ? 20 : 'auto',
      opacity: isDragging ? 0.85 : 1,
      transition: isDragging || suppressTransition ? 'none' : 'transform 0.18s ease',
      boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.5)' : 'none',
    };
  };

  const itemRef = (i) => (el) => { itemRefs.current[i] = el; };

  return { itemRef, itemStyle, startDrag };
}
