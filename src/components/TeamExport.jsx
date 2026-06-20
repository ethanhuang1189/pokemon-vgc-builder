import { useState } from 'react';
import { exportToShowdown, importFromShowdown } from '../utils/showdown';
import { useTeam } from '../context/TeamContext';
import { usePicker } from '../context/PickerContext';

export default function TeamExport() {
  const { team, Dex, clearTeam, updateSlot } = useTeam();
  const { allMegas } = usePicker();
  const [mode, setMode] = useState(null); // 'export' | 'import'
  const [importText, setImportText] = useState('');
  const [copied, setCopied] = useState(false);

  const exportText = exportToShowdown(team);

  function handleCopy() {
    navigator.clipboard.writeText(exportText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleImport() {
    const slots = importFromShowdown(importText, Dex, allMegas);
    if (!slots.length) return;
    clearTeam();
    slots.slice(0, 6).forEach((slot, i) => updateSlot(i, slot));
    setMode(null);
    setImportText('');
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide flex-1">
          Import / Export
        </h3>
        <button
          onClick={() => setMode(mode === 'export' ? null : 'export')}
          className="text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
        >
          Export
        </button>
        <button
          onClick={() => setMode(mode === 'import' ? null : 'import')}
          className="text-xs px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
        >
          Import
        </button>
      </div>

      {mode === 'export' && (
        <div>
          <textarea
            readOnly
            value={exportText || '(No Pokemon on team)'}
            rows={10}
            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-xs text-gray-200 font-mono focus:outline-none resize-none"
          />
          <button
            onClick={handleCopy}
            className="mt-2 text-xs px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
          >
            {copied ? '✓ Copied!' : 'Copy to clipboard'}
          </button>
        </div>
      )}

      {mode === 'import' && (
        <div>
          <p className="text-xs text-gray-400 mb-2">
            Paste a Pokemon Showdown team export below:
          </p>
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder="Paste Showdown paste here..."
            rows={10}
            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-xs text-gray-200 font-mono focus:outline-none focus:border-indigo-500 resize-none"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleImport}
              disabled={!importText.trim()}
              className="text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
            >
              Import Team
            </button>
            <button
              onClick={() => { setMode(null); setImportText(''); }}
              className="text-xs px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
