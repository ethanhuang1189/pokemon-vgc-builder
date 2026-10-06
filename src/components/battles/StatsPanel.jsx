import { useMemo } from 'react';
import SpeciesIcons from './SpeciesIcons';
import EloChart from '../charts/EloChart';
import DonutChart from '../charts/DonutChart';
import { eloSeries, matchups, attendance, commonLeads, moveUsage, MIN_MATCHUP_GAMES } from '../../domain/battleInsights.js';
import { formatPercent } from '../../domain/battleStats.js';

const Section = ({ title, children }) => (
  <section>
    <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{title}</h4>
    {children}
  </section>
);

const Empty = ({ children }) => <p className="text-[11px] text-gray-500">{children}</p>;

/** Rows of [sprites, name] · value · detail; `rows` items: { key, names, label, value, detail }. */
function RankedList({ heading, rows }) {
  if (!rows.length) return null;
  return (
    <div className="min-w-0">
      <div className="text-[10px] text-gray-500 mb-0.5">{heading}</div>
      <ul className="space-y-0.5">
        {rows.map(row => (
          <li key={row.key} className="flex items-center gap-1.5 text-xs">
            <SpeciesIcons names={row.names} size={24} />
            <span className="text-gray-200 truncate flex-1">{row.label}</span>
            <span className="text-white font-semibold font-mono">{row.value}</span>
            <span className="text-gray-500 text-[10px] w-14 text-right">{row.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const games = (n) => `${n} game${n === 1 ? '' : 's'}`;
const pokemonRow = (p, value, detail) => ({ key: p.name, names: [p.name], label: p.name, value, detail });

/** Rating, matchups, attendance, leads and move usage for a set of battles. */
export default function StatsPanel({ battles }) {
  const stats = useMemo(() => ({
    elo: eloSeries(battles).filter(s => s.points.length >= 2).slice(0, 3),
    matchups: matchups(battles),
    attendance: attendance(battles),
    leads: commonLeads(battles),
    moves: moveUsage(battles),
  }), [battles]);

  if (!battles.length) return null;
  const { elo, moves } = stats;

  return (
    <div className="space-y-4">
      <Section title="Rating">
        {elo.length ? <EloChart series={elo} /> : <Empty>Play two or more rated ladder games to chart your rating.</Empty>}
      </Section>

      <Section title="Matchups">
        {stats.matchups.best.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <RankedList heading="Best — your win rate against"
              rows={stats.matchups.best.map(p => pokemonRow(p, formatPercent(p.winRate), games(p.games)))} />
            <RankedList heading="Worst — your win rate against"
              rows={stats.matchups.worst.map(p => pokemonRow(p, formatPercent(p.winRate), games(p.games)))} />
          </div>
        ) : <Empty>Face a Pokémon {MIN_MATCHUP_GAMES}+ times to see how you do against it.</Empty>}
      </Section>

      <Section title="Attendance">
        <div className="grid gap-3 sm:grid-cols-2">
          <RankedList heading="Brought most often"
            rows={stats.attendance.highest.map(p => pokemonRow(p, formatPercent(p.rate), `${p.brought}/${p.games}`))} />
          <RankedList heading="Brought least often"
            rows={stats.attendance.lowest.map(p => pokemonRow(p, formatPercent(p.rate), `${p.brought}/${p.games}`))} />
        </div>
      </Section>

      <Section title="Most common leads">
        {stats.leads.length ? (
          <RankedList heading="Lead pair — your win rate"
            rows={stats.leads.map(l => ({ key: l.key, names: l.leads, label: l.leads.join(' + '), value: formatPercent(l.winRate), detail: games(l.games) }))} />
        ) : <Empty>Leads appear after your next sync.</Empty>}
      </Section>

      <Section title="Move usage">
        {moves.total ? <DonutChart slices={moves.slices} total={moves.total} unit="uses" /> : <Empty>Moves appear after your next sync.</Empty>}
      </Section>
    </div>
  );
}
