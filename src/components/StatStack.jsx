// A tiny label-over-value pair (move power/accuracy/PP, base stats in lists).
export default function StatStack({ label, value, minWidth = 18 }) {
  return (
    <div className="flex flex-col items-center shrink-0" style={{ minWidth }}>
      <span className="text-[6px] text-gray-500 leading-none">{label}</span>
      <span className="text-[8px] text-gray-300 leading-none mt-px font-mono">{value ?? '—'}</span>
    </div>
  );
}

