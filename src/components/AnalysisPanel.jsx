import { useMemo, useState, useEffect } from 'react';
import TypeBadge from './TypeBadge';
import { ALL_TYPES, TYPE_COLORS } from '../data/typeChart';
import {
  getCoverage, getCoverageDetails,
  getTeamWeaknesses, getWeaknessDetails,
  getTypeDisparity, getDisparityDetails,
  analyzeMetaList,
} from '../utils/analysis';
import { fetchMetaStats, clearMetaCache } from '../utils/metaStats';
import { useTeam } from '../context/TeamContext';

function SectionTitle({ children }) {
  return <h3 className="text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wide">{children}</h3>;
}

function DetailBox({ children }) {
  return (
    <div className="mt-1.5 bg-gray-900/60 border border-gray-600/60 rounded px-2 py-1.5 space-y-1">
      {children}
    </div>
  );
}

export default function AnalysisPanel() {
  const { team, Dex } = useTeam();
  const [activeDetail, setActiveDetail] = useState(null); // { section, key }

  // Meta stats state
  const [metaRaw, setMetaRaw]     = useState(null); // { data: [{name, usage}], label }
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError]   = useState('');
  const [activeMeta, setActiveMeta] = useState(null); // name of expanded meta entry

  const filledSlots = team.filter(s => s.species);
  const coverage         = useMemo(() => getCoverage(team),         [team]);
  const coverageDetails  = useMemo(() => getCoverageDetails(team),  [team]);
  const weaknesses       = useMemo(() => getTeamWeaknesses(team),   [team]);
  const weaknessDetails  = useMemo(() => getWeaknessDetails(team),  [team]);
  const disparity        = useMemo(() => getTypeDisparity(team),    [team]);
  const disparityDetails = useMemo(() => getDisparityDetails(team), [team]);

  const weaknessWarnings  = ALL_TYPES.filter(t => weaknesses[t] >= 3);
  const disparityWarnings = Object.entries(disparity).filter(([, c]) => c >= 3);

  // Fetch meta stats on mount
  useEffect(() => {
    setMetaLoading(true);
    setMetaError('');
    fetchMetaStats()
      .then(result => {
        setMetaRaw(result);
        if (!result) setMetaError('Could not load usage data — check connection');
      })
      .catch(() => setMetaError('Failed to load usage data'))
      .finally(() => setMetaLoading(false));
  }, []);

  // Resolve types for top 30 meta Pokémon using the Dex.
  // Pikalytics slugs: "Sneasler", "Charizard-Mega-Y", "Basculegion-F" etc.
  // Try slug-based ID first, then name-based, then strip all separators.
  const metaWithTypes = useMemo(() => {
    if (!metaRaw?.data) return [];
    return metaRaw.data
      .slice(0, 30)
      .map(p => {
        const attempts = [
          // slug without separators: "Charizard-Mega-Y" → "charizardmegay"
          (p.slug || p.name).toLowerCase().replace(/[-\s_]/g, ''),
          // name without separators
          p.name.toLowerCase().replace(/[-\s_]/g, ''),
          // slug as-is lowercased (some dexes accept hyphenated)
          (p.slug || p.name).toLowerCase(),
        ];
        for (const id of attempts) {
          const species = Dex.species.get(id);
          if (species?.exists) return { ...p, types: species.types };
        }
        return null;
      })
      .filter(Boolean);
  }, [metaRaw, Dex]);

  // Run meta analysis against the current team
  const metaAnalysis = useMemo(
    () => analyzeMetaList(team, metaWithTypes),
    [team, metaWithTypes]
  );

  const coveredCount   = metaAnalysis.filter(m => m.covered).length;
  const uncoveredCount = metaAnalysis.length - coveredCount;

  function toggleDetail(section, key) {
    if (activeDetail?.section === section && activeDetail?.key === key) {
      setActiveDetail(null);
    } else {
      setActiveDetail({ section, key });
    }
  }
  function isActive(section, key) {
    return activeDetail?.section === section && activeDetail?.key === key;
  }

  return (
    <div className="space-y-5">

      {/* Team summary */}
      <div className="bg-gray-800 border border-gray-700 rounded-sm p-4">
        <SectionTitle>Team Summary</SectionTitle>
        <div className="flex gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{filledSlots.length}</div>
            <div className="text-gray-400 text-xs">Pokemon</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${coverage.uncovered.size > 6 ? 'text-red-400' : coverage.uncovered.size > 3 ? 'text-yellow-400' : 'text-green-400'}`}>
              {18 - coverage.uncovered.size}/18
            </div>
            <div className="text-gray-400 text-xs">Coverage</div>
          </div>
          {metaAnalysis.length > 0 && (
            <div className="text-center">
              <div className={`text-2xl font-bold ${uncoveredCount === 0 ? 'text-green-400' : uncoveredCount <= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                {coveredCount}/{metaAnalysis.length}
              </div>
              <div className="text-gray-400 text-xs">Meta SE</div>
            </div>
          )}
        </div>
        {filledSlots.length > 6 && (
          <div className="mt-2 text-xs text-red-400 bg-red-400/10 rounded px-2 py-1">
            Team exceeds 6 Pokemon
          </div>
        )}
      </div>

      {/* Meta Analysis */}
      <div className="bg-gray-800 border border-gray-700 rounded-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <SectionTitle>Meta Threats</SectionTitle>
          {!metaLoading && (
            <button
              type="button"
              onClick={() => { clearMetaCache(); setMetaRaw(null); setMetaLoading(true); setMetaError('');
                fetchMetaStats().then(r => { setMetaRaw(r); if (!r) setMetaError('Could not load'); }).catch(() => setMetaError('Failed')).finally(() => setMetaLoading(false)); }}
              className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
              title="Refresh usage data"
            >
              ↺ refresh
            </button>
          )}
        </div>

        {metaLoading && (
          <p className="text-gray-500 text-xs">Loading usage stats…</p>
        )}
        {metaError && !metaLoading && (
          <p className="text-red-400 text-xs">{metaError}</p>
        )}

        {metaAnalysis.length > 0 && (
          <>
            <p className="text-xs text-gray-600 mb-3">
              {metaRaw?.label} · tap for details
            </p>

            {/* Uncovered threats summary */}
            {uncoveredCount > 0 && (
              <div className="mb-3 text-xs text-red-400 bg-red-400/10 rounded px-2 py-1.5">
                No SE coverage vs {uncoveredCount} top-{metaAnalysis.length} Pokémon
              </div>
            )}

            <div className="space-y-px">
              {metaAnalysis.map(meta => {
                const expanded = activeMeta === meta.name;
                const barWidth = `${Math.min(100, (meta.usage / metaAnalysis[0].usage) * 100)}%`;
                return (
                  <div key={meta.name}>
                    <button
                      type="button"
                      onClick={() => setActiveMeta(expanded ? null : meta.name)}
                      className={`w-full flex items-center gap-2 px-1.5 py-1 rounded text-left transition-colors ${expanded ? 'bg-gray-700/60' : 'hover:bg-gray-700/30'}`}
                    >
                      {/* Coverage dot */}
                      <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${meta.covered ? 'bg-green-400' : 'bg-red-500'}`} />

                      {/* Name + types */}
                      <span className="text-xs text-white font-medium w-28 shrink-0 truncate">{meta.name}</span>
                      <div className="flex gap-0.5 shrink-0">
                        {meta.types.map(t => <TypeBadge key={t} type={t} size="xs" />)}
                      </div>

                      {/* Usage bar */}
                      <div className="flex-1 h-1 bg-gray-700 rounded overflow-hidden">
                        <div className="h-full bg-indigo-500/60 rounded" style={{ width: barWidth }} />
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono shrink-0 w-10 text-right">
                        {meta.usage.toFixed(1)}%
                      </span>
                    </button>

                    {expanded && (
                      <DetailBox>
                        {/* Can your team hit it SE? */}
                        {meta.covered ? (
                          <>
                            <div className="text-xs text-green-400 font-medium mb-0.5">SE coverage:</div>
                            {meta.coveringMoves.map((m, i) => (
                              <div key={i} className="flex items-center gap-1 text-xs">
                                <span className="text-white">{m.pokeName}</span>
                                <span className="text-gray-600">—</span>
                                <span style={{ color: TYPE_COLORS[m.moveType] }}>{m.moveName}</span>
                                {m.eff === 4 && <span className="text-yellow-400 ml-auto text-[10px]">×4</span>}
                              </div>
                            ))}
                          </>
                        ) : (
                          <div className="text-xs text-red-400">No SE coverage — this Pokémon is a blind spot</div>
                        )}

                        {/* Can it threaten your team? */}
                        {meta.threatened.length > 0 && (
                          <>
                            <div className="text-xs text-yellow-400 font-medium mt-1.5 mb-0.5">Threatens your team (STAB):</div>
                            {meta.threatened.map((t, i) => (
                              <div key={i} className="flex items-center gap-1 text-xs">
                                <span className="text-white">{t.pokeName}</span>
                                <span className="flex gap-0.5 ml-0.5">
                                  {t.types.map(ty => <TypeBadge key={ty} type={ty} />)}
                                </span>
                                <span className="text-gray-500 ml-1 text-[10px]">via {t.via}</span>
                                <span className="text-red-400 ml-auto font-mono text-[10px]">×{t.eff}</span>
                              </div>
                            ))}
                          </>
                        )}
                        {meta.threatened.length === 0 && (
                          <div className="text-xs text-gray-500 mt-1">No STAB threats to your team</div>
                        )}
                      </DetailBox>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!metaLoading && !metaError && metaWithTypes.length === 0 && metaRaw && (
          <p className="text-gray-500 text-xs">No matching Pokémon found in Dex</p>
        )}
      </div>

      {/* Offensive Coverage */}
      <div className="bg-gray-800 border border-gray-700 rounded-sm p-4">
        <SectionTitle>Offensive Coverage</SectionTitle>
        <p className="text-xs text-gray-500 mb-3">Types your team can hit super effectively — tap to see which move</p>
        <div className="grid grid-cols-3 gap-1">
          {ALL_TYPES.map(type => {
            const hit = coverage.covered.has(type);
            const active = isActive('coverage', type);
            return (
              <button
                key={type}
                type="button"
                disabled={!hit}
                onClick={() => toggleDetail('coverage', type)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-left transition-all ${hit ? 'cursor-pointer' : 'opacity-40 cursor-default'}`}
                style={{
                  background: hit ? `${TYPE_COLORS[type]}22` : '#374151',
                  border: `1px solid ${hit ? TYPE_COLORS[type] : '#4b5563'}`,
                  color: hit ? TYPE_COLORS[type] : '#6b7280',
                  outline: active ? `2px solid ${TYPE_COLORS[type]}` : 'none',
                  outlineOffset: '1px',
                }}
              >
                <span>{hit ? '✓' : '✗'}</span>
                <span>{type}</span>
              </button>
            );
          })}
        </div>

        {activeDetail?.section === 'coverage' && (
          <DetailBox>
            <div className="text-xs text-gray-400 mb-1">
              Hits <span style={{ color: TYPE_COLORS[activeDetail.key] }} className="font-semibold">{activeDetail.key}</span> SE via:
            </div>
            {(coverageDetails[activeDetail.key] ?? []).map((d, i) => (
              <div key={i} className="flex items-center gap-1 text-xs">
                <span className="text-white font-medium">{d.pokeName}</span>
                <span className="text-gray-600">—</span>
                <span style={{ color: TYPE_COLORS[d.moveType] }}>{d.moveName}</span>
              </div>
            ))}
          </DetailBox>
        )}

        {coverage.uncovered.size > 0 && (
          <p className="text-xs text-yellow-400 mt-2">
            No SE coverage vs: {[...coverage.uncovered].join(', ')}
          </p>
        )}
      </div>

      {/* Team Weaknesses */}
      <div className="bg-gray-800 border border-gray-700 rounded-sm p-4">
        <SectionTitle>Team Weaknesses</SectionTitle>
        <p className="text-xs text-gray-500 mb-3">Number of your Pokemon weak to each type — tap to see which</p>
        {filledSlots.length === 0 ? (
          <p className="text-gray-500 text-xs">Add Pokemon to see weaknesses</p>
        ) : (
          <div className="space-y-0.5">
            {ALL_TYPES.filter(t => weaknesses[t] > 0)
              .sort((a, b) => weaknesses[b] - weaknesses[a])
              .map(type => {
                const count = weaknesses[type];
                const pct   = (count / Math.max(filledSlots.length, 1)) * 100;
                const color = count >= 3 ? '#ef4444' : count === 2 ? '#f59e0b' : '#6b7280';
                const active = isActive('weakness', type);
                return (
                  <div key={type}>
                    <button type="button"
                      className={`w-full flex items-center gap-2 px-1 py-0.5 rounded transition-colors ${active ? 'bg-gray-700/60' : 'hover:bg-gray-700/30'}`}
                      onClick={() => toggleDetail('weakness', type)}>
                      <TypeBadge type={type} />
                      <div className="flex-1 h-2 bg-gray-700 rounded overflow-hidden">
                        <div className="h-full rounded transition-all" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <span className="text-xs font-mono font-bold w-4 text-right" style={{ color }}>{count}</span>
                    </button>
                    {active && (
                      <DetailBox>
                        <div className="text-xs text-gray-400 mb-1">
                          Weak to <span style={{ color: TYPE_COLORS[type] }} className="font-semibold">{type}</span>:
                        </div>
                        {(weaknessDetails[type] ?? []).map((d, i) => (
                          <div key={i} className="flex items-center gap-1 text-xs">
                            <span className="text-white font-medium">{d.pokeName}</span>
                            <span className="flex gap-0.5 ml-0.5">{d.types.map(t => <TypeBadge key={t} type={t} />)}</span>
                            <span className="text-red-400 ml-auto font-mono">×{d.eff}</span>
                          </div>
                        ))}
                      </DetailBox>
                    )}
                  </div>
                );
              })}
            {weaknessWarnings.length > 0 && (
              <div className="mt-2 text-xs text-red-400 bg-red-400/10 rounded px-2 py-1">
                Critical weakness (3+): {weaknessWarnings.map(t => <TypeBadge key={t} type={t} className="mr-1" />)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Type Disparity */}
      <div className="bg-gray-800 border border-gray-700 rounded-sm p-4">
        <SectionTitle>Type Disparity</SectionTitle>
        <p className="text-xs text-gray-500 mb-3">How many Pokemon share each type — tap to see which</p>
        {Object.keys(disparity).length === 0 ? (
          <p className="text-gray-500 text-xs">Add Pokemon to see type distribution</p>
        ) : (
          <div className="space-y-0.5">
            {Object.entries(disparity).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
              const color  = count >= 3 ? '#ef4444' : count === 2 ? '#f59e0b' : TYPE_COLORS[type];
              const active = isActive('disparity', type);
              return (
                <div key={type}>
                  <button type="button"
                    className={`w-full flex items-center gap-2 px-1 py-0.5 rounded transition-colors ${active ? 'bg-gray-700/60' : 'hover:bg-gray-700/30'}`}
                    onClick={() => toggleDetail('disparity', type)}>
                    <TypeBadge type={type} />
                    <div className="flex gap-1">
                      {Array.from({ length: count }).map((_, i) => (
                        <div key={i} className="w-3 h-3 rounded-sm" style={{ background: color }} />
                      ))}
                    </div>
                    <span className="text-xs text-gray-400">{count} Pokemon</span>
                    {count >= 3 && <span className="text-red-400 text-xs ml-auto">⚠ Overlap</span>}
                    {count === 2 && <span className="text-yellow-400 text-xs ml-auto">↑ Overlap</span>}
                  </button>
                  {active && (
                    <DetailBox>
                      <div className="text-xs text-gray-400 mb-1">
                        <span style={{ color: TYPE_COLORS[type] }} className="font-semibold">{type}</span>-type Pokemon:
                      </div>
                      {(disparityDetails[type] ?? []).map((d, i) => (
                        <div key={i} className="flex items-center gap-1 text-xs">
                          <span className="text-white font-medium">{d.pokeName}</span>
                          <span className="flex gap-0.5 ml-0.5">{d.types.map(t => <TypeBadge key={t} type={t} />)}</span>
                        </div>
                      ))}
                    </DetailBox>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {disparityWarnings.length > 0 && (
          <div className="mt-2 text-xs text-red-400 bg-red-400/10 rounded px-2 py-1">
            3+ Pokemon share {disparityWarnings.map(([t]) => t).join(', ')} typing — consider diversifying.
          </div>
        )}
      </div>
    </div>
  );
}
