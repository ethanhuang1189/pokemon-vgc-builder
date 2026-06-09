import { useMemo } from 'react';
import { useTeam } from '../context/TeamContext';
import { usePicker } from '../context/PickerContext';
import { ALL_TYPES, TYPE_COLORS, getEffectiveness } from '../data/typeChart';
import { GIF_SPRITE, handleSpriteError } from '../utils/sprites';

const EFF_CONFIG = {
  4:    { bg: 'rgba(220,38,38,0.80)',   text: '#fff',    label: '4×' },
  2:    { bg: 'rgba(239,68,68,0.40)',   text: '#fca5a5', label: '2×' },
  0.5:  { bg: 'rgba(34,197,94,0.25)',  text: '#86efac', label: '½×' },
  0.25: { bg: 'rgba(34,197,94,0.55)',  text: '#4ade80', label: '¼×' },
  0:    { bg: 'rgba(100,116,139,0.40)', text: '#cbd5e1', label: '0×' },
};

function abbrev(name, len = 6) {
  return name.length > len ? name.slice(0, len - 1) + '…' : name;
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
        if (eff > 1) return acc - 1;
        if (eff < 1) return acc + 1;
        return acc;
      }, 0);
      return { type, cells, score };
    });
  }, [slots]);

  if (slots.length === 0) {
    return <p className="text-gray-500 text-xs">Add Pokémon to see the weakness chart</p>;
  }

  return (
    <table className="w-full text-xs border-collapse table-fixed">
      <thead>
        <tr>
          {/* Fixed width — wide enough for "Electric" badge */}
          <th style={{ width: '58px' }} />
          {slots.map(s => (
            <th key={s.index} className="text-center pb-1 px-px">
              <div className="flex flex-col items-center gap-px">
                <img
                  src={GIF_SPRITE(s.species.name)}
                  alt={s.displayName}
                  draggable="false"
                  className="w-7 h-7 object-contain"
                  title={s.displayName}
                  onError={e => handleSpriteError(e, s.species.name, s.species.num)}
                />
                <span
                  className="block text-[7px] text-gray-400 font-normal leading-none truncate w-full text-center"
                  title={s.displayName}
                >
                  {abbrev(s.displayName, 7)}
                </span>
              </div>
            </th>
          ))}
          <th className="text-center pb-1 text-[8px] text-gray-500 font-normal" style={{ width: '32px' }}>
            Score
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ type, cells, score }) => (
          <tr key={type} className="border-t border-gray-700/40 hover:bg-gray-700/10">
            <td className="py-px pr-1">
              <span
                className="inline-block text-[8px] font-semibold px-1 py-0.5 rounded leading-none whitespace-nowrap"
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
                <td key={ci} className="py-px text-center px-px">
                  {cfg ? (
                    <span
                      className="inline-block text-[8px] font-bold px-0.5 rounded leading-tight"
                      style={{ background: cfg.bg, color: cfg.text }}
                    >
                      {cfg.label}
                    </span>
                  ) : null}
                </td>
              );
            })}
            <td
              className="py-px text-center text-[9px] font-bold font-mono"
              style={{ color: score > 0 ? '#4ade80' : score < 0 ? '#f87171' : '#6b7280' }}
            >
              {score === 0 ? '' : score > 0 ? `+${score}` : score}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
