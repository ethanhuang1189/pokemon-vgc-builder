import { useMemo, useState } from 'react';
import Card from '../ui/Card';
import { Button, Notice } from '../ui/controls';
import { AuthPanel, SetPasswordForm } from './AuthPanel';
import ShowdownNames from './ShowdownNames';
import AddBattles from './AddBattles';
import BattleStats from './BattleStats';
import BattleList from './BattleList';
import BookmarkletSetup from './BookmarkletSetup';
import { useAuth } from '../../context/AuthContext';
import { useRemoteList } from '../../hooks/useRemoteList.js';
import { takeImportParam } from '../../hooks/useHashTab.js';
import { listBattles, listShowdownNames, deleteBattle } from '../../services/battles.js';
import { signOut } from '../../services/auth.js';
import { formatsIn } from '../../domain/battleStats.js';

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
  const [format, setFormat] = useState(ALL_FORMATS);

  const formats = useMemo(() => formatsIn(battles.items), [battles.items]);
  const shown = useMemo(
    () => (format ? battles.items.filter(b => b.format === format) : battles.items),
    [battles.items, format],
  );

  async function handleDelete(battle) {
    if (!confirm(`Delete the battle vs ${battle.opponent_name}?`)) return;
    await deleteBattle(battle.id);
    battles.reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span className="truncate">Signed in as {user.email}</span>
        <Button tone="secondary" onClick={signOut}>Sign out</Button>
      </div>
      <ShowdownNames names={names} />
      <AddBattles pendingImport={pendingImport} onImported={battles.reload} />
      <FormatFilter formats={formats} value={format} onChange={setFormat} />
      <BattleStats battles={shown} />
      <BattleList battles={shown} loading={battles.loading} error={battles.error} onDelete={handleDelete} />
      <BookmarkletSetup />
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

  return <div className="max-w-xl mx-auto px-3 py-4">{content}</div>;
}
