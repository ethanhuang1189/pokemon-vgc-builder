import { useState } from 'react';
import MovePickerModal from './MovePickerModal';

function StatStack({ label, value }) {
  return (
    <div className="flex flex-col items-center shrink-0 min-w-[22px]">
      <span className="text-[7px] text-gray-500 leading-none uppercase tracking-tight">{label}</span>
      <span className="text-[9px] text-gray-200 leading-none mt-0.5 font-mono font-semibold">{value}</span>
    </div>
  );
}

function fmtAcc(acc) {
  if (acc === true) return '—';
  return acc ? `${acc}%` : '—';
}

export default function MoveSlot({ move, allMoves, onChange, index }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-1.5 px-2 bg-gray-700 border border-gray-600 text-left hover:border-gray-500 active:bg-gray-600 transition-colors"
        style={{ minHeight: '44px' }}
      >
        {move ? (
          <>
            <span className="flex-1 min-w-0 truncate text-white text-xs font-semibold">{move.name}</span>
            <div className="flex gap-0.5 shrink-0">
              <StatStack label="Power" value={move.category === 'Status' ? '—' : (move.basePower || '—')} />
              <StatStack label="Acc" value={fmtAcc(move.accuracy)} />
              <StatStack label="PP" value={move.pp || '—'} />
            </div>
          </>
        ) : (
          <span className="text-gray-500 text-xs">Move {index + 1}</span>
        )}
      </button>

      {open && (
        <MovePickerModal
          moves={allMoves}
          slotLabel={`Move ${index + 1}`}
          currentMove={move}
          onSelect={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
