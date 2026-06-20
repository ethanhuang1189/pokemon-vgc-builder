import { createContext, useContext, useState, useCallback } from 'react';

const makeEmptySlot = () => ({
  species: null,
  nickname: '',
  item: null,
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

function deserializeTeam(raw, Dex, allMegas = []) {
  if (!raw || !Array.isArray(raw)) return makeDefaultTeam();
  return raw.map(rawSlot => {
    // Strip legacy megaFormId field
    const { megaFormId, ...slot } = rawSlot;

    let species = null;
    if (slot.species) {
      const dexSp = Dex.species.get(slot.species);
      if (dexSp?.exists) {
        species = dexSp;
      } else {
        // Custom mega not in @pkmn/dex — look up by Showdown name
        species = allMegas.find(m => m.name === slot.species) ?? null;
      }
    }

    // Migrate old saves: if megaFormId was set, restore mega species
    if (species && !species.isMega && megaFormId) {
      const mega = allMegas.find(m => m.id === megaFormId);
      if (mega) species = mega;
    }

    return {
      ...makeEmptySlot(),
      ...slot,
      species,
      moves: (slot.moves ?? [null, null, null, null]).map(m =>
        m ? (Dex.moves.get(m)?.exists ? Dex.moves.get(m) : null) : null
      ),
    };
  });
}

const TeamContext = createContext(null);

export function TeamProvider({ children, Dex, allMegas = [] }) {
  const [team, setTeamRaw] = useState(() => {
    try {
      const saved = localStorage.getItem('vgc-team');
      if (saved) return deserializeTeam(JSON.parse(saved), Dex, allMegas);
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
