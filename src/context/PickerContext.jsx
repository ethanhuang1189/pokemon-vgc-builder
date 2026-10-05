import { createContext, useContext, useMemo, useState } from 'react';
import { useTeam } from './TeamContext';

// Bottom-sheet UI state: which slot is open and which sub-picker (species/item/ability/move/stats) shows.
const PickerContext = createContext(null);

const SPECIES_PICKER = { mode: 'species' };

export function PickerProvider({ children }) {
  const { team } = useTeam();
  const [activeSlotIndex, setActiveSlotIndex] = useState(null);
  // null = slot overview, otherwise { mode: 'species' | 'item' | 'ability' | 'move' | 'stats', moveIndex? }
  const [subPicker, setSubPicker] = useState(null);

  const value = useMemo(() => ({
    activeSlotIndex,
    subPicker,
    // An empty slot has nothing to edit yet, so it opens straight to the species picker.
    openSlot: (index) => {
      setActiveSlotIndex(index);
      setSubPicker(team[index]?.species ? null : SPECIES_PICKER);
    },
    closeSlot: () => { setActiveSlotIndex(null); setSubPicker(null); },
    openSubPicker: setSubPicker,
    closeSubPicker: () => setSubPicker(null),
  }), [activeSlotIndex, subPicker, team]);

  return <PickerContext.Provider value={value}>{children}</PickerContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const usePicker = () => useContext(PickerContext);
