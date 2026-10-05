import { useRef } from 'react';
import { usePointerTrack } from './usePointerTrack.js';

const WIDTH = 56;
const LABEL_INSET = 14;
const THUMB_PX = 14;

const positionAt = (fraction) => (fraction < 0.33 ? 'plus' : fraction > 0.67 ? 'minus' : null);

/** Three-position slider: left = boosted (+), middle = neutral, right = lowered (−). */
export default function NatureSlider({ value, onChange }) {
  const ref = useRef(null);
  const handlers = usePointerTrack(ref, fraction => onChange(positionAt(fraction)));

  const isPlus = value === 'plus';
  const isMinus = value === 'minus';
  const thumbFraction = isPlus ? 0 : isMinus ? 1 : 0.5;
  const thumbColor = isPlus ? '#3b82f6' : isMinus ? '#ef4444' : '#4b5563';
  const labelClass = 'absolute top-1/2 -translate-y-1/2 text-xs font-bold pointer-events-none';

  return (
    <div ref={ref} className="relative cursor-pointer select-none touch-none" style={{ width: WIDTH, height: 24 }} {...handlers}>
      <span className={`${labelClass} ${isPlus ? 'text-blue-400' : 'text-gray-600'}`}
        style={{ left: 0, width: 12, textAlign: 'center' }}>+</span>
      <span className={`${labelClass} ${isMinus ? 'text-red-400' : 'text-gray-600'}`}
        style={{ right: 0, width: 12, textAlign: 'center' }}>−</span>

      <div className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-gray-700 overflow-hidden pointer-events-none"
        style={{ left: LABEL_INSET, right: LABEL_INSET }}>
        {isPlus && <div className="absolute inset-y-0 left-0 w-1/2 bg-blue-600" />}
        {isMinus && <div className="absolute inset-y-0 right-0 w-1/2 bg-red-600" />}
      </div>

      <div className="absolute top-1/2 -translate-y-1/2 rounded-full border-2 bg-gray-100 shadow-sm pointer-events-none"
        style={{
          width: THUMB_PX,
          height: THUMB_PX,
          left: LABEL_INSET + thumbFraction * LABEL_INSET,
          borderColor: thumbColor,
          transition: 'left 0.08s ease, border-color 0.08s ease',
        }} />
    </div>
  );
}

/** Same footprint as the slider, for stats without a nature effect (HP). */
export const NatureSliderSpacer = () => <span className="shrink-0" style={{ width: WIDTH }} />;
