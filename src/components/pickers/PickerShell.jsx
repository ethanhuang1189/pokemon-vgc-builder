import { useAutoFocus } from '../../hooks/useAutoFocus.js';

/**
 * Layout shared by every sub-picker: clear button + search box, optional filter rows,
 * a result count, then the scrollable list (or an empty-state message).
 */
export default function PickerShell({
  query, onQueryChange, placeholder,
  onClear, clearLabel = 'Clear',
  filters, countLabel, suggestions,
  isEmpty, emptyText, children,
}) {
  const inputRef = useAutoFocus();
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-2 px-3 pb-2 shrink-0">
        {onClear && (
          <button type="button" onClick={onClear}
            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 border border-red-800 shrink-0">
            {clearLabel}
          </button>
        )}
        <input ref={inputRef} type="text" value={query} onChange={e => onQueryChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-gray-800 border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
      </div>
      {filters}
      <div className="px-4 py-1 text-[10px] text-gray-500 shrink-0 border-b border-gray-800">{countLabel}</div>
      {suggestions}
      <div className="overflow-y-auto flex-1">
        {isEmpty ? <div className="px-4 py-10 text-center text-gray-500 text-sm">{emptyText}</div> : children}
        <div className="h-4" />
      </div>
    </div>
  );
}

/** A full-width list row with the shared selected/hover styling. */
export function PickerRow({ selected, onClick, className = '', children }) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full flex items-center border-b border-gray-800 text-left ${className} ${
        selected ? 'bg-indigo-900/40' : 'hover:bg-gray-800 active:bg-gray-700'}`}>
      {children}
    </button>
  );
}

/** Small toggle chip used by filter rows. */
export function Chip({ active, onClick, activeClass = 'bg-indigo-700 border-indigo-500 text-white', children }) {
  return (
    <button type="button" onClick={onClick}
      className={`shrink-0 flex items-center gap-1 px-2 py-0.5 text-[10px] border ${
        active ? activeClass : 'border-gray-700 text-gray-400 hover:text-gray-300'}`}>
      {children}
    </button>
  );
}
