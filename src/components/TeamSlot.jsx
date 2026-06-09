import { useState, useMemo, useRef } from 'react';
import TypeBadge from './TypeBadge';
import { useTeam } from '../context/TeamContext';
import { usePicker } from '../context/PickerContext';
import { exportToShowdown } from '../utils/showdown';
import { BULBAPEDIA_MEGA } from '../data/megaSprites';
import { GIF_SPRITE, SWSH_SPRITE, SHOWDOWN_GIF, SHOWDOWN_STATIC, STATIC_SPRITE } from '../utils/sprites';
import { NATURES } from './StatEditor';

function megaNameToSlugLocal(megaName) {
  // used only for mega sprite URLs — matches nameToSlug logic
  const withoutPrefix = megaName.replace(/^Mega /, '');
  const [base, ...rest] = withoutPrefix.split(' ');
  const slug = base.toLowerCase().replace(/['''..:]/g, '').replace(/\s+/g, '-');
  const variant = rest.join('-').toLowerCase();
  return variant ? `${slug}-mega-${variant}` : `${slug}-mega`;
}

const STATS_LIST = [
  { key: 'hp',  label: 'HP'  },
  { key: 'atk', label: 'Atk' },
  { key: 'def', label: 'Def' },
  { key: 'spa', label: 'SpA' },
  { key: 'spd', label: 'SpD' },
  { key: 'spe', label: 'Spe' },
];

const BOX_STYLE = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' };

const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
    <rect x="9" y="9" width="13" height="13" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const ShowdownIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
    <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);
const DeleteIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
  </svg>
);

export default function TeamSlot({ index, allMegas, onMoveHandlePointerDown }) {
  const { team, updateSlot, clearSlot } = useTeam();
  const { activeSlotIndex, openSlot } = usePicker();
  const slot = team[index];
  const [spriteUrlIdx, setSpriteUrlIdx] = useState(0);
  const [toast, setToast] = useState('');

  const spriteHeld      = useRef(false);
  const spriteDragActive = useRef(false);

  const activeMega = slot.megaFormId ? allMegas.find(m => m.id === slot.megaFormId) : null;

  const baseGifUrl         = slot.species ? GIF_SPRITE(slot.species.name)        : null;
  const baseSwshUrl        = slot.species ? SWSH_SPRITE(slot.species.name)       : null;
  const baseShowdownGif    = slot.species ? SHOWDOWN_GIF(slot.species.name)      : null;
  const baseShowdownStatic = slot.species ? SHOWDOWN_STATIC(slot.species.name)   : null;
  const baseStaticUrl      = slot.species ? STATIC_SPRITE(slot.species.num)      : null;
  const megaUrls = activeMega ? (() => {
    const slug = megaNameToSlugLocal(activeMega.name);
    const bulba = BULBAPEDIA_MEGA[slug];
    return [`https://projectpokemon.org/images/normal-sprite/${slug}.gif`, ...(bulba ? [bulba] : [])];
  })() : [];
  const allSpriteUrls = [...megaUrls, baseGifUrl, baseSwshUrl, baseShowdownGif, baseShowdownStatic, baseStaticUrl].filter(Boolean);
  const spriteUrl = allSpriteUrls[Math.min(spriteUrlIdx, allSpriteUrls.length - 1)] ?? null;

  const natData = useMemo(() => NATURES[slot.nature] ?? {}, [slot.nature]);
  const displayName  = activeMega ? (slot.nickname || activeMega.name) : slot.species ? (slot.nickname || slot.species.name) : `Slot ${index + 1}`;
  const displayTypes = (activeMega ?? slot.species)?.types ?? null;
  const isActive = activeSlotIndex === index;

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    Object.assign(ta.style, { position: 'fixed', opacity: '0', top: '0', left: '0' });
    ta.value = text; document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch { /* silent */ }
    document.body.removeChild(ta);
  }
  function copyText(text) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    fallbackCopy(text); return Promise.resolve();
  }
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2000); }
  function handleCopySlot() {
    if (!slot.species) { showToast('No Pokémon'); return; }
    copyText(exportToShowdown([slot], allMegas)).then(() => showToast('Copied!'));
  }
  function handleShowdownCopy() {
    if (!slot.species) { showToast('No Pokémon'); return; }
    copyText(exportToShowdown([slot], allMegas)).then(() => showToast('SD copied!'));
  }
  function handleDelete() { clearSlot(index); }

  // Sprite: press and move to drag; press and release to open slot
  function handleSpritePointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();
    spriteHeld.current = true;
    spriteDragActive.current = false;
  }
  function handleSpritePointerMove(e) {
    if (!spriteHeld.current || spriteDragActive.current) return;
    spriteDragActive.current = true;
    spriteHeld.current = false;
    onMoveHandlePointerDown?.({ preventDefault: () => {}, clientY: e.clientY });
  }
  function handleSpritePointerUp() { spriteHeld.current = false; }
  function handleSpriteClick(e) {
    if (spriteDragActive.current) { spriteDragActive.current = false; e.stopPropagation(); }
    // else bubble → header click → openSlot
  }
  function handleHeaderClick() { openSlot(index); }

  return (
    <div className={`bg-gray-800 border overflow-hidden transition-colors ${isActive ? 'border-indigo-500' : 'border-gray-700'}`}>
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={handleHeaderClick}
      >
        {/* Sprite — hold to drag */}
        <div
          className="w-12 shrink-0 flex items-center justify-center self-stretch touch-none cursor-grab active:cursor-grabbing"
          style={activeMega ? { filter: 'drop-shadow(0 0 5px rgba(168,85,247,0.85))' } : undefined}
          onPointerDown={handleSpritePointerDown}
          onPointerMove={handleSpritePointerMove}
          onPointerUp={handleSpritePointerUp}
          onPointerCancel={handleSpritePointerUp}
          onClick={handleSpriteClick}
        >
          {slot.species ? (
            <img key={spriteUrl} src={spriteUrl} alt={displayName} className="w-12 h-12 object-contain"
              draggable="false" onError={() => setSpriteUrlIdx(i => i + 1)} />
          ) : (
            <div className="w-10 h-10 bg-gray-700 border-2 border-dashed border-gray-600 flex items-center justify-center">
              <span className="text-gray-500 text-lg">+</span>
            </div>
          )}
        </div>

        {/* Summary info */}
        {slot.species ? (
          <div className="flex-1 min-w-0 flex items-stretch gap-1.5">
            {/* Box 1: name / types / item / ability */}
            <div className="flex-1 min-w-0 flex flex-col px-2 py-1.5" style={BOX_STYLE}>
              <div className="flex-1 flex items-center border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                <span className="text-xs font-semibold text-white truncate">{displayName}</span>
              </div>
              <div className="flex-1 flex items-center border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                <div className="flex gap-0.5 flex-wrap">{displayTypes?.map(t => <TypeBadge key={t} type={t} size="xs" />)}</div>
              </div>
              <div className="flex-1 flex items-center border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                {slot.item ? <span className="text-[9px] text-white truncate">@ {slot.item}</span> : <span className="text-[9px] text-gray-600">— no item</span>}
              </div>
              <div className="flex-1 flex items-center">
                {slot.ability ? <span className="text-[9px] text-white truncate">{slot.ability}</span> : <span className="text-[9px] text-gray-600">— no ability</span>}
              </div>
            </div>

            {/* Box 2: EVs */}
            <div className="shrink-0 flex flex-col px-2 py-1.5" style={BOX_STYLE}>
              {STATS_LIST.map(({ key, label }, i) => {
                const ev = slot.evs[key] ?? 0;
                const isPlus  = natData.plus  === key;
                const isMinus = natData.minus === key;
                return (
                  <div key={key} className={`flex-1 flex items-center justify-between gap-2 ${i > 0 ? 'border-t' : ''}`}
                    style={i > 0 ? { borderColor: 'rgba(255,255,255,0.04)' } : undefined}>
                    <span className={`text-[9px] font-medium leading-none ${isPlus ? 'text-blue-400' : isMinus ? 'text-red-400' : 'text-gray-400'}`}>
                      {label}{isPlus ? '+' : isMinus ? '−' : ''}
                    </span>
                    <span className={`text-[9px] font-mono leading-none ${ev > 0 ? 'text-white' : 'text-gray-600'}`}>
                      {ev > 0 ? ev : '—'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Box 3: Moves */}
            <div className="shrink-0 flex flex-col px-2 py-1.5" style={{ ...BOX_STYLE, minWidth: '90px' }}>
              {slot.moves.map((move, mi) => (
                <div key={mi} className={`flex-1 flex items-center ${mi > 0 ? 'border-t' : ''}`}
                  style={mi > 0 ? { borderColor: 'rgba(255,255,255,0.04)' } : undefined}>
                  {move ? <span className="text-[9px] font-medium text-white truncate leading-none">{move.name}</span>
                        : <span className="text-[9px] text-gray-600 leading-none">—</span>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <span className="flex-1 text-gray-500 text-sm">{displayName}</span>
        )}

        {toast && <span className="text-[10px] text-green-400 shrink-0">{toast}</span>}

        {/* 3-button column */}
        <div className="flex flex-col shrink-0 self-stretch justify-around"
          onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
          <button type="button" title="Copy Pokémon" onClick={handleCopySlot}
            className="p-1.5 text-gray-400 hover:text-white transition-colors flex items-center justify-center">
            <CopyIcon />
          </button>
          <button type="button" title="Copy Showdown format" onClick={handleShowdownCopy}
            className="p-1.5 text-gray-400 hover:text-white transition-colors flex items-center justify-center">
            <ShowdownIcon />
          </button>
          <button type="button" title="Delete Pokémon" onClick={handleDelete}
            className="p-1.5 text-gray-500 hover:text-red-400 transition-colors flex items-center justify-center">
            <DeleteIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
