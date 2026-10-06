import { useMemo } from 'react';
import Card from '../ui/Card';
import SpeciesIcons from './SpeciesIcons';
import { summarizeBattles, formatPercent } from '../../domain/battleStats.js';

const TOP_POKEMON = 12;

function Stat({ label, value }) {
  return (
    <div className="text-center">
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function PokemonTable({ title, rows, countLabel }) {
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
          {rows.slice(0, TOP_POKEMON).map(row => (
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

export default function BattleStats({ battles }) {
  const { record, yourPokemon, opponentPokemon } = useMemo(() => summarizeBattles(battles), [battles]);
  if (!record.games) return null;

  return (
    <Card title="Stats">
      <div className="flex justify-around mb-4">
        <Stat label="Games" value={record.games} />
        <Stat label="Record" value={`${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ''}`} />
        <Stat label="Win rate" value={formatPercent(record.winRate)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <PokemonTable title="Your Pokémon" rows={yourPokemon} countLabel="Brought" />
        <PokemonTable title="Opponents' Pokémon" rows={opponentPokemon} countLabel="Faced" />
      </div>
    </Card>
  );
}
