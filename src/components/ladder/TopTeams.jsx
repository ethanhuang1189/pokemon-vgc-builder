import { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '../ui/Card';
import { Button, Segmented } from '../ui/controls';
import SpeciesIcons from '../battles/SpeciesIcons';
import { useFormat } from '../../context/FormatContext';
import { useTeam } from '../../context/TeamContext';
import { useRemoteList } from '../../hooks/useRemoteList.js';
import { ladderAvailable, fetchTopGroups, fetchOverview, fetchGroupGames } from '../../services/ladder.js';
import {
  LADDER_FORMATS, MIN_PLAYER_RATING, MIN_PLAYERS, MIN_GAMES, speciesOfKey, summarizeEntries, teamsWithCore, pasteFromSummary,
} from '../../domain/ladder.js';
import { importFromShowdown } from '../../domain/showdown.js';
import { teamFromSlots } from '../../domain/team.js';
import { filledSlots } from '../../domain/analysis.js';
import { formatPercent, formatRecord } from '../../domain/battleStats.js';
import { replayUrl } from '../../domain/replay.js';

const KINDS = [{ value: 'teams', label: 'Teams' }, { value: 'cores', label: '4-Pokémon cores' }];
const SORTS = [{ value: 'best', label: 'Best' }, { value: 'popular', label: 'Most used' }];
const SHOWN = 10;
const SHOWN_EXPANDED = 25;
const EXAMPLE_REPLAYS = 3;

// A group's Pokémon: a team's six in preview order when known, else from its key (sorted).
const speciesOf = (kind, group) =>
  (kind === 'cores' ? speciesOfKey(group.core_key) : group.team?.length ? group.team : speciesOfKey(group.team_key));

const shortDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function ago(iso) {
  const hours = Math.round((Date.now() - Date.parse(iso)) / 3_600_000);
  if (hours < 1) return 'under an hour ago';
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

const Label = ({ children }) => <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{children}</div>;
const Share = ({ value }) => <span className="text-gray-500 font-mono text-[10px] w-8 text-right shrink-0">{formatPercent(value)}</span>;

/** "Use this team": the six (or four) with their most common revealed sets, into the builder. */
function useLoadIntoBuilder() {
  const { format } = useFormat();
  const { team, replaceTeam } = useTeam();
  return (summary, species) => {
    if (filledSlots(team).length && !confirm('Replace your current team with this one?')) return;
    const { slots } = importFromShowdown(pasteFromSummary(summary, species), format);
    replaceTeam(teamFromSlots(slots));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
}

function MemberSet({ member }) {
  return (
    <li className="min-w-0">
      <div className="flex items-center gap-1.5">
        <SpeciesIcons names={[member.name]} size={28} />
        <span className="text-xs text-white font-medium truncate flex-1">{member.name}</span>
        <span className="text-[10px] text-gray-400 shrink-0" title="Share of games it was brought">
          brought {formatPercent(member.broughtRate)}{member.megaRate > 0 && ` · mega ${formatPercent(member.megaRate)}`}
        </span>
      </div>
      <div className="pl-[34px] space-y-0.5 text-[11px]">
        {member.items[0] && (
          <div className="flex gap-1 text-gray-300"><span className="truncate flex-1">@ {member.items[0].name}</span><Share value={member.items[0].share} /></div>
        )}
        {member.abilities[0] && (
          <div className="flex gap-1 text-gray-400"><span className="truncate flex-1">{member.abilities[0].name}</span><Share value={member.abilities[0].share} /></div>
        )}
        {member.moves.slice(0, 4).map(m => (
          <div key={m.name} className="flex gap-1 text-gray-300"><span className="truncate flex-1">– {m.name}</span><Share value={m.share} /></div>
        ))}
      </div>
    </li>
  );
}

/** One team's or core's breakdown, loaded when opened. */
function GroupDetail({ formatId, kind, group }) {
  const key = kind === 'cores' ? group.core_key : group.team_key;
  const load = useCallback(() => fetchGroupGames(formatId, kind, key), [formatId, kind, key]);
  const games = useRemoteList(load);
  const loadIntoBuilder = useLoadIntoBuilder();
  const species = useMemo(() => speciesOf(kind, group), [kind, group]);
  const summary = useMemo(() => summarizeEntries(games.items, species), [games.items, species]);
  const teams = useMemo(() => (kind === 'cores' ? teamsWithCore(games.items, 3) : []), [kind, games.items]);

  // A core loads its most-used full team, with that team's own sets.
  const loadInBuilder = () => {
    if (kind !== 'cores') return loadIntoBuilder(summary, species);
    const [top] = teams;
    loadIntoBuilder(summarizeEntries(games.items.filter(g => g.team_key === top.key), top.team), top.team);
  };

  if (games.loading) return <p className="text-[11px] text-gray-500 px-1 py-2">Loading…</p>;
  if (games.error) return <p className="text-[11px] text-red-300 px-1 py-2">{games.error}</p>;
  // For a core, show only its four; the rest of each team is listed under "Teams with this core".
  const members = summary.members.filter(m => species.includes(m.name));

  return (
    <div className="mt-1.5 bg-gray-900/60 border border-gray-600/60 rounded p-2 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Brought most</Label>
          <ul className="space-y-1">
            {summary.brought.slice(0, 3).map(b => (
              <li key={b.name} className="flex items-center gap-1.5"><SpeciesIcons names={b.species} size={24} /><span className="flex-1" /><Share value={b.share} /></li>
            ))}
          </ul>
        </div>
        <div>
          <Label>Leads</Label>
          <ul className="space-y-1">
            {summary.leads.slice(0, 3).map(l => (
              <li key={l.name} className="flex items-center gap-1.5"><SpeciesIcons names={l.species} size={24} /><span className="flex-1" /><Share value={l.share} /></li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <Label>Most common sets (as revealed in battle — EVs and natures aren&apos;t shown in replays)</Label>
        <ul className="grid gap-3 sm:grid-cols-2">{members.map(m => <MemberSet key={m.name} member={m} />)}</ul>
      </div>

      {kind === 'cores' && teams.length > 0 && (
        <div>
          <Label>Teams with this core</Label>
          <ul className="space-y-1">
            {teams.map(t => (
              <li key={t.key} className="flex items-center gap-2 text-xs">
                <SpeciesIcons names={t.team} size={24} />
                <span className="flex-1" />
                <span className="text-gray-300 font-mono">{formatPercent(t.winRate)}</span>
                <span className="text-gray-500 font-mono text-[10px] w-12 text-right">{t.games} games</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={loadInBuilder} disabled={kind === 'cores' && !teams.length}>
          {kind === 'cores' ? 'Use the top team with this core' : 'Use this team'}
        </Button>
        <span className="text-[10px] text-gray-500">Example replays:</span>
        {games.items.slice(0, EXAMPLE_REPLAYS).map((g, i) => (
          <a key={g.replay_id} href={replayUrl(g.replay_id)} target="_blank" rel="noopener noreferrer"
            className="text-[11px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
            {i + 1} ({g.rating})
          </a>
        ))}
      </div>
    </div>
  );
}

function GroupRow({ group, kind, rank, expanded, onToggle, formatId }) {
  const species = speciesOf(kind, group);
  const winRate = group.games ? group.wins / group.games : 0;
  return (
    <li>
      <button type="button" onClick={onToggle} aria-expanded={expanded}
        className={`w-full text-left px-1.5 py-1.5 rounded transition-colors ${expanded ? 'bg-gray-700/60' : 'hover:bg-gray-700/30'}`}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 font-mono w-4 shrink-0 text-right">{rank}</span>
          <span className="flex-1 min-w-0 overflow-hidden"><SpeciesIcons names={species} size={28} /></span>
          <span className="text-xs text-white font-semibold font-mono shrink-0">{formatPercent(winRate)}</span>
        </div>
        <div className="flex items-center gap-2 pl-6 mt-0.5">
          <div className="flex-1 h-1.5 bg-gray-700 rounded overflow-hidden">
            <div className="h-full bg-indigo-400 rounded" style={{ width: formatPercent(winRate) }} />
          </div>
          <span className="text-[10px] text-gray-400 font-mono shrink-0">{formatRecord({ ...group, ties: group.games - group.wins - group.losses })}</span>
          <span className="text-[10px] text-gray-500 shrink-0">{group.players} players</span>
        </div>
      </button>
      {expanded && <GroupDetail formatId={formatId} kind={kind} group={group} />}
    </li>
  );
}

/**
 * Teams and 4-Pokémon cores that 1500+ players win with, from public Showdown replays. Kept
 * clearly apart from Pikalytics usage (Meta Threats): this is the simulator's ladder.
 */
export default function TopTeams() {
  const { format } = useFormat();
  const formatId = LADDER_FORMATS[format.regulation.id];
  const [kind, setKind] = useState('teams');
  const [sort, setSort] = useState('best');
  const [showMore, setShowMore] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [overview, setOverview] = useState(null);

  const loadGroups = useCallback(() => fetchTopGroups(formatId, kind, sort, SHOWN_EXPANDED), [formatId, kind, sort]);
  const groups = useRemoteList(loadGroups);
  useEffect(() => {
    if (!formatId || !ladderAvailable()) return;
    let cancelled = false;
    fetchOverview(formatId).then(o => { if (!cancelled) setOverview(o); }, () => {});
    return () => { cancelled = true; };
  }, [formatId]);

  if (!formatId || !ladderAvailable()) return null;
  const keyOf = (g) => (kind === 'cores' ? g.core_key : g.team_key);
  const shown = groups.items.slice(0, showMore ? SHOWN_EXPANDED : SHOWN);

  return (
    <Card title="Top Teams · Showdown"
      subtitle={`From public Pokémon Showdown replays — the simulator's ladder, not the Champions game. Players rated ${MIN_PLAYER_RATING}+ only.`}>
      {overview && (
        <p className="text-[11px] text-gray-500 -mt-2 mb-3">
          {overview.replays.toLocaleString()} games · {overview.players.toLocaleString()} players · {shortDate(overview.first_played)}–{shortDate(overview.last_played)}
          {overview.updated_at && ` · updated ${ago(overview.updated_at)}`}
        </p>
      )}
      <div className="flex flex-wrap gap-2 mb-2">
        <Segmented size="sm" label="Teams or cores" options={KINDS} value={kind}
          onChange={v => { setKind(v); setExpanded(null); setShowMore(false); }} />
        <Segmented size="sm" label="Sort" options={SORTS} value={sort} onChange={v => { setSort(v); setExpanded(null); }} />
      </div>
      <p className="text-[10px] text-gray-500 mb-2">
        {sort === 'best'
          ? 'Ranked by win rate, with small samples pulled toward 50%. '
          : 'Ranked by games played. '}
        Listed after {MIN_GAMES}+ games from {MIN_PLAYERS}+ players · tap for sets.
      </p>

      {groups.loading && <p className="text-xs text-gray-500">Loading…</p>}
      {groups.error && <p className="text-xs text-red-300">{groups.error}</p>}
      {!groups.loading && !groups.error && !shown.length && (
        <p className="text-xs text-gray-500">Not enough games collected yet — check back soon.</p>
      )}
      <ol className="space-y-px">
        {shown.map((g, i) => (
          <GroupRow key={keyOf(g)} group={g} kind={kind} rank={i + 1} formatId={formatId}
            expanded={expanded === keyOf(g)} onToggle={() => setExpanded(e => (e === keyOf(g) ? null : keyOf(g)))} />
        ))}
      </ol>
      {groups.items.length > SHOWN && (
        <Button tone="link" className="mt-2" onClick={() => setShowMore(v => !v)}>
          {showMore ? 'Show fewer' : `Show top ${SHOWN_EXPANDED}`}
        </Button>
      )}
    </Card>
  );
}
