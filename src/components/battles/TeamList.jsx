import { useMemo, useState } from 'react';
import Card from '../ui/Card';
import SpeciesIcons from './SpeciesIcons';
import PokemonTable from './PokemonTable';
import BattleRows from './BattleRows';
import { groupByTeam, formatPercent, formatRecord } from '../../domain/battleStats.js';

function TeamCard({ group, expanded, onToggle, onDelete }) {
  const { record } = group;
  return (
    <li className="border border-gray-700 rounded-sm">
      <button type="button" onClick={onToggle} aria-expanded={expanded}
        className={`w-full text-left px-3 py-2 space-y-1 transition-colors ${expanded ? 'bg-gray-700/40' : 'hover:bg-gray-700/20'}`}>
        <SpeciesIcons names={group.team} size={32} />
        <div className="flex items-center gap-3 text-xs">
          <span className="text-white font-semibold">{formatRecord(record)}</span>
          <span className="text-gray-300">{formatPercent(record.winRate)} win rate</span>
          <span className="text-gray-500 ml-auto">{record.games} game{record.games === 1 ? '' : 's'} {expanded ? '▴' : '▾'}</span>
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          <div className="grid gap-4 sm:grid-cols-2 pt-2">
            <PokemonTable title="Brought" rows={group.yourPokemon} countLabel="Games" limit={6} />
            <PokemonTable title="Faced most" rows={group.opponentPokemon} countLabel="Faced" limit={6} />
          </div>
          <BattleRows battles={group.battles} onDelete={onDelete} />
        </div>
      )}
    </li>
  );
}

/** Battles grouped by the six-Pokémon team brought, most recently played first. */
export default function TeamList({ battles, loading, error, onDelete }) {
  const groups = useMemo(() => groupByTeam(battles), [battles]);
  const [expanded, setExpanded] = useState(null);
  const toggle = (key) => setExpanded(current => (current === key ? null : key));

  return (
    <Card title="Teams" subtitle={groups.length ? 'Tap a team to see its games.' : undefined}>
      {loading && <p className="text-xs text-gray-500">Loading…</p>}
      {error && <p className="text-xs text-red-300">{error}</p>}
      {!loading && !error && !groups.length && <p className="text-xs text-gray-500">No battles yet — upload a replay on Showdown and it will appear here.</p>}
      <ul className="space-y-2">
        {groups.map(group => (
          <TeamCard key={group.key} group={group} expanded={expanded === group.key}
            onToggle={() => toggle(group.key)} onDelete={onDelete} />
        ))}
      </ul>
    </Card>
  );
}
