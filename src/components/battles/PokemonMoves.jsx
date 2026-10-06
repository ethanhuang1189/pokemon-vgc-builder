import { useMemo } from 'react';
import SpeciesIcons from './SpeciesIcons';
import DonutChart from '../charts/DonutChart';
import { movesByPokemon } from '../../domain/battleInsights.js';

/** One move-usage ring per Pokémon, in the team's order. */
export default function PokemonMoves({ battles, order = [] }) {
  const pokemon = useMemo(() => movesByPokemon(battles, order), [battles, order]);
  if (!pokemon.length) return <p className="text-[11px] text-gray-500">Move usage appears after your next sync.</p>;

  return (
    <ul className="space-y-3">
      {pokemon.map(p => (
        <li key={p.species}>
          <div className="flex items-center gap-1.5 mb-1">
            <SpeciesIcons names={[p.species]} size={24} />
            <span className="text-xs text-gray-200 font-medium">{p.species}</span>
          </div>
          <DonutChart slices={p.slices} total={p.total} unit="uses" size={96} />
        </li>
      ))}
    </ul>
  );
}
