import { useState } from 'react';
import Card from '../ui/Card';
import { Button } from '../ui/controls';
import SpeciesIcons from './SpeciesIcons';
import { replayUrl } from '../../domain/replay.js';

const PAGE_SIZE = 20;

const RESULT_STYLE = {
  win: { label: 'W', className: 'bg-green-500/20 text-green-300' },
  loss: { label: 'L', className: 'bg-red-500/20 text-red-300' },
  tie: { label: 'T', className: 'bg-gray-500/20 text-gray-300' },
};

const formatDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function BattleRow({ battle, onDelete }) {
  const result = RESULT_STYLE[battle.result];
  return (
    <li className="border-t border-gray-700/60 py-2 space-y-1">
      <div className="flex items-center gap-2 text-xs">
        <span className={`w-5 h-5 shrink-0 rounded flex items-center justify-center font-bold ${result.className}`}>{result.label}</span>
        <span className="text-white truncate">vs {battle.opponent_name}</span>
        <span className="text-gray-500 shrink-0">{formatDate(battle.played_at)}</span>
        <a href={replayUrl(battle.replay_id)} target="_blank" rel="noopener noreferrer"
          className="ml-auto text-indigo-400 hover:text-indigo-300 shrink-0">Replay</a>
        <button type="button" onClick={() => onDelete(battle)} aria-label="Delete battle"
          className="text-gray-500 hover:text-red-300 shrink-0">×</button>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-gray-500">
        <SpeciesIcons names={battle.brought} />
        <span>vs</span>
        <SpeciesIcons names={battle.opponent_brought} />
      </div>
    </li>
  );
}

export default function BattleList({ battles, loading, error, onDelete }) {
  const [shown, setShown] = useState(PAGE_SIZE);

  return (
    <Card title="Recent battles">
      {loading && <p className="text-xs text-gray-500">Loading…</p>}
      {error && <p className="text-xs text-red-300">{error}</p>}
      {!loading && !error && !battles.length && <p className="text-xs text-gray-500">No battles yet — add one above.</p>}
      <ul>
        {battles.slice(0, shown).map(b => <BattleRow key={b.id} battle={b} onDelete={onDelete} />)}
      </ul>
      {battles.length > shown && (
        <Button tone="secondary" className="mt-2 w-full" onClick={() => setShown(n => n + PAGE_SIZE)}>Show more</Button>
      )}
    </Card>
  );
}
