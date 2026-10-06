import { useState } from 'react';
import { CHART, OTHER_COLOR, SERIES_COLORS } from './palette.js';
import { formatPercent } from '../../domain/battleStats.js';

const SIZE = 132;
const OUTER = 62;
const INNER = 38;

// SVG path for a ring segment between two angles (radians, 0 = 12 o'clock, clockwise).
function arc(start, end) {
  const point = (r, a) => [SIZE / 2 + r * Math.sin(a), SIZE / 2 - r * Math.cos(a)];
  const large = end - start > Math.PI ? 1 : 0;
  const [x0, y0] = point(OUTER, start);
  const [x1, y1] = point(OUTER, end);
  const [x2, y2] = point(INNER, end);
  const [x3, y3] = point(INNER, start);
  return `M${x0},${y0} A${OUTER},${OUTER} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${INNER},${INNER} 0 ${large} 0 ${x3},${y3} Z`;
}

const colorOf = (slice, i) => (slice.other ? OTHER_COLOR : SERIES_COLORS[i % SERIES_COLORS.length]);

/**
 * Part-to-whole ring with a legend that doubles as the table view (name, count, share).
 * Slices are separated by a 2px surface gap; hovering a slice or legend row highlights it.
 */
export default function DonutChart({ slices, total, unit = 'uses' }) {
  const [active, setActive] = useState(null);
  // A lone slice is a full ring; two ring arcs at the same point would draw nothing.
  const whole = slices.length === 1;
  let angle = 0;
  const segments = slices.map((slice, i) => {
    const start = angle;
    angle += slice.share * 2 * Math.PI;
    return { slice, i, start, end: angle };
  });
  const focus = active === null ? null : slices[active];

  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg width={SIZE} height={SIZE} role="img" className="shrink-0"
        aria-label={`${total} ${unit}: ${slices.map(s => `${s.name} ${formatPercent(s.share)}`).join(', ')}`}>
        {whole
          ? <circle cx={SIZE / 2} cy={SIZE / 2} r={(OUTER + INNER) / 2} fill="none" stroke={colorOf(slices[0], 0)} strokeWidth={OUTER - INNER} />
          : segments.map(({ slice, i, start, end }) => (
            <path key={slice.name} d={arc(start, end)} fill={colorOf(slice, i)} stroke={CHART.surface} strokeWidth="2"
              opacity={active === null || active === i ? 1 : 0.35}
              onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} />
          ))}
        <text x={SIZE / 2} y={SIZE / 2 - 4} textAnchor="middle" fontSize="16" fontWeight="600" fill={CHART.text}>
          {focus ? formatPercent(focus.share) : total}
        </text>
        <text x={SIZE / 2} y={SIZE / 2 + 12} textAnchor="middle" fontSize="10" fill={CHART.muted}>
          {focus ? `${focus.count} ${unit}` : unit}
        </text>
      </svg>
      <ul className="flex-1 min-w-[10rem] space-y-0.5 text-xs">
        {slices.map((slice, i) => (
          <li key={slice.name} onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)}
            className={`flex items-center gap-2 rounded px-1 ${active === i ? 'bg-gray-700/50' : ''}`}>
            <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: colorOf(slice, i) }} />
            <span className="text-gray-200 truncate flex-1">{slice.name}</span>
            <span className="text-gray-400 font-mono">{slice.count}</span>
            <span className="text-gray-500 font-mono w-9 text-right">{formatPercent(slice.share)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
