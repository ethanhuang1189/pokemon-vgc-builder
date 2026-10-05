import { useMemo } from 'react';
import PokemonSprite from './PokemonSprite';
import { useTeam } from '../context/TeamContext';
import { TYPE_COLORS } from './typeColors.js';
import { ALL_TYPES, getEffectiveness } from '../domain/typeChart.js';
import { filledSlots, slotDisplayName } from '../domain/analysis.js';

const EFF_STYLE = {
  4: { bg: 'rgba(220,38,38,0.80)', text: '#fff', label: '4×' },
  3: { bg: 'rgba(220,38,38,0.60)', text: '#fca5a5', label: '3×' },
  2: { bg: 'rgba(239,68,68,0.40)', text: '#fca5a5', label: '2×' },
  1.5: { bg: 'rgba(239,68,68,0.22)', text: '#fcd5a5', label: '1½×' },
  0.5: { bg: 'rgba(34,197,94,0.25)', text: '#86efac', label: '½×' },
  0.25: { bg: 'rgba(34,197,94,0.55)', text: '#4ade80', label: '¼×' },
  0: { bg: 'rgba(100,116,139,0.40)', text: '#cbd5e1', label: '0×' },
};

const abbreviate = (name, len) => (name.length > len ? `${name.slice(0, len - 1)}…` : name);

// +1 per resisting member, −1 per weak member.
const rowScore = (cells) => cells.reduce((score, eff) => score + (eff < 1) - (eff > 1), 0);

function ScoreCell({ score }) {
  const color = score > 0 ? '#4ade80' : score < 0 ? '#f87171' : '#6b7280';
  return (
    <td className="py-px text-center text-[9px] font-bold font-mono" style={{ color }}>
      {score === 0 ? '' : score > 0 ? `+${score}` : score}
    </td>
  );
}

export default function WeaknessChart() {
  const { team } = useTeam();
  const members = useMemo(() => filledSlots(team), [team]);

  const rows = useMemo(() => ALL_TYPES.map(type => {
    const cells = members.map(slot => getEffectiveness(type, slot.species.types, slot.ability));
    return { type, cells, score: rowScore(cells) };
  }), [members]);

  if (members.length === 0) return <p className="text-gray-500 text-xs">Add Pokémon to see the weakness chart</p>;

  return (
    <table className="w-full text-xs border-collapse table-fixed">
      <thead>
        <tr>
          <th style={{ width: 58 }} />
          {members.map((slot, i) => {
            const name = slotDisplayName(slot);
            return (
              <th key={i} className="text-center pb-1 px-px">
                <div className="flex flex-col items-center gap-px">
                  <PokemonSprite species={slot.species} size={28} glow={false} alt={name} />
                  <span className="block text-[7px] text-gray-400 font-normal leading-none truncate w-full text-center" title={name}>
                    {abbreviate(name, 7)}
                  </span>
                </div>
              </th>
            );
          })}
          <th className="text-center pb-1 text-[8px] text-gray-500 font-normal" style={{ width: 32 }}>Score</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ type, cells, score }) => (
          <tr key={type} className="border-t border-gray-700/40 hover:bg-gray-700/10">
            <td className="py-px pr-1">
              <span className="inline-block text-[8px] font-semibold px-1 py-0.5 rounded leading-none whitespace-nowrap"
                style={{ background: `${TYPE_COLORS[type]}28`, color: TYPE_COLORS[type], border: `1px solid ${TYPE_COLORS[type]}50` }}>
                {type}
              </span>
            </td>
            {cells.map((eff, i) => {
              const style = EFF_STYLE[eff];
              return (
                <td key={i} className="py-px text-center px-px">
                  {style && (
                    <span className="inline-block text-[8px] font-bold px-0.5 rounded leading-tight"
                      style={{ background: style.bg, color: style.text }}>{style.label}</span>
                  )}
                </td>
              );
            })}
            <ScoreCell score={score} />
          </tr>
        ))}
      </tbody>
    </table>
  );
}
