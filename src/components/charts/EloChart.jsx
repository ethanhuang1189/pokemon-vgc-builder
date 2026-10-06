import { useState } from 'react';
import { useElementWidth } from '../../hooks/useElementWidth.js';
import { niceTicks, linear } from '../../utils/chartScale.js';
import { CHART, SERIES_COLORS } from './palette.js';

const HEIGHT = 170;
const PAD = { top: 12, right: 14, bottom: 24, left: 40 };
const RESULT_LABEL = { win: 'Win', loss: 'Loss', tie: 'Tie' };

const signed = (n) => (n > 0 ? `+${n}` : String(n));

function Tooltip({ series, game, x, width }) {
  const rows = series
    .map((s, i) => ({ s, i, point: s.points[game - 1] }))
    .filter(r => r.point);
  if (!rows.length) return null;
  const left = Math.min(Math.max(x - 96, 0), Math.max(width - 192, 0));
  return (
    <div className="absolute top-0 pointer-events-none bg-gray-900/95 border border-gray-600 rounded px-2 py-1 text-[11px] w-48 z-10"
      style={{ left }}>
      <div className="text-gray-400 mb-0.5">Game {game}</div>
      {rows.map(({ s, i, point }) => (
        <div key={s.format}>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: SERIES_COLORS[i] }} />
            <span className="text-white font-semibold">{point.rating}</span>
            {point.change !== null && <span className="text-gray-400">({signed(point.change)})</span>}
          </div>
          <div className="text-gray-400 break-words">{RESULT_LABEL[point.result]} vs {point.opponent}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * Ladder rating (y) after each rated game (x). One 2px line per ladder; a legend appears only
 * with several ladders. Hover, touch or arrow keys move a crosshair with the readout.
 */
export default function EloChart({ series }) {
  const [ref, width] = useElementWidth();
  const [game, setGame] = useState(null);

  const games = Math.max(...series.map(s => s.points.length));
  const { min, max, ticks } = niceTicks(series.flatMap(s => s.points.map(p => p.rating)));
  const plotRight = Math.max(width - PAD.right, PAD.left + 1);
  const x = linear(1, games, PAD.left, plotRight);
  const y = linear(min, max, HEIGHT - PAD.bottom, PAD.top);
  const xTicks = [...new Set([1, Math.round((games + 1) / 2), games])];

  const gameAt = (clientX, target) => {
    const px = clientX - target.getBoundingClientRect().left;
    const raw = 1 + ((px - PAD.left) / (plotRight - PAD.left)) * (games - 1);
    return Math.min(games, Math.max(1, Math.round(raw)));
  };
  const onKeyDown = (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    setGame(g => Math.min(games, Math.max(1, (g ?? games) + step)));
  };

  return (
    <div ref={ref} className="relative">
      {series.length > 1 && (
        <ul className="flex flex-wrap gap-3 mb-1 text-[11px] text-gray-300">
          {series.map((s, i) => (
            <li key={s.format} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 rounded" style={{ background: SERIES_COLORS[i] }} />{s.format}
            </li>
          ))}
        </ul>
      )}
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" tabIndex={0}
          aria-label={`Rating over ${games} games, from ${series[0].points[0].rating} to ${series[0].points.at(-1).rating}`}
          className="block touch-pan-y focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 rounded"
          onPointerMove={e => setGame(gameAt(e.clientX, e.currentTarget))}
          onPointerLeave={() => setGame(null)} onKeyDown={onKeyDown} onBlur={() => setGame(null)}>
          {ticks.map(t => (
            <g key={t}>
              <line x1={PAD.left} x2={plotRight} y1={y(t)} y2={y(t)} stroke={CHART.grid} strokeWidth="1" />
              <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill={CHART.muted}
                style={{ fontVariantNumeric: 'tabular-nums' }}>{t}</text>
            </g>
          ))}
          {xTicks.map(g => (
            <text key={g} x={x(g)} y={HEIGHT - 6} textAnchor="middle" fontSize="10" fill={CHART.muted}>{g === 1 ? 'Game 1' : g}</text>
          ))}
          {game !== null && <line x1={x(game)} x2={x(game)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke={CHART.muted} strokeWidth="1" />}
          {series.map((s, i) => {
            const color = SERIES_COLORS[i];
            const last = s.points.at(-1);
            const hovered = game !== null && s.points[game - 1];
            return (
              <g key={s.format}>
                <polyline fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
                  points={s.points.map(p => `${x(p.game)},${y(p.rating)}`).join(' ')} />
                <circle cx={x(last.game)} cy={y(last.rating)} r="4" fill={color} stroke={CHART.surface} strokeWidth="2" />
                {hovered && <circle cx={x(hovered.game)} cy={y(hovered.rating)} r="4" fill={color} stroke={CHART.surface} strokeWidth="2" />}
              </g>
            );
          })}
          {/* Direct label on the latest rating of the main ladder. */}
          <text x={x(series[0].points.at(-1).game) - 8} y={y(series[0].points.at(-1).rating) - 8} textAnchor="end"
            fontSize="11" fontWeight="600" fill={CHART.text}>{series[0].points.at(-1).rating}</text>
        </svg>
      )}
      {game !== null && <Tooltip series={series} game={game} x={x(game)} width={width} />}
    </div>
  );
}
