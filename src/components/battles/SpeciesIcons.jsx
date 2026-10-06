import PokemonSprite from '../PokemonSprite';
import { useFormat } from '../../context/FormatContext';

/** Small sprites for a list of species names; names the dex doesn't know show as text. */
export default function SpeciesIcons({ names, size = 28 }) {
  const { format } = useFormat();
  return (
    <span className="inline-flex items-center gap-0.5">
      {names.map(name => {
        const species = format.displaySpecies(name);
        return species
          ? <PokemonSprite key={name} species={species} size={size} glow={false} lazy alt={name} />
          : <span key={name} className="text-[10px] text-gray-400 px-1">{name}</span>;
      })}
    </span>
  );
}
