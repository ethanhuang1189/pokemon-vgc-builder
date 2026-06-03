import { createContext, useContext, useState, useCallback } from 'react';

const makeEmptySlot = () => ({
  species: null,
  nickname: '',
  item: null,
  megaFormId: null,
  ability: '',
  nature: 'Hardy',
  moves: [null, null, null, null],
  evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
});

const makeDefaultTeam = () => Array.from({ length: 6 }, makeEmptySlot);

function serializeTeam(team) {
  return team.map(slot => ({
    ...slot,
    species: slot.species?.name ?? null,
    moves: slot.moves.map(m => m?.name ?? null),
  }));
}

function deserializeTeam(raw, Dex) {
  if (!raw || !Array.isArray(raw)) return makeDefaultTeam();
  return raw.map(slot => ({
    ...makeEmptySlot(),
    ...slot,
    species: slot.species ? (Dex.species.get(slot.species)?.exists ? Dex.species.get(slot.species) : null) : null,
    moves: (slot.moves ?? [null, null, null, null]).map(m =>
      m ? (Dex.moves.get(m)?.exists ? Dex.moves.get(m) : null) : null
    ),
  }));
}

const TeamContext = createContext(null);

export function TeamProvider({ children, Dex }) {
  const [team, setTeamRaw] = useState(() => {
    try {
      const saved = localStorage.getItem('vgc-team');
      if (saved) return deserializeTeam(JSON.parse(saved), Dex);
    } catch { /* ignore */ }
    return makeDefaultTeam();
  });

  const setTeam = useCallback((updater) => {
    setTeamRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem('vgc-team', JSON.stringify(serializeTeam(next)));
      } catch { /* ignore quota errors */ }
      return next;
    });
  }, []);

  const updateSlot = useCallback((i, updates) => {
    setTeam(prev => prev.map((s, idx) => idx === i ? { ...s, ...updates } : s));
  }, [setTeam]);

  const clearSlot = useCallback((i) => {
    setTeam(prev => prev.map((s, idx) => idx === i ? makeEmptySlot() : s));
  }, [setTeam]);

  const clearTeam = useCallback(() => {
    setTeam(makeDefaultTeam());
  }, [setTeam]);

  const reorderSlot = useCallback((fromIdx, toIdx) => {
    setTeam(prev => {
      const next = [...prev];
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      return next;
    });
  }, [setTeam]);

  return (
    <TeamContext.Provider value={{ team, updateSlot, clearSlot, clearTeam, reorderSlot, Dex }}>
      {children}
    </TeamContext.Provider>
  );
}

export const useTeam = () => useContext(TeamContext);
export { makeEmptySlot };
