import { useState } from 'react';
import { TYPE_COLORS } from '../data/typeChart';

const ZA_ICON_URL = type =>
  `https://bulbapedia.bulbagarden.net/wiki/Special:FilePath/${type}_type_icon_ZA.png`;

function TextBadge({ type, size, className }) {
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

export default function TypeBadge({ type, size = 'sm', className = '' }) {
  const [failed, setFailed] = useState(false);

  const h = size === 'lg' ? 22 : size === 'xs' ? 13 : 16;

  if (failed) return <TextBadge type={type} size={size} className={className} />;

  return (
    <img
      src={ZA_ICON_URL(type)}
      alt={type}
      title={type}
      height={h}
      style={{ height: h, width: 'auto', display: 'inline-block', verticalAlign: 'middle', imageRendering: 'auto', flexShrink: 0 }}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
