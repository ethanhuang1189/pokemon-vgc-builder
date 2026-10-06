import { useState } from 'react';
import Card from '../ui/Card';
import { Button, Notice } from '../ui/controls';
import TeamCard from './TeamCard';
import NewTeamForm from './NewTeamForm';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { groupTitle, MAX_TEAM_NAME } from '../../domain/teams.js';
import { createTeam, deleteTeam, makeCurrent, moveBattles, renameTeam } from '../../services/teams.js';

// Unnamed iterations with fewer games than this are tucked behind "show more".
const MIN_ITERATION_GAMES = 3;

const askName = (current = '') => prompt('Team name', current)?.trim().slice(0, MAX_TEAM_NAME) || null;

const SectionLabel = ({ children }) => (
  <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mt-4 mb-1">{children}</h4>
);

/**
 * The current team on top (new games go here), older saved teams, then unnamed iterations of
 * games no saved team owns. `organized` comes from organizeBattles(); the open card is owned by
 * the dashboard (its side column shows that team's moves). `onChanged` reloads after any edit.
 */
export default function TeamsSection({ organized, teams, openKey, onToggle, onCreated, loading, error, onChanged, onDelete }) {
  const { current, older, iterations } = organized;
  const [creating, setCreating] = useState(false);
  const [showAllIterations, setShowAllIterations] = useState(false);
  const { notice, run } = useAsyncAction();

  const moveTargets = teams.map(t => ({ id: t.id, name: t.name }));
  const isExpanded = (key) => openKey === key;
  const act = async (action) => { if (await run(async () => { await action(); return true; })) onChanged(); };

  const savedActions = (team, isCurrent) => (
    <>
      {!isCurrent && <Button onClick={() => act(() => makeCurrent(team.id))}>Make current</Button>}
      <Button tone="secondary" onClick={() => { const name = askName(team.name); if (name) act(() => renameTeam(team.id, name)); }}>Rename</Button>
      <Button tone="danger" onClick={() => { if (confirm(`Delete "${team.name}"? Its games stay and move to automatic grouping.`)) act(() => deleteTeam(team.id)); }}>Delete</Button>
    </>
  );

  const nameIteration = (group) => {
    const name = askName();
    if (!name) return;
    act(async () => {
      const team = await createTeam({ name, species: group.species }, { current: false });
      await moveBattles(group.battles.map(b => b.id), team.id);
    });
  };

  const bigIterations = iterations.filter(g => g.record.games >= MIN_ITERATION_GAMES);
  const shownIterations = showAllIterations ? iterations : bigIterations;
  const hiddenCount = iterations.length - bigIterations.length;
  const cardProps = { moveTargets, onDelete, onMove: (battle, teamId) => act(() => moveBattles([battle.id], teamId)) };

  return (
    <Card title="Teams"
      action={!creating && <Button onClick={() => setCreating(true)}>New team</Button>}
      subtitle="New games go to your current team. Making a new team moves the old one to Older teams.">
      {loading && <p className="text-xs text-gray-500">Loading…</p>}
      {error && <p className="text-xs text-red-300">{error}</p>}
      <Notice notice={notice} />
      {creating && <NewTeamForm onCreated={() => { setCreating(false); onCreated(); }} onCancel={() => setCreating(false)} />}

      {current ? (
        <ul className="mt-2">
          <TeamCard group={current} title={groupTitle(current)} badge="Current"
            expanded={isExpanded(current.key)} onToggle={() => onToggle(current.key)}
            actions={savedActions(current.saved, true)} {...cardProps} />
        </ul>
      ) : (
        !creating && <p className="text-xs text-gray-500 mt-2">No current team — press <strong>New team</strong> to start tracking one.</p>
      )}

      {older.length > 0 && (
        <>
          <SectionLabel>Older teams</SectionLabel>
          <ul className="space-y-2">
            {older.map(group => (
              <TeamCard key={group.key} group={group} title={groupTitle(group)}
                expanded={isExpanded(group.key)} onToggle={() => onToggle(group.key)}
                actions={savedActions(group.saved, false)} {...cardProps} />
            ))}
          </ul>
        </>
      )}

      {iterations.length > 0 && (
        <>
          <SectionLabel>Other iterations</SectionLabel>
          <ul className="space-y-2">
            {shownIterations.map(group => (
              <TeamCard key={group.key} group={group} title={groupTitle(group)}
                expanded={isExpanded(group.key)} onToggle={() => onToggle(group.key)}
                actions={<Button tone="secondary" onClick={() => nameIteration(group)}>Save as team</Button>} {...cardProps} />
            ))}
          </ul>
          {hiddenCount > 0 && (
            <Button tone="link" className="mt-2" onClick={() => setShowAllIterations(v => !v)}>
              {showAllIterations ? 'Hide small iterations' : `Show ${hiddenCount} more with fewer than ${MIN_ITERATION_GAMES} games`}
            </Button>
          )}
        </>
      )}
    </Card>
  );
}
