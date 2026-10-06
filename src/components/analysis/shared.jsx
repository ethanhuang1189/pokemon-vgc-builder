import TypeBadge from '../TypeBadge';
import { TYPE_COLORS } from '../typeColors.js';

export { default as Card } from '../ui/Card';

export function DetailBox({ children }) {
  return <div className="mt-1.5 bg-gray-900/60 border border-gray-600/60 rounded px-2 py-1.5 space-y-1">{children}</div>;
}

export function Warning({ children }) {
  return <div className="mt-2 text-xs text-red-400 bg-red-400/10 rounded px-2 py-1">{children}</div>;
}

export const TypeName = ({ type }) => <span style={{ color: TYPE_COLORS[type] }} className="font-semibold">{type}</span>;

export const TypeBadges = ({ types }) => (
  <span className="flex gap-0.5 ml-0.5">{types.map(t => <TypeBadge key={t} type={t} />)}</span>
);

/** "Pokémon — Move" line, the move coloured by the type it hits with. */
export function MoveLine({ pokeName, moveName, moveType, children }) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-white font-medium">{pokeName}</span>
      <span className="text-gray-600">—</span>
      <span style={{ color: TYPE_COLORS[moveType] }}>{moveName}</span>
      {children}
    </div>
  );
}

/** "Pokémon [types] … ×eff" line. */
export function MemberLine({ pokeName, types, children }) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-white font-medium">{pokeName}</span>
      <TypeBadges types={types} />
      {children}
    </div>
  );
}

/** A tappable bar row that expands a DetailBox below it. */
export function ExpandableRow({ expanded, onToggle, header, children }) {
  return (
    <div>
      <button type="button" onClick={onToggle}
        className={`w-full flex items-center gap-2 px-1 py-0.5 rounded transition-colors ${expanded ? 'bg-gray-700/60' : 'hover:bg-gray-700/30'}`}>
        {header}
      </button>
      {expanded && <DetailBox>{children}</DetailBox>}
    </div>
  );
}
