import { useMemo, useState } from 'react';
import PickerShell, { PickerRow, Chip } from './PickerShell';
import TypeBadge from '../TypeBadge';
import CategoryIcon from '../CategoryIcon';
import StatStack from '../StatStack';
import { formatAccuracy, formatPower } from '../moveFormat.js';
import { filterMoves, typesIn } from '../../domain/search.js';
import { getEffectiveMoveType } from '../../domain/typeChart.js';
import { plural } from '../../domain/ids.js';

const CATEGORIES = ['Physical', 'Special', 'Status'];

function MoveRow({ move, ability, selected, onClick }) {
  const effType = getEffectiveMoveType(move, ability);
  return (
    <PickerRow selected={selected} onClick={onClick} className="gap-1.5 px-3 py-2">
      <span className={`text-[11px] font-semibold shrink-0 w-28 truncate ${selected ? 'text-indigo-300' : 'text-white'}`}>{move.name}</span>
      <TypeBadge type={effType} size="xs" />
      {effType !== move.type && <TypeBadge type={move.type} size="xs" className="opacity-35" />}
      <CategoryIcon category={move.category} size="xs" />
      <div className="flex gap-px shrink-0">
        <StatStack label="Power" value={formatPower(move)} />
        <StatStack label="Acc" value={formatAccuracy(move.accuracy)} />
        <StatStack label="PP" value={move.pp || '—'} />
      </div>
      {move.shortDesc && <span className="flex-1 min-w-0 text-[9px] text-gray-500 truncate">{move.shortDesc}</span>}
    </PickerRow>
  );
}

/** `ability` is the slot's ability, so moves show the type they actually hit with (e.g. Pixilate). */
export default function MovePicker({ options, current, ability, onSelect }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState(null);
  const [category, setCategory] = useState(null);

  const moveTypes = useMemo(() => typesIn(options), [options]);
  const filtered = useMemo(() => filterMoves(options, { query, type, category }), [options, query, type, category]);
  const toggle = (setter, value) => setter(prev => (prev === value ? null : value));

  const filters = (
    <>
      <div className="flex items-center gap-1.5 px-3 pb-2 shrink-0">
        {CATEGORIES.map(cat => (
          <Chip key={cat} active={category === cat} onClick={() => toggle(setCategory, cat)}
            activeClass="border-gray-500 bg-gray-700 text-white">
            <CategoryIcon category={cat} size="xs" /><span>{cat}</span>
          </Chip>
        ))}
      </div>
      <div className="flex gap-1 px-3 pb-2 shrink-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <Chip active={!type} onClick={() => setType(null)} activeClass="bg-gray-600 border-gray-500 text-white">All</Chip>
        {moveTypes.map(t => <Chip key={t} active={type === t} onClick={() => toggle(setType, t)}>{t}</Chip>)}
      </div>
    </>
  );

  return (
    <PickerShell query={query} onQueryChange={setQuery} placeholder="Search moves…"
      onClear={current ? () => onSelect(null) : null}
      filters={filters}
      countLabel={plural(filtered.length, 'move')}
      isEmpty={!filtered.length} emptyText="No moves found">
      {filtered.map(move => (
        <MoveRow key={move.id} move={move} ability={ability} selected={current?.id === move.id}
          onClick={() => { onSelect(move); setQuery(''); }} />
      ))}
    </PickerShell>
  );
}
