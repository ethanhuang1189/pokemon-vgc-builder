import { useMemo, useState } from 'react';
import { useTeam } from '../context/TeamContext';
import { usePicker } from '../context/PickerContext';
import { ALL_TYPES, TYPE_COLORS, getEffectiveness } from '../data/typeChart';
import { GIF_SPRITE, SHOWDOWN_STATIC } from '../utils/sprites';

const EFF_CONFIG = {
  4:    { bg: 'rgba(220,38,38,0.80)',  text: '#fff',    label: '4×' },
  2:    { bg: 'rgba(239,68,68,0.40)',  text: '#fca5a5', label: '2×' },
  0.5:  { bg: 'rgba(34,197,94,0.25)', text: '#86efac', label: '½×' },
  0.25: { bg: 'rgba(34,197,94,0.55)', text: '#4ade80', label: '¼×' },
  0:    { bg: 'rgba(100,116,139,0.40)', text: '#cbd5e1', label: '0×' },
};

function SlotSprite({ species }) {
  const [idx, setIdx] = useState(0);
  const urls = [GIF_SPRITE(species.name), SHOWDOWN_STATIC(species.name)];
  const src = urls[Math.min(idx, urls.length - 1)];
  return (
    <img
      src={src}
      alt={species.name}
      draggable="false"
      className="w-9 h-9 object-contain"
      onError={() => setIdx(i => i + 1)}
    />
  );
}

export default function WeaknessChart() {
  const { team } = useTeam();
  const { allMegas } = usePicker();

  const slots = useMemo(() => {
    return team
      .map((slot, index) => {
        if (!slot.species) return null;
        const mega = slot.megaFormId ? allMegas.find(m => m.id === slot.megaFormId) : null;
        const types = (mega ?? slot.species).types;
        const displayName = slot.nickname || (mega ? mega.name : slot.species.name);
        return { index, types, displayName, species: slot.species };
      })
      .filter(Boolean);
  }, [team, allMegas]);

  const rows = useMemo(() => {
    return ALL_TYPES.map(type => {
      const cells = slots.map(s => getEffectiveness(type, s.types));
      const score = cells.reduce((acc, eff) => {
        if (eff > 1)  return acc - 1;
        if (eff < 1)  return acc + 1;
        return acc;
      }, 0);
      return { type, cells, score };
    });
  }, [slots]);

  if (slots.length === 0) {
    return <p className="text-gray-500 text-xs">Add Pokémon to see the weakness chart</p>;
  }

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="text-xs border-collapse" style={{ minWidth: `${72 + slots.length * 56 + 48}px`, width: '100%' }}>
        <thead>
          <tr>
            <th className="text-left text-[9px] text-gray-500 font-normal uppercase tracking-wide pb-2 pr-2"
                style={{ width: '72px' }}>
              Type
            </th>
            {slots.map(s => (
              <th key={s.index} className="text-center pb-1.5" style={{ width: '56px' }}>
                <div className="flex flex-col items-center gap-0.5">
                  <SlotSprite species={s.species} />
                  <span
                    className="text-[8px] text-gray-400 leading-none block"
                    style={{ maxWidth: '54px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={s.displayName}
                  >
                    {s.displayName}
                  </span>
                </div>
              </th>
            ))}
            <th className="text-center pb-2 text-[9px] text-gray-500 font-normal" style={{ width: '48px' }}>
              Score
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ type, cells, score }) => (
            <tr key={type} className="border-t border-gray-700/40 hover:bg-gray-700/10">
              <td className="py-0.5 pr-2">
                <span
                  className="inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded leading-none"
                  style={{
                    background: `${TYPE_COLORS[type]}28`,
                    color: TYPE_COLORS[type],
                    border: `1px solid ${TYPE_COLORS[type]}50`,
                  }}
                >
                  {type}
                </span>
              </td>
              {cells.map((eff, ci) => {
                const cfg = EFF_CONFIG[eff];
                return (
                  <td key={ci} className="py-0.5 text-center">
                    {cfg ? (
                      <span
                        className="inline-block text-[9px] font-bold px-1 py-0.5 rounded leading-none"
                        style={{ background: cfg.bg, color: cfg.text }}
                      >
                        {cfg.label}
                      </span>
                    ) : null}
                  </td>
                );
              })}
              <td className="py-0.5 text-center font-bold font-mono text-[11px]"
                style={{ color: score > 0 ? '#4ade80' : score < 0 ? '#f87171' : '#6b7280' }}>
                {score === 0 ? <span className="text-gray-700">0</span> : score > 0 ? `+${score}` : score}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
