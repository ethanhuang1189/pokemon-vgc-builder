import PokemonSprite from '../PokemonSprite';
import { usePicker } from '../../context/PickerContext';
import { useTeam } from '../../context/TeamContext';

export default function TeamTabs() {
  const { activeSlotIndex, openSlot } = usePicker();
  const { team } = useTeam();
  return (
    <div className="flex shrink-0 border-b-2 border-gray-800 bg-gray-900">
      {team.map((slot, i) => (
        <button key={i} type="button" onClick={() => openSlot(i)}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 gap-0.5 transition-colors border-b-2 -mb-0.5 ${
            activeSlotIndex === i ? 'border-indigo-500 bg-gray-800' : 'border-transparent hover:bg-gray-800/50'}`}>
          {slot.species
            ? <PokemonSprite species={slot.species} size={36} alt={slot.nickname || slot.species.name} />
            : <div className="w-9 h-9 flex items-center justify-center text-gray-600 text-lg font-bold">{i + 1}</div>}
        </button>
      ))}
    </div>
  );
}
