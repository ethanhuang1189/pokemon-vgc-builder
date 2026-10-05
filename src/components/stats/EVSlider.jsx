import { useRef } from 'react';
import { usePointerTrack } from './usePointerTrack.js';

const THUMB_PX = 16;

/** EV slider on a 0–`scale` track, clamped to `max` (what the EV budget still allows). */
export default function EVSlider({ value, max, scale, color, onChange }) {
  const trackRef = useRef(null);
  const handlers = usePointerTrack(trackRef, fraction => onChange(Math.min(max, Math.round(fraction * scale))));
  const fillPct = scale > 0 ? (value / scale) * 100 : 0;

  return (
    <div ref={trackRef} className="relative flex items-center cursor-pointer select-none touch-none"
      style={{ height: 28 }} {...handlers}>
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-gray-700">
        {max < scale && (
          <div className="absolute inset-y-0 left-0 rounded-full bg-gray-600" style={{ width: `${(max / scale) * 100}%` }} />
        )}
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${fillPct}%`, background: color }} />
      </div>
      <div className="absolute top-1/2 -translate-y-1/2 rounded-full border-2 bg-gray-100 shadow"
        style={{
          width: THUMB_PX,
          height: THUMB_PX,
          left: `calc(${fillPct / 100} * (100% - ${THUMB_PX}px))`,
          borderColor: color,
        }} />
    </div>
  );
}
