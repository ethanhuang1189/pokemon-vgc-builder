import { useState } from 'react';
import { Card, DetailBox, MoveLine, TypeName } from './shared';
import { TYPE_COLORS } from '../typeColors.js';
import { ALL_TYPES } from '../../domain/typeChart.js';

function TypeTile({ type, hit, active, onClick }) {
  const color = TYPE_COLORS[type];
  return (
    <button type="button" disabled={!hit} onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-left transition-all ${hit ? 'cursor-pointer' : 'opacity-40 cursor-default'}`}
      style={{
        background: hit ? `${color}22` : '#374151',
        border: `1px solid ${hit ? color : '#4b5563'}`,
        color: hit ? color : '#6b7280',
        outline: active ? `2px solid ${color}` : 'none',
        outlineOffset: '1px',
      }}>
      <span>{hit ? '✓' : '✗'}</span><span>{type}</span>
    </button>
  );
}

export default function OffensiveCoverage({ coverage, details }) {
  const [active, setActive] = useState(null);
  return (
    <Card title="Offensive Coverage" subtitle="Types your team can hit super effectively — tap to see which move">
      <div className="grid grid-cols-3 gap-1">
        {ALL_TYPES.map(type => (
          <TypeTile key={type} type={type} hit={coverage.covered.has(type)} active={active === type}
            onClick={() => setActive(a => (a === type ? null : type))} />
        ))}
      </div>
      {active && (
        <DetailBox>
          <div className="text-xs text-gray-400 mb-1">Hits <TypeName type={active} /> SE via:</div>
          {(details[active] ?? []).map(d => <MoveLine key={`${d.pokeName}|${d.moveName}`} {...d} />)}
        </DetailBox>
      )}
      {coverage.uncovered.size > 0 && (
        <p className="text-xs text-yellow-400 mt-2">No SE coverage vs: {[...coverage.uncovered].join(', ')}</p>
      )}
    </Card>
  );
}
