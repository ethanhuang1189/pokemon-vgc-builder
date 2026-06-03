import { TYPE_COLORS } from '../data/typeChart';

export default function TypeBadge({ type, size = 'sm', className = '' }) {
  const bg = TYPE_COLORS[type] ?? '#888';
  const padding = size === 'lg' ? 'px-3 py-1 text-sm'
    : size === 'xs' ? 'px-1 py-px text-[7px] leading-none'
    : 'px-2 py-0.5 text-xs';
  return (
    <span
      className={`inline-flex items-center justify-center font-semibold uppercase ${padding} ${className}`}
      style={{
        backgroundColor: bg,
        color: '#fff',
        textShadow: '0 1px 1px rgba(0,0,0,0.4)',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25), 0 1px 2px rgba(0,0,0,0.35)',
      }}
    >
      {type}
    </span>
  );
}
