import { useMemo, useState } from 'react';
import Card from '../ui/Card';
import { Button, Notice } from '../ui/controls';
import { AuthPanel, SetPasswordForm } from './AuthPanel';
import ShowdownNames from './ShowdownNames';
import AddBattles from './AddBattles';
import BattleStats from './BattleStats';
import TeamsSection from './TeamsSection';
import PokemonMoves from './PokemonMoves';
import BookmarkletSetup from './BookmarkletSetup';
import { useAuth } from '../../context/AuthContext';
import { useRemoteList } from '../../hooks/useRemoteList.js';
import { takeImportParam } from '../../hooks/useHashTab.js';
import { listBattles, listShowdownNames, deleteBattle } from '../../services/battles.js';
import { listTeams, listTeamPeriods } from '../../services/teams.js';
import { signOut } from '../../services/auth.js';
import { formatsIn } from '../../domain/battleStats.js';
import { organizeBattles, allGroups, groupTitle } from '../../domain/teams.js';

const ALL_FORMATS = '';

function FormatFilter({ formats, value, onChange }) {
  if (formats.length < 2) return null;
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white">
      <option value={ALL_FORMATS}>All formats</option>
      {formats.map(f => <option key={f} value={f}>{f}</option>)}
    </select>
  );
}

function Dashboard({ pendingImport }) {
  const { user } = useAuth();
  const names = useRemoteList(listShowdownNames);
  const battles = useRemoteList(listBattles);
  const teams = useRemoteList(listTeams);
  const periods = useRemoteList(listTeamPeriods);
  const reloadTeams = () => Promise.all([teams.reload(), periods.reload(), battles.reload()]);
  const [format, setFormat] = useState(ALL_FORMATS);

  const formats = useMemo(() => formatsIn(battles.items), [battles.items]);
  const shown = useMemo(
    () => (format ? battles.items.filter(b => b.format === format) : battles.items),
    [battles.items, format],
  );

  const organized = useMemo(
    () => organizeBattles(shown, teams.items, periods.items),
    [shown, teams.items, periods.items],
  );
  // The open team card: null means the current team (open by default), '' means none.
  const [openChoice, setOpenChoice] = useState(null);
  const openKey = openChoice ?? organized.current?.key ?? '';
  const openGroup = allGroups(organized).find(g => g.key === openKey);
  const toggle = (key) => setOpenChoice(openKey === key ? '' : key);

  async function handleDelete(battle) {
    if (!confirm(`Delete the battle vs ${battle.opponent_name}?`)) return;
    await deleteBattle(battle.id);
    battles.reload();
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-4 lg:items-start">
      <div className="space-y-4 min-w-0">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="truncate">Signed in as {user.email}</span>
          <Button tone="secondary" onClick={signOut}>Sign out</Button>
        </div>
        <ShowdownNames names={names} />
        <AddBattles userId={user.id} canSync={names.items.length > 0} pendingImport={pendingImport} onImported={battles.reload} />
        <FormatFilter formats={formats} value={format} onChange={setFormat} />
        <TeamsSection organized={organized} teams={teams.items} openKey={openKey} onToggle={toggle}
          onCreated={() => { setOpenChoice(null); reloadTeams(); }}
          loading={battles.loading || teams.loading} error={battles.error || teams.error}
          onChanged={reloadTeams} onDelete={handleDelete} />
        <BattleStats battles={shown} />
        <BookmarkletSetup />
      </div>
      {/* Wide screens: the open team's move usage beside the main column. */}
      <aside className="hidden lg:block sticky top-4">
        <Card title="Move usage" subtitle={openGroup ? groupTitle(openGroup) : 'Open a team to see its moves.'}>
          {openGroup && <PokemonMoves battles={openGroup.battles} order={openGroup.species} />}
        </Card>
      </aside>
    </div>
  );
}

/** The Battles tab: account screens, then the battle dashboard. */
export default function BattlesTab() {
  const { configured, session, recovering } = useAuth();
  // A replay handed over by the bookmarklet; kept until the user is signed in.
  const [pendingImport] = useState(takeImportParam);

  let content;
  if (!configured) content = <Card title="Battles"><p className="text-xs text-gray-400">Battle tracking isn&apos;t set up on this site yet.</p></Card>;
  else if (session === undefined) content = <p className="text-xs text-gray-500">Loading…</p>;
  else if (recovering) content = <SetPasswordForm />;
  else if (session) content = <Dashboard pendingImport={pendingImport} />;
  else {
    content = (
      <div className="space-y-3">
        {pendingImport && <Notice notice={{ tone: 'info', text: 'Sign in to save the battle you just played.' }} />}
        <AuthPanel />
      </div>
    );
  }

  return <div className={`mx-auto px-3 py-4 ${session ? 'max-w-xl lg:max-w-5xl' : 'max-w-xl'}`}>{content}</div>;
}
