import { useState } from 'react';
import { useTeam } from '../context/TeamContext';
import { useFormat } from '../context/FormatContext';
import { exportToShowdown, importFromShowdown } from '../domain/showdown.js';
import { teamFromSlots, TEAM_SIZE } from '../domain/team.js';
import { copyText } from '../utils/clipboard.js';

const buttonClass = 'text-xs px-3 py-1 text-white rounded transition-colors';
const primary = `${buttonClass} bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed`;
const secondary = `${buttonClass} bg-gray-600 hover:bg-gray-500`;
const textareaClass = 'w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-xs text-gray-200 font-mono focus:outline-none resize-none';

function ExportView({ text }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div>
      <textarea readOnly value={text || '(No Pokémon on team)'} rows={10} className={textareaClass} />
      <button onClick={handleCopy} className={`mt-2 ${secondary}`}>{copied ? '✓ Copied!' : 'Copy to clipboard'}</button>
    </div>
  );
}

function ImportView({ onImport, onCancel }) {
  const { format } = useFormat();
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');

  function handleImport() {
    const { slots, skipped } = importFromShowdown(text, format);
    const notes = [];
    if (skipped.length) notes.push(`Not legal in ${format.regulation.id}: ${skipped.join(', ')}`);
    if (slots.length > TEAM_SIZE) notes.push(`Only the first ${TEAM_SIZE} Pokémon were imported`);
    if (!slots.length) {
      setMessage(notes[0] ?? 'No Pokémon found in the paste');
      return;
    }
    onImport(slots, notes.join('. '));
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-2">Paste a Pokémon Showdown team export below:</p>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Paste Showdown paste here..."
        rows={10} className={`${textareaClass} focus:border-indigo-500`} />
      {message && <p className="text-xs text-yellow-400 mt-1">{message}</p>}
      <div className="flex gap-2 mt-2">
        <button onClick={handleImport} disabled={!text.trim()} className={primary}>Import Team</button>
        <button onClick={onCancel} className={secondary}>Cancel</button>
      </div>
    </div>
  );
}

export default function TeamExport() {
  const { team, replaceTeam } = useTeam();
  const [mode, setMode] = useState(null); // 'export' | 'import' | null
  const [notice, setNotice] = useState('');
  const toggle = (next) => { setMode(m => (m === next ? null : next)); setNotice(''); };

  function handleImport(slots, importNotice) {
    replaceTeam(teamFromSlots(slots));
    setNotice(importNotice);
    setMode(null);
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide flex-1">Import / Export</h3>
        <button onClick={() => toggle('export')} className={primary}>Export</button>
        <button onClick={() => toggle('import')} className={secondary}>Import</button>
      </div>
      {notice && <p className="text-xs text-yellow-400 mb-2">{notice}</p>}
      {mode === 'export' && <ExportView text={exportToShowdown(team)} />}
      {mode === 'import' && <ImportView onImport={handleImport} onCancel={() => setMode(null)} />}
    </div>
  );
}
