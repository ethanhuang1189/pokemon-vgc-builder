import { createContext, useContext, useState, useEffect, useRef } from 'react';

const PickerContext = createContext(null);

async function buildMoveIndex(allSpecies, Dex) {
  const idx = new Map();
  for (const s of allSpecies) {
    const visited = new Set();
    const collect = async (id) => {
      if (!id || visited.has(id)) return;
      visited.add(id);
      const sp = Dex.species.get(id);
      if (!sp?.exists) return;
      const ls = await Dex.learnsets.get(sp.id);
      if (ls?.learnset) {
        for (const moveId of Object.keys(ls.learnset)) {
          if (!idx.has(moveId)) idx.set(moveId, new Set());
          idx.get(moveId).add(s.id);
        }
      }
      if (sp.changesFrom) await collect(sp.changesFrom);
      if (sp.prevo) await collect(sp.prevo);
    };
    await collect(s.id);
  }
  return idx;
}

export function PickerProvider({ children, allSpecies, allMoves, allItems, allAbilities, allMegas, Dex }) {
  const [activeSlotIndex, setActiveSlotIndex] = useState(null);
  // subPicker: null = slot panel, or { mode, moveIndex?, label?, options?, currentValue? }
  const [subPicker, setSubPicker] = useState(null);
  const moveIndexRef = useRef(null);
  const [moveIndexReady, setMoveIndexReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    buildMoveIndex(allSpecies, Dex).then(idx => {
      if (!cancelled) { moveIndexRef.current = idx; setMoveIndexReady(true); }
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <PickerContext.Provider value={{
      activeSlotIndex,
      subPicker,
      openSlot:       (i)      => { setActiveSlotIndex(i); setSubPicker(null); },
      closeSlot:      ()       => { setActiveSlotIndex(null); setSubPicker(null); },
      openSubPicker:  (config) => setSubPicker(config),
      closeSubPicker: ()       => setSubPicker(null),
      allSpecies, allMoves, allItems, allAbilities, allMegas, Dex,
      moveIndexRef, moveIndexReady,
    }}>
      {children}
    </PickerContext.Provider>
  );
}

export function usePicker() { return useContext(PickerContext); }
