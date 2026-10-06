import { useEffect, useState } from 'react';
import Card from '../ui/Card';
import { Button, Notice, TextInput } from '../ui/controls';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { importReplay, syncReplays } from '../../services/battles.js';
import { parseReplayId } from '../../domain/replay.js';

const savedText = ({ battle }) => `Saved: ${battle.result} vs ${battle.opponent_name}.`;

const syncedText = ({ imported, remaining }) =>
  (imported ? `Imported ${imported} new battle${imported === 1 ? '' : 's'}.` : 'No new battles found.') +
  (remaining ? ` ${remaining} more — sync again to continue.` : '');

/**
 * Three ways in: paste a replay link, sync recent uploads, or arrive from the bookmarklet
 * with `pendingImport` set. `onImported` refreshes the battle list.
 */
export default function AddBattles({ pendingImport, onImported }) {
  const [link, setLink] = useState('');
  const { pending, notice, setNotice, run } = useAsyncAction();

  async function save(input) {
    if (await run(() => importReplay(input), savedText)) onImported();
  }

  useEffect(() => {
    if (pendingImport) save(pendingImport);
    // Only for the replay the page was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingImport]);

  async function handlePaste(e) {
    e.preventDefault();
    if (!parseReplayId(link)) return setNotice({ tone: 'error', text: "That doesn't look like a Showdown replay link." });
    await save(link);
    setLink('');
  }

  async function handleSync() {
    if (await run(syncReplays, syncedText)) onImported();
  }

  return (
    <Card title="Add battles" subtitle="Upload the replay on Showdown first, then paste its link — or sync your recent uploads.">
      <form onSubmit={handlePaste} className="flex gap-2 items-end">
        <TextInput className="flex-1" placeholder="https://replay.pokemonshowdown.com/…" inputMode="url"
          autoComplete="off" value={link} onChange={e => setLink(e.target.value)} />
        <Button type="submit" disabled={pending}>Import</Button>
      </form>
      <div className="flex items-center gap-2 mt-2">
        <Button tone="secondary" disabled={pending} onClick={handleSync}>Sync recent replays</Button>
        {pending && <span className="text-xs text-gray-500">Working…</span>}
      </div>
      <div className="mt-2"><Notice notice={notice} /></div>
    </Card>
  );
}
