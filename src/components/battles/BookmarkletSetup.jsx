import { useMemo, useState } from 'react';
import Card from '../ui/Card';
import { Button } from '../ui/controls';
import { buildBookmarklet } from '../../domain/bookmarklet.js';
import { copyText } from '../../utils/clipboard.js';

const STEPS = [
  'Copy the code below.',
  'In Safari, bookmark any page, then edit that bookmark and replace its address with the code.',
  'After a Showdown battle ends, tap the bookmark on the battle tab. It uploads the replay and saves it here.',
];

/** One-tap saving from Showdown — works in Safari (including iPhone) and desktop browsers. */
export default function BookmarkletSetup() {
  const code = useMemo(() => buildBookmarklet(window.location.origin), []);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await copyText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card title="Save battles in one tap"
      action={<Button tone="link" onClick={() => setOpen(o => !o)}>{open ? 'Hide' : 'Set up'}</Button>}>
      {open && (
        <div className="space-y-2">
          <ol className="list-decimal list-inside text-xs text-gray-300 space-y-1">
            {STEPS.map(step => <li key={step}>{step}</li>)}
          </ol>
          <textarea readOnly value={code} rows={3} onFocus={e => e.target.select()}
            className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-[10px] text-gray-300 font-mono resize-none" />
          <Button onClick={handleCopy}>{copied ? '✓ Copied' : 'Copy bookmarklet'}</Button>
          <p className="text-[11px] text-gray-500">
            The bookmarklet only presses Showdown&apos;s own upload button and opens this site. It contains no
            password or key, and the battle itself is fetched from Showdown&apos;s servers.
          </p>
        </div>
      )}
    </Card>
  );
}
