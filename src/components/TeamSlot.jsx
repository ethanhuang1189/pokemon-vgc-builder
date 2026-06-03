import { useState, useMemo, useEffect, useRef } from 'react';
import SearchSelect from './SearchSelect';
import TypeBadge from './TypeBadge';
import MoveSlot from './MoveSlot';
import StatEditor, { NATURES } from './StatEditor';
import { TYPE_COLORS } from '../data/typeChart';
import { useTeam } from '../context/TeamContext';
import { exportToShowdown } from '../utils/showdown';
import { BULBAPEDIA_MEGA } from '../data/megaSprites';
import { getItemSpriteUrl } from '../data/itemSprites';

function nameToSlug(name) {
  return name
    .replace(/♀/g, '-f').replace(/♂/g, '-m')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['''..:]/g, '').replace(/\s+/g, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '');
}
function megaNameToSlug(megaName) {
  const withoutPrefix = megaName.replace(/^Mega /, '');
  const parts = withoutPrefix.split(' ');
  const base = nameToSlug(parts[0]);
  const variant = parts.slice(1).join('-').toLowerCase();
  return variant ? `${base}-mega-${variant}` : `${base}-mega`;
}

const GIF_SPRITE      = n   => `https://projectpokemon.org/images/normal-sprite/${nameToSlug(n)}.gif`;
const SWSH_SPRITE     = n   => `https://projectpokemon.org/images/sprites-models/swsh-normal-sprites/${nameToSlug(n)}.gif`;
const SHOWDOWN_GIF    = n   => `https://play.pokemonshowdown.com/sprites/ani/${nameToSlug(n)}.gif`;
const SHOWDOWN_STATIC = n   => `https://play.pokemonshowdown.com/sprites/dex/${nameToSlug(n)}.png`;
const STATIC_SPRITE   = num => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${num}.png`;

const learnsetCache = new Map();
async function fetchLearnableIds(Dex, speciesId) {
  if (learnsetCache.has(speciesId)) return learnsetCache.get(speciesId);
  const allIds = new Set();
  let current = Dex.species.get(speciesId);
  while (current?.exists) {
    const ls = await Dex.learnsets.get(current.id);
    if (ls?.learnset) for (const id of Object.keys(ls.learnset)) allIds.add(id);
    current = current.prevo ? Dex.species.get(current.prevo) : null;
  }
  const result = allIds.size > 0 ? allIds : null;
  learnsetCache.set(speciesId, result);
  return result;
}

function getMegaButtonLabel(megaName, baseName) {
  const variant = megaName.replace(`Mega ${baseName}`, '').replace(/[()]/g, '').trim();
  if (!variant) return 'Mega';
  if (/^[A-Z]$/.test(variant)) return `Mega ${variant}`;
  return variant;
}

function HScrollText({ className, children }) {
  const ref = useRef(null);
  const startX = useRef(0);
  const startScroll = useRef(0);
  function onDown(e) { e.currentTarget.setPointerCapture(e.pointerId); startX.current = e.clientX; startScroll.current = ref.current.scrollLeft; }
  function onMove(e) { if (!e.currentTarget.hasPointerCapture(e.pointerId)) return; ref.current.scrollLeft = startScroll.current - (e.clientX - startX.current); }
  return (
    <div ref={ref} className={`overflow-x-auto cursor-grab active:cursor-grabbing ${className}`}
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} onPointerDown={onDown} onPointerMove={onMove}>
      <span className="whitespace-nowrap">{children}</span>
    </div>
  );
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

export default function TeamSlot({ index, allSpecies, allMoves, allItems, allAbilities, allMegas, onMoveHandlePointerDown }) {
  const { team, updateSlot, clearSlot, Dex } = useTeam();
  const slot = team[index];
  const [expanded, setExpanded] = useState(false);
  const [editingNickname, setEditingNickname] = useState(false);
  const [slotMoves, setSlotMoves] = useState(allMoves);
  const [spriteUrlIdx, setSpriteUrlIdx] = useState(0);
  const [toast, setToast] = useState('');

  const longPressTimer  = useRef(null);
  const longPressOrigin = useRef({ x: 0, y: 0 });
  const currentPtrY     = useRef(0);
  const dragActivated   = useRef(false);

  useEffect(() => {
    if (!slot.species) { setSlotMoves(allMoves); return; }
    fetchLearnableIds(Dex, slot.species.id).then(learnableIds => {
      if (!learnableIds) { setSlotMoves(allMoves); return; }
      setSlotMoves(allMoves.filter(m => learnableIds.has(m.id)));
    });
  }, [slot.species?.id, allMoves, Dex]);

  useEffect(() => { setSpriteUrlIdx(0); }, [slot.megaFormId, slot.species?.id]);

  const availableMegas = useMemo(
    () => slot.species ? allMegas.filter(m => m.baseId === slot.species.id) : [],
    [slot.species, allMegas]
  );
  const activeMega = slot.megaFormId ? allMegas.find(m => m.id === slot.megaFormId) : null;

  const baseGifUrl        = slot.species ? GIF_SPRITE(slot.species.name)        : null;
  const baseSwshUrl       = slot.species ? SWSH_SPRITE(slot.species.name)       : null;
  const baseShowdownGif   = slot.species ? SHOWDOWN_GIF(slot.species.name)      : null;
  const baseShowdownStatic= slot.species ? SHOWDOWN_STATIC(slot.species.name)   : null;
  const baseStaticUrl     = slot.species ? STATIC_SPRITE(slot.species.num)      : null;
  const megaUrls = activeMega ? (() => {
    const slug = megaNameToSlug(activeMega.name);
    const bulba = BULBAPEDIA_MEGA[slug];
    return [`https://projectpokemon.org/images/normal-sprite/${slug}.gif`, ...(bulba ? [bulba] : [])];
  })() : [];
  const allSpriteUrls = [...megaUrls, baseGifUrl, baseSwshUrl, baseShowdownGif, baseShowdownStatic, baseStaticUrl].filter(Boolean);
  const spriteUrl = allSpriteUrls[Math.min(spriteUrlIdx, allSpriteUrls.length - 1)] ?? null;

  const slotAbilities = useMemo(() => {
    const source = activeMega ?? slot.species;
    if (!source) return allAbilities;
    const abils = Object.values(source.abilities ?? {}).filter(Boolean);
    return abils.map(name => Dex.abilities.get(name)).filter(a => a?.exists);
  }, [activeMega, slot.species, allAbilities, Dex]);

  const natData = useMemo(() => NATURES[slot.nature] ?? {}, [slot.nature]);

  function handleSpeciesChange(species) {
    const updates = { species, megaFormId: null, item: null };
    if (species) {
      const firstAbil = Object.values(species.abilities)[0];
      if (firstAbil) updates.ability = firstAbil;
    } else { updates.ability = ''; }
    updateSlot(index, updates);
  }
  function handleMegaToggle(mega) {
    if (slot.megaFormId === mega.id) {
      updateSlot(index, { megaFormId: null, item: null });
    } else {
      const firstAbil = Object.values(mega.abilities ?? {})[0];
      const updates = { megaFormId: mega.id, item: mega.stoneItem };
      if (firstAbil) updates.ability = firstAbil;
      updateSlot(index, updates);
    }
  }
  function handleMoveChange(moveIndex, move) {
    const moves = [...slot.moves];
    moves[moveIndex] = move;
    updateSlot(index, { moves });
  }

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
  function handleDelete() { clearSlot(index); setExpanded(false); }

  // Long-press anywhere on header to drag
  function handleHeaderPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragActivated.current = false;
    longPressOrigin.current = { x: e.clientX, y: e.clientY };
    currentPtrY.current = e.clientY;
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      dragActivated.current = true;
      onMoveHandlePointerDown?.({ preventDefault: () => {}, clientY: currentPtrY.current });
    }, 300);
  }
  function handleHeaderPointerMove(e) {
    currentPtrY.current = e.clientY;
    if (!longPressTimer.current) return;
    if (Math.abs(e.clientX - longPressOrigin.current.x) > 8 || Math.abs(e.clientY - longPressOrigin.current.y) > 8) {
      clearTimeout(longPressTimer.current); longPressTimer.current = null;
    }
  }
  function handleHeaderPointerUp() {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }
  function handleHeaderClick() {
    if (dragActivated.current) { dragActivated.current = false; return; }
    setExpanded(e => !e);
  }

  const displayName  = activeMega ? (slot.nickname || activeMega.name) : slot.species ? (slot.nickname || slot.species.name) : `Slot ${index + 1}`;
  const displayTypes = (activeMega ?? slot.species)?.types ?? null;

  return (
    <div className={`bg-gray-800 border overflow-hidden transition-colors ${expanded ? 'border-indigo-500' : 'border-gray-700'}`}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={handleHeaderClick}
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        onPointerCancel={handleHeaderPointerUp}
      >
        {/* Sprite */}
        <div className="w-12 shrink-0 flex items-center justify-center self-stretch"
          style={activeMega ? { filter: 'drop-shadow(0 0 5px rgba(168,85,247,0.85))' } : undefined}>
          {slot.species ? (
            <img key={spriteUrl} src={spriteUrl} alt={displayName} className="w-12 h-12 object-contain"
              onError={() => setSpriteUrlIdx(i => i + 1)} />
          ) : (
            <div className="w-10 h-10 bg-gray-700 border-2 border-dashed border-gray-600 flex items-center justify-center">
              <span className="text-gray-500 text-lg">+</span>
            </div>
          )}
        </div>

        {/* Middle: 3 aligned boxes when species is set */}
        {slot.species ? (
          <div className="flex-1 min-w-0 flex items-stretch gap-1.5">

            {/* Box 1: Info (name, types, item, ability) */}
            <div className="flex-1 min-w-0 flex flex-col px-2 py-1.5" style={BOX_STYLE}>
              {/* Name — click to edit */}
              <div className="flex-1 flex items-center border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                {editingNickname ? (
                  <input
                    autoFocus
                    type="text"
                    value={slot.nickname}
                    onChange={e => updateSlot(index, { nickname: e.target.value })}
                    onBlur={() => setEditingNickname(false)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
                    onClick={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                    placeholder={slot.species?.name}
                    maxLength={12}
                    className="w-full bg-transparent text-xs font-semibold text-white focus:outline-none border-b border-indigo-500"
                  />
                ) : (
                  <span
                    className="text-xs font-semibold text-white truncate cursor-text"
                    onClick={e => { e.stopPropagation(); setEditingNickname(true); }}
                    onPointerDown={e => e.stopPropagation()}
                  >
                    {displayName}
                  </span>
                )}
              </div>
              {/* Types */}
              <div className="flex-1 flex items-center border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                <div className="flex gap-0.5 flex-wrap">
                  {displayTypes?.map(t => <TypeBadge key={t} type={t} size="xs" />)}
                </div>
              </div>
              {/* Item */}
              <div className="flex-1 flex items-center border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                {slot.item
                  ? <span className="text-[9px] text-white truncate">@ {slot.item}</span>
                  : <span className="text-[9px] text-gray-600">— no item</span>}
              </div>
              {/* Ability */}
              <div className="flex-1 flex items-center">
                {slot.ability
                  ? <span className="text-[9px] text-white truncate">{slot.ability}</span>
                  : <span className="text-[9px] text-gray-600">— no ability</span>}
              </div>
            </div>

            {/* Box 2: Stats (all 6, always shown) */}
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

            {/* Box 3: Moves (all 4 slots, symmetrically distributed) */}
            <div className="shrink-0 flex flex-col px-2 py-1.5" style={{ ...BOX_STYLE, minWidth: '90px' }}>
              {slot.moves.map((move, mi) => (
                <div key={mi} className={`flex-1 flex items-center ${mi > 0 ? 'border-t' : ''}`}
                  style={mi > 0 ? { borderColor: 'rgba(255,255,255,0.04)' } : undefined}>
                  {move
                    ? <span className="text-[9px] font-medium text-white truncate leading-none">{move.name}</span>
                    : <span className="text-[9px] text-gray-600 leading-none">—</span>}
                </div>
              ))}
            </div>

          </div>
        ) : (
          /* Empty slot placeholder */
          <span className="flex-1 text-gray-500 text-sm">{displayName}</span>
        )}

        {/* Toast */}
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

      {/* Expanded edit panel */}
      {expanded && (
        <div className="px-3 pb-4 border-t border-gray-700 pt-3 space-y-3">

          {/* Species + Mega */}
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <label className="text-xs text-gray-500 mb-1 block">Pokemon</label>
              <SearchSelect
                options={allSpecies}
                value={slot.species}
                onChange={handleSpeciesChange}
                getLabel={s => s.name}
                getKey={s => s.id}
                placeholder="Search…"
                renderOption={s => (
                  <div className="flex items-center gap-1.5">
                    <img src={GIF_SPRITE(s.name)} alt=""
                      onError={e => {
                        const src = e.target.src;
                        if (src.includes('normal-sprite/')) e.target.src = SWSH_SPRITE(s.name);
                        else if (src.includes('swsh-normal-sprites/')) e.target.src = SHOWDOWN_GIF(s.name);
                        else if (src.includes('/sprites/ani/')) e.target.src = SHOWDOWN_STATIC(s.name);
                        else e.target.src = STATIC_SPRITE(s.num);
                      }}
                      className="w-7 h-7 object-contain shrink-0" />
                    <span className="text-white flex-1 truncate text-xs">{s.name}</span>
                    <div className="flex gap-1 shrink-0">{s.types.map(t => <TypeBadge key={t} type={t} />)}</div>
                  </div>
                )}
              />
            </div>
            {availableMegas.length > 0 && (
              <div className="flex flex-col gap-1 shrink-0">
                {availableMegas.map(mega => {
                  const isActive = slot.megaFormId === mega.id;
                  return (
                    <button key={mega.id} type="button" onClick={() => handleMegaToggle(mega)}
                      className={`text-sm px-3 py-1.5 border font-semibold tracking-wide transition-colors ${isActive ? 'bg-purple-600 border-purple-500 text-white' : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-purple-500 hover:text-purple-300'}`}>
                      {getMegaButtonLabel(mega.name, slot.species.name)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Item */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              {activeMega ? <span>Item <span className="text-purple-400 font-normal">(change to un-mega)</span></span> : 'Item'}
            </label>
            <SearchSelect
              options={allItems}
              value={slot.item ? Dex.items.get(slot.item) : null}
              onChange={i => updateSlot(index, { item: i?.name ?? null, megaFormId: null })}
              getLabel={i => i?.name ?? ''} getKey={i => i.id} getDescription={i => i?.shortDesc ?? ''}
              placeholder={activeMega?.stoneItem ?? 'Search…'}
              renderOption={i => (
                <div className="flex items-center gap-1">
                  {(() => { const url = getItemSpriteUrl(i); return url ? <img src={url} alt="" className="w-5 h-5 object-contain shrink-0" onError={e => { e.target.style.display = 'none'; }} /> : null; })()}
                  <span className="text-white text-[11px] font-medium shrink-0">{i.name}</span>
                  {i.shortDesc && <HScrollText className="flex-1 text-gray-400 text-[10px]">{i.shortDesc}</HScrollText>}
                </div>
              )}
            />
          </div>

          {/* Ability */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Ability</label>
            <SearchSelect
              options={slotAbilities}
              value={slot.ability ? Dex.abilities.get(slot.ability) : null}
              onChange={a => updateSlot(index, { ability: a?.name ?? '' })}
              getLabel={a => a?.name ?? ''} getKey={a => a.id} placeholder="Ability…"
              renderOption={a => (
                <div className="flex items-center gap-2">
                  <span className="text-white text-xs font-medium shrink-0">{a.name}</span>
                  {a.shortDesc && <span className="text-gray-400 text-[10px] flex-1 truncate">{a.shortDesc}</span>}
                </div>
              )}
            />
          </div>

          {/* Moves */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Moves</label>
            <div className="grid grid-cols-2 gap-2">
              {slot.moves.map((move, mi) => (
                <MoveSlot key={mi} index={mi} move={move} allMoves={slotMoves} onChange={m => handleMoveChange(mi, m)} />
              ))}
            </div>
          </div>

          {/* Stats */}
          <StatEditor
            slot={activeMega?.baseStats ? { ...slot, species: { ...slot.species, baseStats: activeMega.baseStats } } : slot}
            onChange={updates => updateSlot(index, updates)}
          />
        </div>
      )}
    </div>
  );
}
