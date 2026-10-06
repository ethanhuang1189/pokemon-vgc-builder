import { useState } from 'react';
import Card from '../ui/Card';
import { Button, Notice, TextInput } from '../ui/controls';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { addShowdownName, removeShowdownName } from '../../services/battles.js';
import { toId } from '../../domain/ids.js';

const MAX_NAME_LENGTH = 18; // Showdown's username limit

/** The Showdown usernames whose battles belong to this account. */
export default function ShowdownNames({ names }) {
  const [draft, setDraft] = useState('');
  const { pending, notice, setNotice, run } = useAsyncAction();

  async function handleAdd(e) {
    e.preventDefault();
    if (!toId(draft)) return setNotice({ tone: 'error', text: 'Enter a Showdown username.' });
    if (names.items.some(n => n.name_id === toId(draft))) return setNotice({ tone: 'info', text: 'Already linked.' });
    await run(() => addShowdownName(draft));
    setDraft('');
    names.reload();
  }

  async function handleRemove(nameId) {
    await run(() => removeShowdownName(nameId));
    names.reload();
  }

  return (
    <Card title="Showdown usernames" subtitle="Battles count when you played as one of these names. Add your alts too.">
      {names.items.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 mb-3">
          {names.items.map(n => (
            <li key={n.name_id} className="flex items-center gap-1 bg-gray-700 rounded px-2 py-1 text-xs text-white">
              {n.name}
              <button type="button" aria-label={`Remove ${n.name}`} onClick={() => handleRemove(n.name_id)}
                className="text-gray-400 hover:text-red-300 ml-1">×</button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAdd} className="flex gap-2 items-end">
        <TextInput className="flex-1" placeholder="Showdown username" maxLength={MAX_NAME_LENGTH}
          autoComplete="off" value={draft} onChange={e => setDraft(e.target.value)} />
        <Button type="submit" disabled={pending}>Add</Button>
      </form>
      <div className="mt-2"><Notice notice={notice ?? (names.error && { tone: 'error', text: names.error })} /></div>
    </Card>
  );
}
