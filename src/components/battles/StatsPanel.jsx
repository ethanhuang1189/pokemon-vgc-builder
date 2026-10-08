import { useMemo, useState } from 'react';
import SpeciesIcons from './SpeciesIcons';
import PokemonMoves from './PokemonMoves';
import EloChart from '../charts/EloChart';
import { Segmented } from '../ui/controls';
import {
  eloSeries, ratedAccounts, ratingSummary, matchups, attendance, commonLeads, MIN_MATCHUP_GAMES, TOP_COUNT,
} from '../../domain/battleInsights.js';
import { formatPercent } from '../../domain/battleStats.js';

// How many ladders (formats) the chart draws at once for one account.
const MAX_CHART_SERIES = 3;

const VIEWS = [
  { value: 'rating', label: 'Rating' },
  { value: 'matchups', label: 'Matchups' },
  { value: 'team', label: 'Your team' },
];

const Caption = ({ children }) => <p className="text-[11px] text-gray-500 mb-2">{children}</p>;
const Empty = ({ children }) => <p className="text-[11px] text-gray-500 py-2">{children}</p>;
const signed = (n) => (n > 0 ? `+${n}` : String(n));

function Figure({ label, value, tone = 'text-white' }) {
  return (
    <div>
      <div className={`text-base font-semibold font-mono ${tone}`}>{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
    </div>
  );
}

/**
 * A titled list: sprites and name, a bar for `rate`, the rate, and a muted detail.
 * `rateLabel` and `detailLabel` head those two columns. `rows` items: { key, names, label, rate, detail }.
 */
function RankedList({ heading, rateLabel, detailLabel, rows, barColor = 'bg-indigo-500', empty }) {
  return (
    <div className="min-w-0">
      <div className="flex items-end gap-2 mb-1">
        <span className="flex-1 text-[11px] font-semibold text-gray-300">{heading}</span>
        {rows.length > 0 && (
          <>
            <span className="text-[10px] text-gray-500 w-10 text-right leading-tight">{rateLabel}</span>
            <span className="text-[10px] text-gray-500 w-12 text-right leading-tight">{detailLabel}</span>
          </>
        )}
      </div>
      {rows.length ? (
        <ul className="space-y-1">
          {rows.map(row => (
            <li key={row.key} className="flex items-center gap-2 text-xs">
              <SpeciesIcons names={row.names} size={24} />
              <div className="flex-1 min-w-0">
                <div className="text-gray-200 truncate">{row.label}</div>
                <div className="h-1 rounded bg-gray-700 mt-0.5">
                  <div className={`h-1 rounded ${barColor}`} style={{ width: formatPercent(row.rate) }} />
                </div>
              </div>
              <span className="text-white font-semibold font-mono w-10 text-right">{formatPercent(row.rate)}</span>
              <span className="text-gray-500 text-[10px] font-mono w-12 text-right">{row.detail}</span>
            </li>
          ))}
        </ul>
      ) : <Empty>{empty}</Empty>}
    </div>
  );
}

// "W-L" for a row with wins and losses (ties, if any, are the remaining games).
const winLoss = (p) => `${p.wins}-${p.losses}`;
const MATCHUP_COLUMNS = { rateLabel: 'Win rate', detailLabel: 'W-L' };
const matchupRow = (p) => ({ key: p.name, names: [p.name], label: p.name, rate: p.winRate, detail: winLoss(p) });

function RatingView({ battles }) {
  const accounts = useMemo(() => ratedAccounts(battles), [battles]);
  const allSeries = useMemo(() => eloSeries(battles), [battles]);
  const [choice, setChoice] = useState(null);
  // Default to the account played on most recently.
  const account = accounts.some(a => a.id === choice) ? choice : accounts[0]?.id;
  const series = allSeries.filter(s => s.account === account && s.points.length >= 2).slice(0, MAX_CHART_SERIES);
  const summary = series.length ? ratingSummary(series[0].points) : null;

  return (
    <div>
      {accounts.length > 1 && (
        <div className="mb-2">
          <Segmented size="sm" label="Account" value={account} onChange={setChoice}
            options={accounts.map(a => ({ value: a.id, label: a.name }))} />
        </div>
      )}
      {series.length ? (
        <>
          <div className="flex gap-6 mb-2">
            <Figure label="Current" value={summary.current} />
            <Figure label="Peak" value={summary.peak} />
            <Figure label="Net" value={signed(summary.net)}
              tone={summary.net > 0 ? 'text-emerald-400' : summary.net < 0 ? 'text-red-400' : 'text-white'} />
          </div>
          <EloChart series={series} />
        </>
      ) : <Empty>Play two or more rated ladder games{accounts.length > 1 ? ' on this account' : ''} to chart your rating.</Empty>}
    </div>
  );
}

function MatchupsView({ battles }) {
  const { best, worst, mostFaced, baseline } = useMemo(() => matchups(battles), [battles]);
  if (!mostFaced.length) return <Empty>Face a Pokémon {MIN_MATCHUP_GAMES}+ times to see how you do against it.</Empty>;
  return (
    <div>
      <Caption>
        Your win rate against opposing Pokémon you&apos;ve faced {MIN_MATCHUP_GAMES}+ times, compared with your
        {' '}{formatPercent(baseline)} overall. Rankings favor bigger samples, so one lucky or unlucky game won&apos;t top a list.
      </Caption>
      <div className="grid gap-4 sm:grid-cols-2">
        <RankedList heading="Toughest opponents" {...MATCHUP_COLUMNS} rows={worst.map(matchupRow)} barColor="bg-red-500"
          empty="Nothing you do worse than average against." />
        <RankedList heading="Easiest opponents" {...MATCHUP_COLUMNS} rows={best.map(matchupRow)} barColor="bg-emerald-500"
          empty="Nothing you do better than average against." />
      </div>
      <div className="mt-4">
        <RankedList heading="Most faced" rateLabel="Win rate" detailLabel="Faced" rows={mostFaced.map(p => ({ ...matchupRow(p), detail: `${p.games}×` }))} />
      </div>
    </div>
  );
}

function TeamView({ battles, order }) {
  const { all, highest } = useMemo(() => attendance(battles), [battles]);
  // Across many teams the full list gets long; show the most-brought only.
  const many = all.length > TOP_COUNT * 2;
  const leads = useMemo(() => commonLeads(battles), [battles]);
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <RankedList heading={many ? 'Brought most often' : 'Brought to battle'} rateLabel="Brought" detailLabel="Games"
          rows={(many ? highest : all).map(p => ({ key: p.name, names: [p.name], label: p.name, rate: p.rate, detail: `${p.brought}/${p.games}` }))}
          empty="No team data yet." />
        <RankedList heading="Most common leads" rateLabel="Win rate" detailLabel="W-L"
          rows={leads.map(l => ({ key: l.key, names: l.leads, label: l.leads.join(' + '), rate: l.winRate, detail: winLoss(l) }))}
          empty="Leads appear after your next sync." />
      </div>
      {/* Wide screens show move usage in the dashboard's side column instead. */}
      <div className="lg:hidden mt-4">
        <div className="text-[11px] font-semibold text-gray-300 mb-1">Move usage</div>
        <PokemonMoves battles={battles} order={order} />
      </div>
    </div>
  );
}

/**
 * Rating, matchups and team usage for a set of battles, one view at a time. On narrow screens
 * the team view also shows move usage, in `order` (the team's preview order).
 */
export default function StatsPanel({ battles, order = [] }) {
  const [view, setView] = useState('rating');
  if (!battles.length) return null;
  return (
    <div>
      <div className="mb-3"><Segmented label="Stats view" options={VIEWS} value={view} onChange={setView} /></div>
      {view === 'rating' && <RatingView battles={battles} />}
      {view === 'matchups' && <MatchupsView battles={battles} />}
      {view === 'team' && <TeamView battles={battles} order={order} />}
    </div>
  );
}
