import { useState } from 'react';
import TypeBadge from '../TypeBadge';
import { Card, ExpandableRow, MemberLine, TypeName, Warning } from './shared';
import { CRITICAL_COUNT, severityColor } from './severity.js';
import { TYPE_COLORS } from '../typeColors.js';

export default function TypeDisparity({ details }) {
  const [active, setActive] = useState(null);
  const rows = Object.entries(details).sort((a, b) => b[1].length - a[1].length);
  const overlapping = rows.filter(([, members]) => members.length >= CRITICAL_COUNT).map(([type]) => type);

  return (
    <Card title="Type Disparity" subtitle="How many Pokémon share each type — tap to see which">
      {rows.length === 0 ? (
        <p className="text-gray-500 text-xs">Add Pokémon to see type distribution</p>
      ) : (
        <div className="space-y-0.5">
          {rows.map(([type, members]) => {
            const count = members.length;
            const color = severityColor(count, TYPE_COLORS[type]);
            return (
              <ExpandableRow key={type} expanded={active === type} onToggle={() => setActive(a => (a === type ? null : type))}
                header={<>
                  <TypeBadge type={type} />
                  <div className="flex gap-1">
                    {members.map((_, i) => <div key={i} className="w-3 h-3 rounded-sm" style={{ background: color }} />)}
                  </div>
                  <span className="text-xs text-gray-400">{count} Pokémon</span>
                  {count >= CRITICAL_COUNT && <span className="text-red-400 text-xs ml-auto">⚠ Overlap</span>}
                  {count === 2 && <span className="text-yellow-400 text-xs ml-auto">↑ Overlap</span>}
                </>}>
                <div className="text-xs text-gray-400 mb-1"><TypeName type={type} />-type Pokémon:</div>
                {members.map((m, i) => <MemberLine key={i} {...m} />)}
              </ExpandableRow>
            );
          })}
        </div>
      )}
      {overlapping.length > 0 && (
        <Warning>{CRITICAL_COUNT}+ Pokémon share {overlapping.join(', ')} typing — consider diversifying.</Warning>
      )}
    </Card>
  );
}
