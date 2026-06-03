import { useRef, useState, useEffect } from 'react';

const STATS = [
  { key: 'hp',  label: 'HP'  },
  { key: 'atk', label: 'Atk' },
  { key: 'def', label: 'Def' },
  { key: 'spa', label: 'SpA' },
  { key: 'spd', label: 'SpD' },
  { key: 'spe', label: 'Spe' },
];

const STAT_LABELS = { hp:'HP', atk:'Atk', def:'Def', spa:'SpA', spd:'SpD', spe:'Spe' };

export const NATURES = {
  Hardy:{},  Lonely:{plus:'atk',minus:'def'},  Brave:{plus:'atk',minus:'spe'},
  Adamant:{plus:'atk',minus:'spa'}, Naughty:{plus:'atk',minus:'spd'},
  Bold:{plus:'def',minus:'atk'},    Docile:{},   Relaxed:{plus:'def',minus:'spe'},
  Impish:{plus:'def',minus:'spa'},  Lax:{plus:'def',minus:'spd'},
  Timid:{plus:'spe',minus:'atk'},   Hasty:{plus:'spe',minus:'def'},
  Serious:{}, Jolly:{plus:'spe',minus:'spa'}, Naive:{plus:'spe',minus:'spd'},
  Modest:{plus:'spa',minus:'atk'},  Mild:{plus:'spa',minus:'def'},
  Quiet:{plus:'spa',minus:'spe'},   Bashful:{},  Rash:{plus:'spa',minus:'spd'},
  Calm:{plus:'spd',minus:'atk'},    Gentle:{plus:'spd',minus:'def'},
  Sassy:{plus:'spd',minus:'spe'},   Careful:{plus:'spd',minus:'spa'}, Quirky:{},
};

const MAX_EV          = 32;
const MAX_TOTAL_EV    = 66;
const CHAMPIONS_BUFF  = 15; // Pokemon Champions adds +15 to every base stat

// Colour stops: [finalStat, [r, g, b]]
const COLOR_STOPS = [
  [50,  [239, 68,  68]],   // red    #ef4444
  [100, [234, 179, 8]],    // yellow #eab308
  [150, [34,  197, 94]],   // green  #22c55e
  [200, [59,  130, 246]],  // blue   #3b82f6
];

// Smoothly interpolates between the 4 stops based on the final calculated stat
function statColor(finalStat) {
  if (finalStat <= COLOR_STOPS[0][0]) return `rgb(${COLOR_STOPS[0][1].join(',')})`;
  const last = COLOR_STOPS[COLOR_STOPS.length - 1];
  if (finalStat >= last[0]) return `rgb(${last[1].join(',')})`;
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const [loStat, loRgb] = COLOR_STOPS[i];
    const [hiStat, hiRgb] = COLOR_STOPS[i + 1];
    if (finalStat >= loStat && finalStat <= hiStat) {
      const t = (finalStat - loStat) / (hiStat - loStat);
      const r = Math.round(loRgb[0] + t * (hiRgb[0] - loRgb[0]));
      const g = Math.round(loRgb[1] + t * (hiRgb[1] - loRgb[1]));
      const b = Math.round(loRgb[2] + t * (hiRgb[2] - loRgb[2]));
      return `rgb(${r},${g},${b})`;
    }
  }
  return `rgb(${last[1].join(',')})`;
}


function findNature(plus, minus) {
  for (const [name, d] of Object.entries(NATURES)) {
    if ((d.plus ?? null) === (plus ?? null) && (d.minus ?? null) === (minus ?? null)) return name;
  }
  return 'Hardy';
}

// Takes plus/minus directly so partial selections give live preview
function calcStat(key, base, ev, plus, minus) {
  if (!base) return 0;
  const b = base + CHAMPIONS_BUFF;
  const natMult = plus === key ? 1.1 : minus === key ? 0.9 : 1.0;
  const inner = Math.floor((2 * b * 50) / 100);
  if (key === 'hp') return inner + 50 + 10 + ev;
  return Math.floor((inner + 5 + ev) * natMult);
}

