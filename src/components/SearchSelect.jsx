import { useState, useMemo, useRef, useEffect } from 'react';

export default function SearchSelect({
  options = [],
  value,
  onChange,
  getLabel,
  getKey,
  getDescription,
  renderOption,
  placeholder = 'Search...',
  disabled = false,
  className = '',
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const displayValue = open ? query : (value ? getLabel(value) : '');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return options;
    return options.filter(o => {
      if (getLabel(o).toLowerCase().includes(q)) return true;
      if (getDescription && getDescription(o)?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [options, query, getLabel, getDescription]);

  useEffect(() => {
    function handleClick(e) {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleFocus() {
    setQuery('');
    setOpen(true);
  }

  function handleChange(e) {
    setQuery(e.target.value);
    setOpen(true);
  }

  function handleSelect(option) {
    onChange(option);
    setQuery('');
    setOpen(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  }

  function handleClear(e) {
    e.stopPropagation();
    onChange(null);
    setQuery('');
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex items-center">
        <input
          type="text"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-gray-700 border border-gray-600 px-2 py-1 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 text-gray-400 hover:text-white text-lg leading-none"
            tabIndex={-1}
          >
            ×
          </button>
        )}
      </div>

      {open && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 shadow-xl max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-gray-400 text-xs">No results</div>
          ) : (
            filtered.map(option => (
              <button
                key={getKey ? getKey(option) : getLabel(option)}
                type="button"
                onMouseDown={() => handleSelect(option)}
                className="w-full text-left px-2 py-1 text-xs hover:bg-gray-700 focus:bg-gray-700 focus:outline-none"
              >
                {renderOption ? renderOption(option) : <span className="text-white">{getLabel(option)}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
