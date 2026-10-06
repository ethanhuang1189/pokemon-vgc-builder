import SpeciesIcons from './SpeciesIcons';
import StatsPanel from './StatsPanel';
import PokemonMoves from './PokemonMoves';
import BattleRows from './BattleRows';
import { formatPercent, formatRecord } from '../../domain/battleStats.js';

/**
 * One team (saved or an unnamed iteration): header with record, expandable stats and games.
 * `actions` renders extra buttons in the expanded area; `moveTargets` enables moving games.
 */
export default function TeamCard({ group, title, badge, expanded, onToggle, actions, moveTargets, onMove, onDelete }) {
  const { record } = group;
  return (
    <li className="border border-gray-700 rounded-sm list-none">
      <button type="button" onClick={onToggle} aria-expanded={expanded}
        className={`w-full text-left px-3 py-2 space-y-1 transition-colors ${expanded ? 'bg-gray-700/40' : 'hover:bg-gray-700/20'}`}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white truncate">{title}</span>
          {badge && <span className="text-[10px] px-1.5 py-px rounded bg-indigo-600/40 text-indigo-200 shrink-0">{badge}</span>}
        </div>
        <SpeciesIcons names={group.species} size={32} />
        <div className="flex items-center gap-3 text-xs">
          <span className="text-white font-semibold">{record.games ? formatRecord(record) : 'No games yet'}</span>
          {record.games > 0 && <span className="text-gray-300">{formatPercent(record.winRate)} win rate</span>}
          <span className="text-gray-500 ml-auto">{record.games} game{record.games === 1 ? '' : 's'} {expanded ? '▴' : '▾'}</span>
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {actions && <div className="flex flex-wrap gap-2 pt-2">{actions}</div>}
          <div className="pt-1"><StatsPanel battles={group.battles} /></div>
          {/* On wide screens these sit in the dashboard's side column instead. */}
          <div className="lg:hidden">
            <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Move usage</h4>
            <PokemonMoves battles={group.battles} order={group.species} />
          </div>
          <BattleRows battles={group.battles} moveTargets={moveTargets} onMove={onMove} onDelete={onDelete} />
        </div>
      )}
    </li>
  );
}