// ── Custom EV slider using pointer capture — prevents multi-touch bleed on iOS ──
function EVSlider({ value, max, color, onChange }) {
  const trackRef = useRef(null);

  function valueFromX(clientX) {
    const rect = trackRef.current.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    // Scale against MAX_EV visually but clamp to available max
    return Math.min(max, Math.round(pct * MAX_EV));
  }

  function onDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    onChange(valueFromX(e.clientX));
  }
  function onMove(e) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    onChange(valueFromX(e.clientX));
  }
  function onUp(e) {
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  const fillPct  = MAX_EV > 0 ? (value / MAX_EV) * 100 : 0;
  const thumbPx  = 16; // thumb diameter

  return (
    <div
      ref={trackRef}
      className="relative flex items-center cursor-pointer select-none touch-none"
      style={{ height: 28 }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    >
      {/* Track */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-gray-700">
        {/* Capacity indicator when capped below MAX_EV */}
        {max < MAX_EV && (
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gray-600"
            style={{ width: `${(max / MAX_EV) * 100}%` }}
          />
        )}
        {/* Fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${fillPct}%`, background: color }}
        />
      </div>
      {/* Thumb */}
      <div
        className="absolute top-1/2 -translate-y-1/2 rounded-full border-2 bg-gray-100 shadow"
        style={{
          width:  thumbPx,
          height: thumbPx,
          left:   `calc(${fillPct / 100} * (100% - ${thumbPx}px))`,
          borderColor: color,
        }}
      />
    </div>
  );
}

// ── 3-position nature slider: left = boost (+, blue) · middle = neutral · right = reduce (−, red) ──
function NatureSlider({ value, onChange }) {
  const ref = useRef(null);

  function posFromX(clientX) {
    const rect = ref.current.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    if (pct < 0.33) return 'plus';
    if (pct > 0.67) return 'minus';
    return null;
  }

  function onDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    onChange(posFromX(e.clientX));
  }
  function onMove(e) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    onChange(posFromX(e.clientX));
  }
  function onUp(e) {
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  const isPlus  = value === 'plus';
  const isMinus = value === 'minus';
  const thumbPct   = isPlus ? 0 : isMinus ? 100 : 50;
  const thumbColor = isPlus ? '#3b82f6' : isMinus ? '#ef4444' : '#4b5563';
  const thumbPx = 14;

  return (
    // Outer div is the full drag target — pointer capture covers the entire 56px width
    // including the + / − labels, so the thumb is always reachable at the extremes
    <div
      ref={ref}
      className="relative cursor-pointer select-none touch-none"
      style={{ width: 56, height: 24 }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    >
      {/* Labels — visual only, not interactive */}
      <span
        className={`absolute top-1/2 -translate-y-1/2 text-xs font-bold pointer-events-none ${isPlus ? 'text-blue-400' : 'text-gray-600'}`}
        style={{ left: 0, width: 12, textAlign: 'center' }}
      >+</span>
      <span
        className={`absolute top-1/2 -translate-y-1/2 text-xs font-bold pointer-events-none ${isMinus ? 'text-red-400' : 'text-gray-600'}`}
        style={{ right: 0, width: 12, textAlign: 'center' }}
      >−</span>

      {/* Track — centred between labels */}
      <div
        className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-gray-700 overflow-hidden pointer-events-none"
        style={{ left: 14, right: 14 }}
      >
        {isPlus  && <div className="absolute inset-y-0 left-0 w-1/2 bg-blue-600" />}
        {isMinus && <div className="absolute inset-y-0 right-0 w-1/2 bg-red-600" />}
      </div>

      {/* Thumb — confined to track (left:14 to right:14) */}
      <div
        className="absolute top-1/2 -translate-y-1/2 rounded-full border-2 bg-gray-100 shadow-sm pointer-events-none"
        style={{
          width:  thumbPx,
          height: thumbPx,
          left:   `${14 + (thumbPct / 100) * 14}px`,
          borderColor: thumbColor,
          transition: 'left 0.08s ease, border-color 0.08s ease',
        }}
      />
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────────
export default function StatEditor({ slot, onChange }) {
  const { evs, nature, species } = slot;
  const committedNd = NATURES[nature] ?? {};

  // Local pending state so partial selections (one side only) stay visible
  // instead of snapping back to neutral when findNature(key, null) = Hardy
  const [pendingPlus,  setPendingPlus]  = useState(committedNd.plus  ?? null);
  const [pendingMinus, setPendingMinus] = useState(committedNd.minus ?? null);

  // Sync from external nature changes (dropdown, mega toggle, etc.)
  useEffect(() => {
    const nd = NATURES[nature] ?? {};
    setPendingPlus(nd.plus   ?? null);
    setPendingMinus(nd.minus ?? null);
  }, [nature]);

  const totalEvs    = Object.values(evs).reduce((s, v) => s + (parseInt(v) || 0), 0);
  const evRemaining = MAX_TOTAL_EV - totalEvs;

  function setEV(key, raw) {
    const current   = evs[key] ?? 0;
    const requested = Math.max(0, Math.min(MAX_EV, parseInt(raw) || 0));
    const available = evRemaining + current;
    onChange({ evs: { ...evs, [key]: Math.min(requested, available) } });
  }

  function handleNatureSlider(key, pos) {
    let plus  = pendingPlus;
    let minus = pendingMinus;

    if (pos === 'plus') {
      plus = key;
      if (minus === key) minus = null;
    } else if (pos === 'minus') {
      minus = key;
      if (plus === key) plus = null;
    } else {
      // null = middle zone = clear this stat's nature effect
      if (plus  === key) plus  = null;
      if (minus === key) minus = null;
    }

    setPendingPlus(plus);
    setPendingMinus(minus);

    // Commit only when the nature is fully specified or fully neutral
    if ((plus === null) === (minus === null)) {
      onChange({ nature: findNature(plus, minus) });
    }
    // When only one side is set: keep showing the pending position,
    // don't commit (avoids snapping back to Hardy)
  }

  const evLabel = evRemaining === 0
    ? <span className="text-yellow-400 font-semibold">0 remaining</span>
    : <span className="text-gray-400">{evRemaining} remaining</span>;

  return (
    <div className="mt-3 space-y-2">

      {/* EV budget */}
      <div className="flex items-center justify-between text-xs px-0.5">
        <span className="text-gray-500 font-medium">EVs</span>
        <span className="font-mono">
          {evLabel}
          <span className="text-gray-600 ml-1">({totalEvs}/{MAX_TOTAL_EV})</span>
        </span>
      </div>

      {/* Stat rows */}
      {STATS.map(({ key, label }) => {
        const base      = species?.baseStats?.[key] ?? 0;
        const ev        = evs[key] ?? 0;
        const evMax     = Math.min(MAX_EV, evRemaining + ev);
        // Use pending plus/minus for live preview even before nature is committed
        const isPlus    = pendingPlus  === key;
        const isMinus   = pendingMinus === key;
        const finalStat   = calcStat(key, base, ev, pendingPlus, pendingMinus);
        const barColor    = statColor(finalStat); // driven by final stat so it shifts with EVs
        const labelColor  = isPlus ? 'text-blue-400' : isMinus ? 'text-red-400' : 'text-gray-400';
        const statTextCls = isPlus ? 'text-blue-400 font-bold' : isMinus ? 'text-red-400 font-bold' : 'text-gray-200';

        return (
          <div key={key} className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              {/* Label */}
              <span className={`w-7 text-xs font-semibold shrink-0 ${labelColor}`}>{label}</span>

              {/* Nature slider or spacer for HP */}
              {key === 'hp' ? (
                <span className="shrink-0" style={{ width: 56 }} />
              ) : (
                <NatureSlider
                  value={isPlus ? 'plus' : isMinus ? 'minus' : null}
                  onChange={pos => handleNatureSlider(key, pos)}
                />
              )}

              {/* EV slider */}
              <div className="flex-1 min-w-0">
                <EVSlider
                  value={ev}
                  max={evMax}
                  color={barColor}
                  onChange={val => setEV(key, val)}
                />
              </div>

              {/* EV value */}
              <span className="w-5 text-right text-xs text-gray-500 font-mono shrink-0">{ev}</span>

              {/* Final stat */}
              <span className={`w-10 text-right text-xs font-mono shrink-0 ${statTextCls}`}>
                {finalStat || '—'}{isPlus ? '+' : isMinus ? '−' : ''}
              </span>
            </div>

          </div>
        );
      })}

      {/* Nature dropdown */}
      <div className="pt-1 border-t border-gray-700/50">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 shrink-0">Nature</span>
          <select
            value={nature}
            onChange={e => onChange({ nature: e.target.value })}
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            {Object.keys(NATURES).map(n => {
              const nd  = NATURES[n];
              const tag = nd.plus ? ` (+${STAT_LABELS[nd.plus]} −${STAT_LABELS[nd.minus]})` : '';
              return <option key={n} value={n}>{n}{tag}</option>;
            })}
          </select>
          {(pendingPlus || pendingMinus) && (
            <span className="text-xs shrink-0">
              {pendingPlus  && <span className="text-blue-400">+{STAT_LABELS[pendingPlus]}</span>}
              {pendingPlus && pendingMinus && <span className="text-gray-600"> / </span>}
              {pendingMinus && <span className="text-red-400">−{STAT_LABELS[pendingMinus]}</span>}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
