import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createLearnsets } from '../domain/learnsets.js';

// Static data for the active regulation (species, items, moves, lookups) plus learnset queries.
const FormatContext = createContext(null);

export function FormatProvider({ format, Dex, children }) {
  const learnsets = useMemo(() => createLearnsets(Dex, format), [Dex, format]);
  // moveId → Set(speciesId); null until built in the background.
  const [moveIndex, setMoveIndex] = useState(null);

  useEffect(() => {
    let cancelled = false;
    learnsets.buildMoveIndex().then(index => { if (!cancelled) setMoveIndex(index); });
    return () => { cancelled = true; };
  }, [learnsets]);

  const value = useMemo(() => ({ format, Dex, learnsets, moveIndex }), [format, Dex, learnsets, moveIndex]);
  return <FormatContext.Provider value={value}>{children}</FormatContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useFormat = () => useContext(FormatContext);
