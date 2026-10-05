import { useMemo } from 'react';
import { Card } from './shared';
import MetaThreats from './MetaThreats';
import OffensiveCoverage from './OffensiveCoverage';
import TeamWeaknesses from './TeamWeaknesses';
import TypeDisparity from './TypeDisparity';
import { useTeam } from '../../context/TeamContext';
import { useFormat } from '../../context/FormatContext';
import { useMetaStats } from '../../hooks/useMetaStats.js';
import { ALL_TYPES } from '../../domain/typeChart.js';
import {
  filledSlots, getCoverage, getCoverageDetails, getWeaknessDetails, getTypeDetails,
  analyzeMetaList, resolveMetaEntries,
} from '../../domain/analysis.js';

function Stat({ value, label, tone }) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-gray-400 text-xs">{label}</div>
    </div>
  );
}

function TeamSummary({ memberCount, uncoveredTypes, metaAnalysis }) {
  const metaUncovered = metaAnalysis.filter(m => !m.covered).length;
  return (
    <Card title="Team Summary">
      <div className="flex gap-4 text-sm">
        <Stat value={memberCount} label="Pokémon" tone="text-white" />
        <Stat value={`${ALL_TYPES.length - uncoveredTypes}/${ALL_TYPES.length}`} label="Coverage"
          tone={uncoveredTypes > 6 ? 'text-red-400' : uncoveredTypes > 3 ? 'text-yellow-400' : 'text-green-400'} />
        {metaAnalysis.length > 0 && (
          <Stat value={`${metaAnalysis.length - metaUncovered}/${metaAnalysis.length}`} label="Meta SE"
            tone={metaUncovered === 0 ? 'text-green-400' : metaUncovered <= 5 ? 'text-yellow-400' : 'text-red-400'} />
        )}
      </div>
    </Card>
  );
}

export default function AnalysisPanel() {
  const { team } = useTeam();
  const { Dex } = useFormat();
  const meta = useMetaStats();

  const memberCount = filledSlots(team).length;
  const coverage = useMemo(() => getCoverage(team), [team]);
  const coverageDetails = useMemo(() => getCoverageDetails(team), [team]);
  const weaknessDetails = useMemo(() => getWeaknessDetails(team), [team]);
  const typeDetails = useMemo(() => getTypeDetails(team), [team]);
  const metaEntries = useMemo(() => resolveMetaEntries(meta.stats?.data, Dex), [meta.stats, Dex]);
  const metaAnalysis = useMemo(() => analyzeMetaList(team, metaEntries), [team, metaEntries]);

  return (
    <div className="space-y-5">
      <TeamSummary memberCount={memberCount} uncoveredTypes={coverage.uncovered.size} metaAnalysis={metaAnalysis} />
      <MetaThreats analysis={metaAnalysis} label={meta.stats?.label} loading={meta.loading} error={meta.error}
        onRefresh={meta.refresh} />
      <OffensiveCoverage coverage={coverage} details={coverageDetails} />
      <TeamWeaknesses details={weaknessDetails} teamSize={memberCount} />
      <TypeDisparity details={typeDetails} />
    </div>
  );
}
