import { useEffect, useRef } from 'react';

/** A ref that focuses its element shortly after mount (after the sheet's open animation). */
export function useAutoFocus(delayMs = 80) {
  const ref = useRef(null);
  useEffect(() => {
    const timer = setTimeout(() => ref.current?.focus(), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);
  return ref;
}
