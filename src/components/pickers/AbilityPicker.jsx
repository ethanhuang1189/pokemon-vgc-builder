import { useMemo, useState } from 'react';
import PickerShell, { PickerRow } from './PickerShell';
import { filterByText } from '../../domain/search.js';
import { plural } from '../../domain/ids.js';

export default function AbilityPicker({ options, current, onSelect }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => filterByText(options, query), [options, query]);

  return (
    <PickerShell query={query} onQueryChange={setQuery} placeholder="Search abilities…"
      onClear={current ? () => onSelect(null) : null}
      countLabel={plural(filtered.length, 'ability', 'abilities')}
      isEmpty={!filtered.length} emptyText="No abilities found">
      {filtered.map(a => (
        <PickerRow key={a.id} selected={current === a.name} onClick={() => onSelect(a)} className="gap-3 px-3 py-2.5">
          <span className={`text-sm font-medium shrink-0 ${current === a.name ? 'text-indigo-300' : 'text-white'}`}>{a.name}</span>
          {a.shortDesc && <span className="text-xs text-gray-400 flex-1 truncate">{a.shortDesc}</span>}
        </PickerRow>
      ))}
    </PickerShell>
  );
}
