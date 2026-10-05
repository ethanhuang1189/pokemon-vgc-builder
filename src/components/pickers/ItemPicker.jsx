import { useMemo, useState } from 'react';
import PickerShell, { PickerRow } from './PickerShell';
import ItemSprite from '../ItemSprite';
import { filterByText } from '../../domain/search.js';
import { plural } from '../../domain/ids.js';

export default function ItemPicker({ options, current, onSelect }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => filterByText(options, query), [options, query]);

  return (
    <PickerShell query={query} onQueryChange={setQuery} placeholder="Search items…"
      onClear={current ? () => onSelect(null) : null}
      countLabel={plural(filtered.length, 'item')}
      isEmpty={!filtered.length} emptyText="No items found">
      {filtered.map(item => {
        const selected = current === item.name;
        return (
          <PickerRow key={item.id} selected={selected} onClick={() => onSelect(item)} className="gap-2.5 px-3 py-2">
            <ItemSprite item={item} />
            <span className={`text-sm font-medium shrink-0 ${selected ? 'text-indigo-300' : 'text-white'}`}>{item.name}</span>
            {item.shortDesc && <span className="text-xs text-gray-400 flex-1 truncate">{item.shortDesc}</span>}
          </PickerRow>
        );
      })}
    </PickerShell>
  );
}
