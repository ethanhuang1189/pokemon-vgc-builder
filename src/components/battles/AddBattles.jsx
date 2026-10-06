import { useEffect, useState } from 'react';
import Card from '../ui/Card';
import { Button, Notice, TextInput } from '../ui/controls';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { importReplay, syncAllReplays } from '../../services/battles.js';
import { parseReplayId } from '../../domain/replay.js';
import { startCooldown } from '../../utils/cooldown.js';

const AUTO_SYNC_COOLDOWN_MS = 2 * 60 * 1000;

const savedText = ({ battle }) => `Saved: ${battle.result} vs ${battle.opponent_name}.`;

const syncedText = ({ imported, remaining }) =>
  (imported ? `Imported ${imported} new battle${imported === 1 ? '' : 's'}.` : 'Up to date — no new battles.') +
  (remaining ? ' More are waiting — sync again to continue.' : '');

/**
 * Paste a replay link, sync uploaded replays, or arrive from the bookmarklet (`pendingImport`).
 * Syncs automatically when opened (at most every couple of minutes) once a name is linked.
 */
export default function AddBattles({ userId, canSync, pendingImport, onImported }) {
  const [link, setLink] = useState('');
  const { pending, notice, setNotice, run } = useAsyncAction();

  async function save(input) {
    if (await run(() => importReplay(input), savedText)) onImported();
  }

  async function sync() {
    const result = await run(syncAllReplays, syncedText);
    if (result?.imported) onImported();
  }

  // The replay the page was opened with (bookmarklet), once.
  useEffect(() => {
    if (pendingImport) save(pendingImport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Automatic sync once names are linked; the cooldown stops tab-switching from re-running it.
  useEffect(() => {
    if (canSync && !pendingImport && startCooldown(`vgc-last-sync:${userId}`, AUTO_SYNC_COOLDOWN_MS)) sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSync]);

  async function handlePaste(e) {
    e.preventDefault();
    if (!parseReplayId(link)) return setNotice({ tone: 'error', text: "That doesn't look like a Showdown replay link." });
    await save(link);
    setLink('');
  }

  return (
    <Card title="Add battles" subtitle="Upload your replays on Showdown — they sync here automatically. Private replays need their link pasted.">
      <form onSubmit={handlePaste} className="flex gap-2 items-end">
        <TextInput className="flex-1" placeholder="https://replay.pokemonshowdown.com/…" inputMode="url"
          autoComplete="off" value={link} onChange={e => setLink(e.target.value)} />
        <Button type="submit" disabled={pending}>Import</Button>
      </form>
      <div className="flex items-center gap-2 mt-2">
        <Button tone="secondary" disabled={pending || !canSync} onClick={sync}>Sync now</Button>
        {pending && <span className="text-xs text-gray-500">Syncing…</span>}
      </div>
      <div className="mt-2"><Notice notice={notice} /></div>
    </Card>
  );
}
