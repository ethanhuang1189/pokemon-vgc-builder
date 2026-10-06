import { useMemo } from 'react';
import Card from '../ui/Card';
import PokemonTable from './PokemonTable';
import { summarizeBattles, formatPercent, formatRecord } from '../../domain/battleStats.js';

function Stat({ label, value }) {
  return (
    <div className="text-center">
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</div>
    </div>
  );
}

/** Totals across every battle shown. */
export default function BattleStats({ battles }) {
  const { record, yourPokemon, opponentPokemon } = useMemo(() => summarizeBattles(battles), [battles]);
  if (!record.games) return null;

  return (
    <Card title="Overall">
      <div className="flex justify-around mb-4">
        <Stat label="Games" value={record.games} />
        <Stat label="Record" value={formatRecord(record)} />
        <Stat label="Win rate" value={formatPercent(record.winRate)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <PokemonTable title="Your Pokémon" rows={yourPokemon} countLabel="Brought" limit={6} />
        <PokemonTable title="Opponents' Pokémon" rows={opponentPokemon} countLabel="Faced" limit={6} />
      </div>
    </Card>
  );
}
