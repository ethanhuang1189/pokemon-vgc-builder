import { Card } from './shared';
import MetaThreats from './MetaThreats';
import OffensiveCoverage from './OffensiveCoverage';
import TeamWeaknesses from './TeamWeaknesses';
import TypeDisparity from './TypeDisparity';
import { ALL_TYPES } from '../../domain/typeChart.js';

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

/** Team summary, meta threats and offensive coverage: how the team does against others. */
export function OffenseSections({ analysis: a }) {
  return (
    <div className="space-y-5">
      <TeamSummary memberCount={a.memberCount} uncoveredTypes={a.coverage.uncovered.size} metaAnalysis={a.metaAnalysis} />
      <MetaThreats analysis={a.metaAnalysis} label={a.meta.stats?.label} loading={a.meta.loading} error={a.meta.error}
        onRefresh={a.meta.refresh} />
      <OffensiveCoverage coverage={a.coverage} details={a.coverageDetails} />
    </div>
  );
}

/** Team weaknesses and type disparity: the team's defensive shape. */
export function DefenseSections({ analysis: a }) {
  return (
    <div className="space-y-5">
      <TeamWeaknesses details={a.weaknessDetails} teamSize={a.memberCount} />
      <TypeDisparity details={a.typeDetails} />
    </div>
  );
}
