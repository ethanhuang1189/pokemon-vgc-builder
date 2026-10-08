import { useMemo } from 'react';
import { useTeam } from '../context/TeamContext';
import { useFormat } from '../context/FormatContext';
import { useMetaStats } from './useMetaStats.js';
import {
  filledSlots, getCoverage, getCoverageDetails, getWeaknessDetails, getTypeDetails,
  analyzeMetaList, resolveMetaEntries,
} from '../domain/analysis.js';

/** Every analysis result for the current team, computed once for all the sections. */
export function useTeamAnalysis() {
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
  return { meta, memberCount, coverage, coverageDetails, weaknessDetails, typeDetails, metaAnalysis };
}
