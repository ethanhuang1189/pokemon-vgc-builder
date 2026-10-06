import { useMemo } from 'react';
import Card from '../ui/Card';
import StatsPanel from './StatsPanel';
import { summarizeBattles, formatPercent, formatRecord } from '../../domain/battleStats.js';

function Stat({ label, value }) {
  return (
    <div className="text-center">
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</div>
    </div>
  );
}

/** Totals and stats across every battle shown. */
export default function BattleStats({ battles }) {
  const { record } = useMemo(() => summarizeBattles(battles), [battles]);
  if (!record.games) return null;

  return (
    <Card title="Overall">
      <div className="flex justify-around mb-4">
        <Stat label="Games" value={record.games} />
        <Stat label="Record" value={formatRecord(record)} />
        <Stat label="Win rate" value={formatPercent(record.winRate)} />
      </div>
      <StatsPanel battles={battles} />
    </Card>
  );
}
