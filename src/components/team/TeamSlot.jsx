import { useRef, useState } from 'react';
import PokemonSprite from '../PokemonSprite';
import SlotSummary from './SlotSummary';
import { CopyIcon, ShowdownIcon, DeleteIcon } from './icons';
import { useTeam } from '../../context/TeamContext';
import { usePicker } from '../../context/PickerContext';
import { exportToShowdown } from '../../domain/showdown.js';
import { copyText } from '../../utils/clipboard.js';

function useToast(durationMs = 2000) {
  const [message, setMessage] = useState('');
  const show = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(''), durationMs);
  };
  return [message, show];
}

// Press-and-move on the sprite starts a drag; a plain tap falls through to opening the slot.
function useSpriteDragGesture(onDragStart) {
  const held = useRef(false);
  const dragged = useRef(false);
  return {
    onPointerDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.stopPropagation();
      held.current = true;
      dragged.current = false;
    },
    onPointerMove(e) {
      if (!held.current) return;
      held.current = false;
      dragged.current = true;
      onDragStart(e.clientY);
    },
    onPointerUp() { held.current = false; },
    onPointerCancel() { held.current = false; },
    onClick(e) {
      if (dragged.current) { dragged.current = false; e.stopPropagation(); }
    },
  };
}

function SlotActions({ slot, onDelete, onToast }) {
  async function copy(label) {
    if (!slot.species) return onToast('No Pokémon');
    await copyText(exportToShowdown([slot]));
    onToast(label);
  }
  const buttonClass = 'p-1.5 transition-colors flex items-center justify-center';
  return (
    <div className="flex flex-col shrink-0 self-stretch justify-around"
      onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
      <button type="button" title="Copy Pokémon" onClick={() => copy('Copied!')}
        className={`${buttonClass} text-gray-400 hover:text-white`}><CopyIcon /></button>
      <button type="button" title="Copy Showdown format" onClick={() => copy('SD copied!')}
        className={`${buttonClass} text-gray-400 hover:text-white`}><ShowdownIcon /></button>
      <button type="button" title="Delete Pokémon" onClick={onDelete}
        className={`${buttonClass} text-gray-500 hover:text-red-400`}><DeleteIcon /></button>
    </div>
  );
}

export default function TeamSlot({ index, onDragStart }) {
  const { team, clearSlot } = useTeam();
  const { activeSlotIndex, openSlot } = usePicker();
  const [toast, showToast] = useToast();
  const spriteGesture = useSpriteDragGesture(onDragStart);
  const slot = team[index];

  return (
    <div className={`bg-gray-800 border overflow-hidden transition-colors ${activeSlotIndex === index ? 'border-indigo-500' : 'border-gray-700'}`}>
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none" onClick={() => openSlot(index)}>
        <div className="w-12 shrink-0 flex items-center justify-center self-stretch touch-none cursor-grab active:cursor-grabbing"
          {...spriteGesture}>
          {slot.species
            ? <PokemonSprite species={slot.species} size={48} alt={slot.nickname || slot.species.name} />
            : <div className="w-10 h-10 bg-gray-700 border-2 border-dashed border-gray-600 flex items-center justify-center">
                <span className="text-gray-500 text-lg">+</span>
              </div>}
        </div>

        {slot.species
          ? <SlotSummary slot={slot} />
          : <span className="flex-1 text-gray-500 text-sm">Slot {index + 1}</span>}

        {toast && <span className="text-[10px] text-green-400 shrink-0">{toast}</span>}
        <SlotActions slot={slot} onDelete={() => clearSlot(index)} onToast={showToast} />
      </div>
    </div>
  );
}
