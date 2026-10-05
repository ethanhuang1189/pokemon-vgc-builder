import { useState } from 'react';
import TypeBadge from '../TypeBadge';
import { Card, ExpandableRow, MemberLine, TypeName, Warning } from './shared';
import { CRITICAL_COUNT, severityColor } from './severity.js';

export default function TeamWeaknesses({ details, teamSize }) {
  const [active, setActive] = useState(null);
  const rows = Object.entries(details).sort((a, b) => b[1].length - a[1].length);
  const critical = rows.filter(([, members]) => members.length >= CRITICAL_COUNT).map(([type]) => type);

  return (
    <Card title="Team Weaknesses" subtitle="Number of your Pokémon weak to each type — tap to see which">
      {teamSize === 0 ? (
        <p className="text-gray-500 text-xs">Add Pokémon to see weaknesses</p>
      ) : (
        <div className="space-y-0.5">
          {rows.map(([type, members]) => {
            const color = severityColor(members.length);
            return (
              <ExpandableRow key={type} expanded={active === type} onToggle={() => setActive(a => (a === type ? null : type))}
                header={<>
                  <TypeBadge type={type} />
                  <div className="flex-1 h-2 bg-gray-700 rounded overflow-hidden">
                    <div className="h-full rounded transition-all" style={{ width: `${(members.length / teamSize) * 100}%`, background: color }} />
                  </div>
                  <span className="text-xs font-mono font-bold w-4 text-right" style={{ color }}>{members.length}</span>
                </>}>
                <div className="text-xs text-gray-400 mb-1">Weak to <TypeName type={type} />:</div>
                {members.map((m, i) => (
                  <MemberLine key={i} {...m}><span className="text-red-400 ml-auto font-mono">×{m.eff}</span></MemberLine>
                ))}
              </ExpandableRow>
            );
          })}
          {critical.length > 0 && (
            <Warning>Critical weakness ({CRITICAL_COUNT}+): {critical.map(t => <TypeBadge key={t} type={t} className="mr-1" />)}</Warning>
          )}
        </div>
      )}
    </Card>
  );
}
