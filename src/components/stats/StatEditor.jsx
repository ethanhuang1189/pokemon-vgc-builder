import { useState } from 'react';
import EVSlider from './EVSlider';
import NatureSlider, { NatureSliderSpacer } from './NatureSlider';
import {
  CHAMPIONS, STAT_KEYS, STAT_LABELS, NATURES,
  natureEffect, calcStat, totalEvs, setEv, applyNatureChoice,
} from '../../domain/stats.js';

// Final-stat colour ramp: [stat, rgb] stops, interpolated linearly.
const COLOR_STOPS = [
  [50, [239, 68, 68]],
  [100, [234, 179, 8]],
  [150, [34, 197, 94]],
  [200, [59, 130, 246]],
];

function statColor(stat) {
  const rgb = (c) => `rgb(${c.join(',')})`;
  if (stat <= COLOR_STOPS[0][0]) return rgb(COLOR_STOPS[0][1]);
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const [lo, loRgb] = COLOR_STOPS[i];
    const [hi, hiRgb] = COLOR_STOPS[i + 1];
    if (stat <= hi) {
      const t = (stat - lo) / (hi - lo);
      return rgb(loRgb.map((c, j) => Math.round(c + t * (hiRgb[j] - c))));
    }
  }
  return rgb(COLOR_STOPS[COLOR_STOPS.length - 1][1]);
}

const natureTag = (name) => {
  const { plus, minus } = NATURES[name];
  return plus ? ` (+${STAT_LABELS[plus]} −${STAT_LABELS[minus]})` : '';
};

function StatRow({ statKey, base, ev, evMax, plus, minus, onEvChange, onNatureChange }) {
  const isPlus = plus === statKey;
  const isMinus = minus === statKey;
  const finalStat = calcStat(statKey, base, ev, plus, minus);
  const tone = isPlus ? 'text-blue-400' : isMinus ? 'text-red-400' : '';

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-7 text-xs font-semibold shrink-0 ${tone || 'text-gray-400'}`}>{STAT_LABELS[statKey]}</span>
      {statKey === 'hp'
        ? <NatureSliderSpacer />
        : <NatureSlider value={isPlus ? 'plus' : isMinus ? 'minus' : null} onChange={onNatureChange} />}
      <div className="flex-1 min-w-0">
        <EVSlider value={ev} max={evMax} scale={CHAMPIONS.MAX_EV} color={statColor(finalStat)} onChange={onEvChange} />
      </div>
      <span className="w-5 text-right text-xs text-gray-500 font-mono shrink-0">{ev}</span>
      <span className={`w-10 text-right text-xs font-mono shrink-0 ${tone ? `${tone} font-bold` : 'text-gray-200'}`}>
        {finalStat || '—'}{isPlus ? '+' : isMinus ? '−' : ''}
      </span>
    </div>
  );
}

export default function StatEditor({ slot, onChange }) {
  const { evs, nature, species } = slot;
  // Half-chosen natures (only + or only −) stay visible here until both sides are set.
  const [pending, setPending] = useState(() => ({ nature, ...natureEffect(nature) }));
  const effective = pending.nature === nature ? pending : { nature, ...natureEffect(nature) };
  const { plus = null, minus = null } = effective;

  const remaining = CHAMPIONS.MAX_TOTAL_EV - totalEvs(evs);

  function handleNature(key, position) {
    const next = applyNatureChoice({ plus, minus }, key, position);
    const committed = next.nature ?? nature;
    setPending({ nature: committed, plus: next.plus, minus: next.minus });
    if (next.nature && next.nature !== nature) onChange({ nature: next.nature });
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between text-xs px-0.5">
        <span className="text-gray-500 font-medium">EVs</span>
        <span className="font-mono">
          <span className={remaining === 0 ? 'text-yellow-400 font-semibold' : 'text-gray-400'}>{remaining} remaining</span>
          <span className="text-gray-600 ml-1">({totalEvs(evs)}/{CHAMPIONS.MAX_TOTAL_EV})</span>
        </span>
      </div>

      {STAT_KEYS.map(key => (
        <StatRow key={key} statKey={key}
          base={species?.baseStats?.[key] ?? 0}
          ev={evs[key] ?? 0}
          evMax={Math.min(CHAMPIONS.MAX_EV, remaining + (evs[key] ?? 0))}
          plus={plus} minus={minus}
          onEvChange={value => onChange({ evs: setEv(evs, key, value) })}
          onNatureChange={position => handleNature(key, position)} />
      ))}

      <div className="pt-1 border-t border-gray-700/50 flex items-center gap-2">
        <span className="text-xs text-gray-500 shrink-0">Nature</span>
        <select value={nature} onChange={e => onChange({ nature: e.target.value })}
          className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500">
          {Object.keys(NATURES).map(n => <option key={n} value={n}>{n}{natureTag(n)}</option>)}
        </select>
        {(plus || minus) && (
          <span className="text-xs shrink-0">
            {plus && <span className="text-blue-400">+{STAT_LABELS[plus]}</span>}
            {plus && minus && <span className="text-gray-600"> / </span>}
            {minus && <span className="text-red-400">−{STAT_LABELS[minus]}</span>}
          </span>
        )}
      </div>
    </div>
  );
}
