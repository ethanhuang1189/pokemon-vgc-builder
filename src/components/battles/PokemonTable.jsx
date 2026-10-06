import SpeciesIcons from './SpeciesIcons';
import { formatPercent } from '../../domain/battleStats.js';

/** Per-Pokémon games and your win rate — rows from summarizeBattles(). */
export default function PokemonTable({ title, rows, countLabel, limit }) {
  if (!rows.length) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-400 mb-1">{title}</h4>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 text-[10px]">
            <th className="text-left font-normal">Pokémon</th>
            <th className="text-right font-normal">{countLabel}</th>
            <th className="text-right font-normal">Your win %</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map(row => (
            <tr key={row.name} className="border-t border-gray-700/50">
              <td className="py-0.5"><span className="flex items-center gap-1"><SpeciesIcons names={[row.name]} size={24} />{row.name}</span></td>
              <td className="text-right font-mono text-gray-300">{row.games}</td>
              <td className="text-right font-mono text-gray-300">{formatPercent(row.winRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
