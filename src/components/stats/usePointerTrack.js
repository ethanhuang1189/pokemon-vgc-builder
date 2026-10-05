// Pointer handlers for a horizontal control. Pointer capture keeps one finger's drag from
// bleeding into neighbouring sliders on iOS. `onFraction` receives the 0–1 position.
export function usePointerTrack(ref, onFraction) {
  const fractionAt = (clientX) => {
    const rect = ref.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };
  return {
    onPointerDown(e) {
      e.currentTarget.setPointerCapture(e.pointerId);
      onFraction(fractionAt(e.clientX));
    },
    onPointerMove(e) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) onFraction(fractionAt(e.clientX));
    },
    onPointerUp(e) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    },
  };
}
