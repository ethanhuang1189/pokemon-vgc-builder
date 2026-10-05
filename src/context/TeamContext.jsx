import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useFormat } from './FormatContext';
import { makeEmptySlot } from '../domain/slot.js';
import { makeEmptyTeam, reorderTeam } from '../domain/team.js';
import { loadTeam, saveTeam } from '../utils/teamStorage.js';

// The six team slots, persisted to localStorage.
const TeamContext = createContext(null);

export function TeamProvider({ children }) {
  const { format } = useFormat();
  const [team, setTeam] = useState(() => loadTeam(format));

  useEffect(() => { saveTeam(team); }, [team]);

  /** `change` is either a partial slot or a function slot → new slot (see domain/slot.js). */
  const updateSlot = useCallback((index, change) => {
    setTeam(prev => prev.map((slot, i) => {
      if (i !== index) return slot;
      return typeof change === 'function' ? change(slot) : { ...slot, ...change };
    }));
  }, []);

  const clearSlot = useCallback((index) => updateSlot(index, makeEmptySlot()), [updateSlot]);
  const clearTeam = useCallback(() => setTeam(makeEmptyTeam()), []);
  const replaceTeam = useCallback((next) => setTeam(next), []);
  const reorderSlot = useCallback((from, to) => setTeam(prev => reorderTeam(prev, from, to)), []);

  const value = useMemo(
    () => ({ team, updateSlot, clearSlot, clearTeam, replaceTeam, reorderSlot }),
    [team, updateSlot, clearSlot, clearTeam, replaceTeam, reorderSlot],
  );
  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTeam = () => useContext(TeamContext);
