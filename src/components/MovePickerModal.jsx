import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import TypeBadge from './TypeBadge';
import CategoryIcon from './CategoryIcon';

function fmtAccuracy(acc) {
  if (acc === true) return '—';
  return acc ? `${acc}%` : '—';
}

function StatStack({ label, value }) {
  return (
    <div className="flex flex-col items-center shrink-0 min-w-[18px]">
      <span className="text-[6px] text-gray-500 leading-none">{label}</span>
      <span className="text-[8px] text-gray-300 leading-none mt-px font-mono">{value}</span>
    </div>
  );
}

export default function MovePickerModal({ moves, slotLabel, currentMove, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [dragY, setDragY] = useState(0);
  const inputRef = useRef(null);
  const dragStartRef = useRef(null);

  useEffect(() => {
    document.body.classList.add('modal-open');
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => {
      clearTimeout(t);
      document.body.classList.remove('modal-open');
    };
  }, []);

  function onHandlePointerDown(e) {
    dragStartRef.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onHandlePointerMove(e) {
    if (dragStartRef.current === null) return;
    setDragY(Math.max(0, e.clientY - dragStartRef.current));
  }
  function onHandlePointerUp() {
    if (dragY > 100) { onClose(); } else { setDragY(0); }
    dragStartRef.current = null;
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return moves;
    return moves.filter(m => m.name.toLowerCase().includes(q));
  }, [moves, query]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        style={{ backdropFilter: 'blur(2px)', opacity: Math.max(0.1, 1 - dragY / 300) }}
      />
      <div
        className="relative bg-gray-900 border-t-2 border-indigo-600 flex flex-col"
        style={{
          height: '85dvh',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          transform: `translateY(${dragY}px)`,
          transition: dragY === 0 ? 'transform 0.25s ease' : 'none',
        }}
      >
        {/* Handle bar — drag to dismiss */}
        <div
          className="flex justify-center py-3 shrink-0 cursor-grab active:cursor-grabbing select-none touch-none"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
        >
          <div className="w-10 h-1 bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 pb-2 shrink-0">
          <span className="text-sm font-semibold text-white flex-1">{slotLabel}</span>
          {currentMove && (
            <button
              type="button"
              onClick={() => { onSelect(null); onClose(); }}
              className="text-xs text-red-400 hover:text-red-300 px-2 py-1 border border-red-800"
            >
              Clear
            </button>
          )}
        </div>

        {/* Search */}
        <div className="px-3 pb-2 shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search moves…"
            className="w-full bg-gray-800 border border-gray-600 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Count */}
        <div className="px-4 py-1 text-xs text-gray-500 shrink-0 border-b border-gray-800">
          {filtered.length} move{filtered.length !== 1 ? 's' : ''}
        </div>

        {/* Move list */}
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-gray-500 text-sm">No moves found</div>
          ) : (
            filtered.map(move => {
              const isSelected = currentMove?.id === move.id;
              return (
                <button
                  key={move.id}
                  type="button"
                  onClick={() => { onSelect(move); onClose(); }}
                  className={`w-full flex items-center gap-1.5 px-3 py-2 border-b border-gray-800 text-left active:bg-gray-700 ${
                    isSelected ? 'bg-indigo-900/40' : 'hover:bg-gray-800'
                  }`}
                >
                  {/* Move name — biggest text */}
                  <span className={`text-[10px] font-semibold shrink-0 max-w-[32%] truncate ${isSelected ? 'text-indigo-300' : 'text-white'}`}>
                    {move.name}
                  </span>
                  <TypeBadge type={move.type} size="xs" />
                  <CategoryIcon category={move.category} size="xs" />
                  {/* Stacked stats */}
                  <div className="flex gap-px shrink-0">
                    <StatStack label="Power" value={move.category === 'Status' ? '—' : (move.basePower || '—')} />
                    <StatStack label="Acc" value={fmtAccuracy(move.accuracy)} />
                    <StatStack label="PP" value={move.pp} />
                  </div>
                  {/* Description fills remaining space */}
                  {move.shortDesc && (
                    <span className="flex-1 min-w-0 text-[8px] text-gray-500 truncate">
                      {move.shortDesc}
                    </span>
                  )}
                </button>
              );
            })
          )}
          <div className="h-4" />
        </div>
      </div>
    </div>,
    document.body
  );
}
