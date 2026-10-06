import { useState } from 'react';
import { Button, Notice, TextInput } from '../ui/controls';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { useTeam } from '../../context/TeamContext';
import { fetchPokepaste, createTeam } from '../../services/teams.js';
import { parsePokepasteId, speciesFromPaste, MAX_TEAM_NAME } from '../../domain/teams.js';
import { exportToShowdown } from '../../domain/showdown.js';
import { filledSlots } from '../../domain/analysis.js';

const MAX_PASTE_LENGTH = 10_000;

// The team built on the Team tab, as preview names (megas as their base forme) plus its paste.
function builderTeam(team) {
  const slots = filledSlots(team);
  return {
    species: slots.map(s => s.species.baseSpeciesName),
    paste: exportToShowdown(team),
  };
}

/**
 * Creates a team from a PokéPaste link, pasted Showdown text, or the Team tab.
 * The new team becomes current; the previous one moves to older teams.
 */
export default function NewTeamForm({ onCreated, onCancel }) {
  const { team } = useTeam();
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const { pending, notice, setNotice, run } = useAsyncAction();

  async function resolveTeam() {
    if (parsePokepasteId(source)) {
      const { title, paste } = await fetchPokepaste(source);
      return { name: name || title, species: speciesFromPaste(paste), paste };
    }
    return { name, species: speciesFromPaste(source), paste: source };
  }

  async function save(getTeam) {
    const created = await run(async () => {
      const draft = await getTeam();
      if (!draft.species.length) throw new Error('No Pokémon found — paste a PokéPaste link or Showdown team.');
      if (!draft.name.trim()) throw new Error('Give the team a name.');
      return createTeam(draft);
    });
    if (created) onCreated();
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!source.trim()) return setNotice({ tone: 'error', text: 'Paste a PokéPaste link or Showdown team, or use your Team tab team.' });
    save(resolveTeam);
  }

  const fromBuilder = builderTeam(team);

  return (
    <form onSubmit={handleSubmit} className="space-y-2 border border-indigo-700/60 rounded-sm p-3">
      <TextInput label="Team name" maxLength={MAX_TEAM_NAME} value={name} onChange={e => setName(e.target.value)}
        placeholder="e.g. Sun v3 (optional for PokéPaste links)" />
      <label className="block">
        <span className="block text-xs text-gray-400 mb-1">PokéPaste link or Showdown team</span>
        <textarea rows={4} maxLength={MAX_PASTE_LENGTH} value={source} onChange={e => setSource(e.target.value)}
          placeholder="https://pokepast.es/…"
          className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 resize-none" />
      </label>
      <Notice notice={notice} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>Save as current team</Button>
        {fromBuilder.species.length > 0 && (
          <Button tone="secondary" disabled={pending}
            onClick={() => save(async () => ({ ...fromBuilder, name: name || 'Team tab team' }))}>
            Use my Team tab team
          </Button>
        )}
        <Button tone="link" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
