import { useState } from 'react';
import TypeBadge from '../TypeBadge';
import { Card, DetailBox, MoveLine, MemberLine } from './shared';

function MetaRow({ meta, topUsage, expanded, onToggle }) {
  return (
    <div>
      <button type="button" onClick={onToggle}
        className={`w-full flex items-center gap-2 px-1.5 py-1 rounded text-left transition-colors ${expanded ? 'bg-gray-700/60' : 'hover:bg-gray-700/30'}`}>
        <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${meta.covered ? 'bg-green-400' : 'bg-red-500'}`} />
        <span className="text-xs text-white font-medium w-28 shrink-0 truncate">{meta.name}</span>
        <div className="flex gap-0.5 shrink-0">{meta.types.map(t => <TypeBadge key={t} type={t} size="xs" />)}</div>
        <div className="flex-1 h-1 bg-gray-700 rounded overflow-hidden">
          <div className="h-full bg-indigo-500/60 rounded" style={{ width: `${Math.min(100, (meta.usage / topUsage) * 100)}%` }} />
        </div>
        <span className="text-[10px] text-gray-500 font-mono shrink-0 w-10 text-right">{meta.usage.toFixed(1)}%</span>
      </button>

      {expanded && (
        <DetailBox>
          {meta.covered ? (
            <>
              <div className="text-xs text-green-400 font-medium mb-0.5">SE coverage:</div>
              {meta.coveringMoves.map(m => (
                <MoveLine key={`${m.pokeName}|${m.moveName}`} {...m}>
                  {m.eff === 4 && <span className="text-yellow-400 ml-auto text-[10px]">×4</span>}
                </MoveLine>
              ))}
            </>
          ) : (
            <div className="text-xs text-red-400">No SE coverage — this Pokémon is a blind spot</div>
          )}
          {meta.threatened.length > 0 ? (
            <>
              <div className="text-xs text-yellow-400 font-medium mt-1.5 mb-0.5">Threatens your team (STAB):</div>
              {meta.threatened.map((t, i) => (
                <MemberLine key={i} pokeName={t.pokeName} types={t.types}>
                  <span className="text-gray-500 ml-1 text-[10px]">via {t.via}</span>
                  <span className="text-red-400 ml-auto font-mono text-[10px]">×{t.eff}</span>
                </MemberLine>
              ))}
            </>
          ) : (
            <div className="text-xs text-gray-500 mt-1">No STAB threats to your team</div>
          )}
        </DetailBox>
      )}
    </div>
  );
}

export default function MetaThreats({ analysis, label, loading, error, onRefresh }) {
  const [expanded, setExpanded] = useState(null);
  const uncovered = analysis.filter(m => !m.covered).length;

  const refresh = !loading && (
    <button type="button" onClick={onRefresh} title="Refresh usage data"
      className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors">↺ refresh</button>
  );

  return (
    <Card title="Meta Threats" action={refresh}>
      {loading && <p className="text-gray-500 text-xs">Loading usage stats…</p>}
      {error && !loading && <p className="text-red-400 text-xs">{error}</p>}
      {!loading && !error && label && analysis.length === 0 && (
        <p className="text-gray-500 text-xs">No matching Pokémon found in Dex</p>
      )}

      {analysis.length > 0 && (
        <>
          <p className="text-xs text-gray-600 mb-3">{label} · tap for details</p>
          {uncovered > 0 && (
            <div className="mb-3 text-xs text-red-400 bg-red-400/10 rounded px-2 py-1.5">
              No SE coverage vs {uncovered} top-{analysis.length} Pokémon
            </div>
          )}
          <div className="space-y-px">
            {analysis.map(meta => (
              <MetaRow key={meta.name} meta={meta} topUsage={analysis[0].usage}
                expanded={expanded === meta.name}
                onToggle={() => setExpanded(e => (e === meta.name ? null : meta.name))} />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
