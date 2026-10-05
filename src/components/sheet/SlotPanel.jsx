import { useMemo } from 'react';
import PokemonSprite from '../PokemonSprite';
import SlotSummary from '../team/SlotSummary';
import StatEditor from '../stats/StatEditor';
import SpeciesPicker from '../pickers/SpeciesPicker';
import MovePicker from '../pickers/MovePicker';
import AbilityPicker from '../pickers/AbilityPicker';
import ItemPicker from '../pickers/ItemPicker';
import { usePicker } from '../../context/PickerContext';
import { useTeam } from '../../context/TeamContext';
import { useFormat } from '../../context/FormatContext';
import { useLearnableMoves } from '../../hooks/useLearnableMoves.js';
import { withSpecies, withItem, withMove, nextEmptyMoveIndex } from '../../domain/slot.js';

function SpriteButton({ slot, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="shrink-0 w-14 flex items-center justify-center hover:bg-white/5 transition-colors">
      {slot.species
        ? <PokemonSprite species={slot.species} size={56} alt={slot.nickname || slot.species.name} />
        : <div className="w-14 h-14 bg-gray-800 border-2 border-dashed border-gray-700 flex items-center justify-center">
            <span className="text-gray-500 text-2xl">+</span>
          </div>}
    </button>
  );
}

const Hint = ({ children }) => (
  <div className="flex-1 flex items-center justify-center"><span className="text-gray-600 text-sm">{children}</span></div>
);

/** The open slot: a tappable summary card on top, the active sub-picker below. */
export default function SlotPanel() {
  const { activeSlotIndex: index, subPicker, openSubPicker } = usePicker();
  const { team, updateSlot } = useTeam();
  const { format } = useFormat();
  const slot = team[index];
  const learnableMoves = useLearnableMoves(slot?.species ?? null);

  const slotAbilities = useMemo(
    () => Object.values(slot?.species?.abilities ?? {}).map(format.getAbility).filter(Boolean),
    [slot?.species, format],
  );

  if (!slot) return null;

  const update = (change) => updateSlot(index, change);

  function selectMove(moveIndex, move) {
    update(s => withMove(s, moveIndex, move));
    // After filling an empty slot, jump straight to the next empty one.
    const wasEmpty = !slot.moves[moveIndex];
    const next = nextEmptyMoveIndex(slot.moves.map((m, i) => (i === moveIndex ? move : m)), moveIndex);
    if (move && wasEmpty && next !== -1) openSubPicker({ mode: 'move', moveIndex: next });
  }

  const mode = subPicker?.mode;
  const moveIndex = mode === 'move' ? subPicker.moveIndex : null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 flex items-stretch gap-2 px-3 py-2.5 border-b border-gray-800">
        <SpriteButton slot={slot} onClick={() => openSubPicker({ mode: 'species' })} />
        {slot.species ? (
          <SlotSummary slot={slot}
            onItemClick={() => openSubPicker({ mode: 'item' })}
            onAbilityClick={() => openSubPicker({ mode: 'ability' })}
            onStatsClick={() => openSubPicker({ mode: 'stats' })}
            onMoveClick={i => openSubPicker({ mode: 'move', moveIndex: i })}
            activeMoveIndex={moveIndex} />
        ) : (
          <div className="flex-1 flex items-center"><span className="text-gray-500 text-sm">Tap the sprite to add a Pokémon</span></div>
        )}
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        {!mode && <Hint>Tap a field above to edit</Hint>}
        {mode === 'species' && (
          <SpeciesPicker current={slot.species} onSelect={species => update(s => withSpecies(s, species, format))} />
        )}
        {mode === 'item' && (
          <ItemPicker options={format.items} current={slot.item} onSelect={item => update(s => withItem(s, item, format))} />
        )}
        {mode === 'ability' && (
          <AbilityPicker options={slotAbilities} current={slot.ability || null}
            onSelect={ability => update({ ability: ability?.name ?? '' })} />
        )}
        {mode === 'move' && (
          // Keyed by index so search state resets when the picker advances to the next move.
          <MovePicker key={moveIndex} options={learnableMoves} current={slot.moves[moveIndex]}
            ability={slot.ability || null} onSelect={move => selectMove(moveIndex, move)} />
        )}
        {mode === 'stats' && (
          <div className="overflow-y-auto flex-1 px-3 pt-3">
            <StatEditor key={slot.species?.id} slot={slot} onChange={update} />
            <div className="h-8" />
          </div>
        )}
      </div>
    </div>
  );
}
