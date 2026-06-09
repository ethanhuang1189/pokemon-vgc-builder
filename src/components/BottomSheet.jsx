import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePicker } from '../context/PickerContext';
import { useTeam } from '../context/TeamContext';
import TypeBadge from './TypeBadge';
import CategoryIcon from './CategoryIcon';
import StatEditor, { NATURES } from './StatEditor';
import { getItemSpriteUrl } from '../data/itemSprites';
import { BULBAPEDIA_MEGA } from '../data/megaSprites';
import {
  GIF_SPRITE, SWSH_SPRITE, SHOWDOWN_GIF, SHOWDOWN_STATIC, STATIC_SPRITE,
  nameToSlug, handleSpriteError,
} from '../utils/sprites';

const ALL_TYPES = [
  'Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison',
  'Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy',
];

function megaNameToSlug(megaName) {
  const withoutPrefix = megaName.replace(/^Mega /, '');
  const parts = withoutPrefix.split(' ');
  const base = nameToSlug(parts[0]);
  const variant = parts.slice(1).join('-').toLowerCase();
  return variant ? `${base}-mega-${variant}` : `${base}-mega`;
}

function getMegaButtonLabel(megaName, baseName) {
  const variant = megaName.replace(`Mega ${baseName}`, '').replace(/[()]/g, '').trim();
  if (!variant) return 'Mega';
  if (/^[A-Z]$/.test(variant)) return `Mega ${variant}`;
  return variant;
}

function fmtAcc(acc) { return acc === true ? '—' : acc ? `${acc}%` : '—'; }

function StatStack({ label, value }) {
  return (
    <div className="flex flex-col items-center shrink-0 min-w-[18px]">
      <span className="text-[6px] text-gray-500 leading-none">{label}</span>
      <span className="text-[8px] text-gray-300 leading-none mt-px font-mono">{value}</span>
    </div>
  );
}

// A tappable row that opens a sub-picker
function EditRow({ label, onClick, children }) {
  return (
    <button
      type="button" onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2.5 border-b border-gray-800 text-left hover:bg-gray-800 active:bg-gray-700 transition-colors"
    >
      <span className="text-[10px] text-gray-500 uppercase tracking-widest shrink-0 w-14">{label}</span>
      <span className="flex-1 min-w-0">{children}</span>
      <span className="text-gray-600 text-xs shrink-0">›</span>
    </button>
  );
}

// ─── Learnset cache (shared across renders) ───────────────────────────────────

const learnsetCache = new Map();
async function fetchLearnableIds(Dex, speciesId) {
  if (learnsetCache.has(speciesId)) return learnsetCache.get(speciesId);
  const allIds = new Set();
  const visited = new Set();
  const collect = async (id) => {
    if (!id || visited.has(id)) return;
    visited.add(id);
    const sp = Dex.species.get(id);
    if (!sp?.exists) return;
    const ls = await Dex.learnsets.get(sp.id);
    if (ls?.learnset) for (const moveId of Object.keys(ls.learnset)) allIds.add(moveId);
    if (sp.changesFrom) await collect(sp.changesFrom);
    if (sp.prevo) await collect(sp.prevo);
  };
  await collect(speciesId);
  const result = allIds.size > 0 ? allIds : null;
  learnsetCache.set(speciesId, result);
  return result;
}

// ─── Slot Edit Panel ──────────────────────────────────────────────────────────

const STATS_LIST = [
  { key: 'hp', label: 'HP' }, { key: 'atk', label: 'Atk' }, { key: 'def', label: 'Def' },
  { key: 'spa', label: 'SpA' }, { key: 'spd', label: 'SpD' }, { key: 'spe', label: 'Spe' },
];

function SlotPanel() {
  const { activeSlotIndex, openSubPicker, allSpecies, allMoves, allItems, allAbilities, allMegas, Dex } = usePicker();
  const { team, updateSlot } = useTeam();
  const slot = team[activeSlotIndex];
  const [slotMoves, setSlotMoves] = useState(allMoves);
  const [editingNickname, setEditingNickname] = useState(false);
  const [spriteUrlIdx, setSpriteUrlIdx] = useState(0);

  useEffect(() => { setSpriteUrlIdx(0); setEditingNickname(false); }, [activeSlotIndex]);
  useEffect(() => { setSpriteUrlIdx(0); }, [slot?.megaFormId, slot?.species?.id]);

  useEffect(() => {
    if (!slot?.species) { setSlotMoves(allMoves); return; }
    fetchLearnableIds(Dex, slot.species.id).then(ids => {
      setSlotMoves(ids ? allMoves.filter(m => ids.has(m.id)) : allMoves);
    });
  }, [slot?.species?.id, allMoves, Dex]);

  const activeMega = slot?.megaFormId ? allMegas.find(m => m.id === slot.megaFormId) : null;
  const availableMegas = slot?.species ? allMegas.filter(m => m.baseId === slot.species.id) : [];

  const slotAbilities = useMemo(() => {
    const source = activeMega ?? slot?.species;
    if (!source) return allAbilities;
    return Object.values(source.abilities ?? {}).filter(Boolean)
      .map(name => Dex.abilities.get(name)).filter(a => a?.exists);
  }, [activeMega, slot?.species, allAbilities, Dex]);

  const natData = useMemo(() => NATURES[slot?.nature] ?? {}, [slot?.nature]);

  const baseGifUrl         = slot?.species ? GIF_SPRITE(slot.species.name)        : null;
  const baseSwshUrl        = slot?.species ? SWSH_SPRITE(slot.species.name)       : null;
  const baseShowdownGif    = slot?.species ? SHOWDOWN_GIF(slot.species.name)      : null;
  const baseShowdownStatic = slot?.species ? SHOWDOWN_STATIC(slot.species.name)   : null;
  const baseStaticUrl      = slot?.species ? STATIC_SPRITE(slot.species.num)      : null;
  const megaUrls = activeMega ? (() => {
    const slug = megaNameToSlug(activeMega.name);
    const bulba = BULBAPEDIA_MEGA[slug];
    return [`https://projectpokemon.org/images/normal-sprite/${slug}.gif`, ...(bulba ? [bulba] : [])];
  })() : [];
  const allSpriteUrls = [...megaUrls, baseGifUrl, baseSwshUrl, baseShowdownGif, baseShowdownStatic, baseStaticUrl].filter(Boolean);
  const spriteUrl = allSpriteUrls[Math.min(spriteUrlIdx, allSpriteUrls.length - 1)] ?? null;

  const displayName  = activeMega ? (slot.nickname || activeMega.name)
                     : slot?.species ? (slot.nickname || slot.species.name) : `Slot ${activeSlotIndex + 1}`;
  const displayTypes = (activeMega ?? slot?.species)?.types ?? null;

  if (!slot) return null;

  function handleSpeciesSelect(species) {
    const updates = { species, megaFormId: null, item: null };
    if (species) { const a = Object.values(species.abilities)[0]; if (a) updates.ability = a; }
    else { updates.ability = ''; }
    updateSlot(activeSlotIndex, updates);
  }
  function handleMegaToggle(mega) {
    if (slot.megaFormId === mega.id) {
      updateSlot(activeSlotIndex, { megaFormId: null, item: null });
    } else {
      const a = Object.values(mega.abilities ?? {})[0];
      const u = { megaFormId: mega.id, item: mega.stoneItem };
      if (a) u.ability = a;
      updateSlot(activeSlotIndex, u);
    }
  }
  function handleMoveChange(mi, move) {
    const moves = [...slot.moves]; moves[mi] = move;
    updateSlot(activeSlotIndex, { moves });
  }

  function openSpecies() {
    openSubPicker({ mode: 'species', label: 'Pokémon', options: allSpecies, currentValue: slot.species,
      onSelect: handleSpeciesSelect });
  }
  function openItem() {
    openSubPicker({ mode: 'item', label: 'Item', options: allItems,
      currentValue: slot.item ? Dex.items.get(slot.item) : null,
      onSelect: (i) => updateSlot(activeSlotIndex, { item: i?.name ?? null, megaFormId: null }) });
  }
  function openAbility() {
    openSubPicker({ mode: 'ability', label: 'Ability', options: slotAbilities,
      currentValue: slot.ability || null,
      onSelect: (a) => updateSlot(activeSlotIndex, { ability: a?.name ?? '' }) });
  }
  function openMove(mi) {
    openSubPicker({ mode: 'move', label: `Move ${mi + 1}`, options: slotMoves,
      currentValue: slot.moves[mi],
      onSelect: (m) => handleMoveChange(mi, m) });
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Slot header */}
      <div className="flex items-center gap-3 px-4 pb-3 shrink-0">
        <div style={activeMega ? { filter: 'drop-shadow(0 0 5px rgba(168,85,247,0.85))' } : undefined}>
          {spriteUrl
            ? <img key={spriteUrl} src={spriteUrl} alt={displayName} className="w-12 h-12 object-contain"
                draggable="false" onError={() => setSpriteUrlIdx(i => i + 1)} />
            : <div className="w-12 h-12 bg-gray-700 border-2 border-dashed border-gray-600 flex items-center justify-center">
                <span className="text-gray-500 text-xl">+</span>
              </div>
          }
        </div>
        <div className="flex-1 min-w-0">
          {editingNickname ? (
            <input autoFocus type="text" value={slot.nickname}
              onChange={e => updateSlot(activeSlotIndex, { nickname: e.target.value })}
              onBlur={() => setEditingNickname(false)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
              placeholder={slot.species?.name} maxLength={12}
              className="bg-transparent text-base font-bold text-white focus:outline-none border-b border-indigo-500 w-full"
            />
          ) : (
            <button type="button" onClick={() => setEditingNickname(true)}
              className="text-base font-bold text-white truncate text-left w-full">
              {displayName}
            </button>
          )}
          {displayTypes && (
            <div className="flex gap-1 mt-0.5">
              {displayTypes.map(t => <TypeBadge key={t} type={t} size="xs" />)}
            </div>
          )}
        </div>
        {/* Mega buttons */}
        {availableMegas.length > 0 && (
          <div className="flex flex-col gap-1 shrink-0">
            {availableMegas.map(mega => (
              <button key={mega.id} type="button" onClick={() => handleMegaToggle(mega)}
                className={`text-xs px-2 py-1 border font-semibold transition-colors ${slot.megaFormId === mega.id ? 'bg-purple-600 border-purple-500 text-white' : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-purple-500'}`}>
                {getMegaButtonLabel(mega.name, slot.species?.name ?? '')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Edit rows */}
      <div className="overflow-y-auto flex-1">
        <EditRow label="Species" onClick={openSpecies}>
          {slot.species ? (
            <div className="flex items-center gap-2">
              <img src={GIF_SPRITE(slot.species.name)} alt="" className="w-5 h-5 object-contain shrink-0"
                onError={e => handleSpriteError(e, slot.species.name, slot.species.num)} />
              <span className="text-sm text-white">{slot.species.name}</span>
            </div>
          ) : <span className="text-sm text-gray-500">Choose Pokémon…</span>}
        </EditRow>

        <EditRow label="Item" onClick={openItem}>
          {slot.item ? (
            <div className="flex items-center gap-2">
              {(() => { const url = getItemSpriteUrl(Dex.items.get(slot.item)); return url ? <img src={url} alt="" className="w-4 h-4 object-contain shrink-0" onError={e => e.target.style.display='none'} /> : null; })()}
              <span className="text-sm text-white">{slot.item}</span>
            </div>
          ) : <span className="text-sm text-gray-500">{activeMega?.stoneItem ?? 'No item…'}</span>}
        </EditRow>

        <EditRow label="Ability" onClick={openAbility}>
          {slot.ability
            ? <span className="text-sm text-white">{slot.ability}</span>
            : <span className="text-sm text-gray-500">No ability…</span>}
        </EditRow>

        {/* Moves — 2-column grid using EditRow style */}
        <div className="border-b border-gray-800 px-3 py-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Moves</div>
          <div className="grid grid-cols-2 gap-2">
            {slot.moves.map((move, mi) => (
              <button key={mi} type="button" onClick={() => openMove(mi)}
                className="flex flex-col items-start px-2 py-2 bg-gray-800 border border-gray-700 hover:border-gray-500 active:bg-gray-700 transition-colors text-left"
                style={{ minHeight: '48px' }}
              >
                {move ? (
                  <>
                    <span className="text-xs font-semibold text-white truncate w-full">{move.name}</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <TypeBadge type={move.type} size="xs" />
                      <CategoryIcon category={move.category} size="xs" />
                      <span className="text-[9px] text-gray-400">
                        {move.category !== 'Status' && move.basePower ? `${move.basePower} BP` : '—'}
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-gray-500">Move {mi + 1}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="px-3 pt-3">
          <StatEditor
            slot={activeMega?.baseStats ? { ...slot, species: { ...slot.species, baseStats: activeMega.baseStats } } : slot}
            onChange={updates => updateSlot(activeSlotIndex, updates)}
          />
        </div>
        <div className="h-6" />
      </div>
    </div>
  );
}

// ─── Species Sub-Picker ───────────────────────────────────────────────────────

function SpeciesSubPicker({ subPicker }) {
  const { allMoves, allAbilities, moveIndexRef, moveIndexReady, closeSubPicker } = usePicker();
  const [query, setQuery] = useState('');
  const [typeFilters, setTypeFilters] = useState([]);
  const [moveFilter, setMoveFilter] = useState(null);
  const [abilityFilter, setAbilityFilter] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 80); return () => clearTimeout(t); }, []);

  const q = query.toLowerCase().trim();
  const hasFilters = typeFilters.length > 0 || moveFilter || abilityFilter;

  const suggestedTypes     = useMemo(() => q ? ALL_TYPES.filter(t => t.toLowerCase().includes(q) && !typeFilters.includes(t)) : [], [q, typeFilters]);
  const suggestedMoves     = useMemo(() => q ? allMoves.filter(m => m.name.toLowerCase().includes(q)).slice(0, 6) : [], [allMoves, q]);
  const suggestedAbilities = useMemo(() => q && !abilityFilter ? allAbilities.filter(a => a.name.toLowerCase().includes(q)).slice(0, 5) : [], [allAbilities, q, abilityFilter]);

  const moveFilterIds = useMemo(() => {
    if (!moveFilter || !moveIndexRef.current) return null;
    return moveIndexRef.current.get(moveFilter.id) ?? new Set();
  }, [moveFilter, moveIndexReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredSpecies = useMemo(() =>
    (subPicker.options ?? []).filter(s => {
      if (q && !s.name.toLowerCase().includes(q)) return false;
      for (const t of typeFilters) if (!s.types.includes(t)) return false;
      if (moveFilter && moveFilterIds !== null && !moveFilterIds.has(s.id)) return false;
      if (abilityFilter && !Object.values(s.abilities).includes(abilityFilter)) return false;
      return true;
    }),
    [subPicker.options, q, typeFilters, moveFilter, abilityFilter, moveFilterIds]
  );

  const hasSuggestions = suggestedTypes.length > 0 || suggestedMoves.length > 0 || suggestedAbilities.length > 0;

  function pick(species) { subPicker.onSelect(species); closeSubPicker(); }
  function addType(t) { setTypeFilters(f => [...f, t]); setQuery(''); }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-3 pb-2 shrink-0">
        <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Name, type, move, ability…"
          className="w-full bg-gray-800 border border-gray-600 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
      </div>

      {hasFilters && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2 shrink-0">
          {typeFilters.map(t => (
            <button key={t} type="button" onClick={() => setTypeFilters(f => f.filter(x => x !== t))}
              className="flex items-center gap-1 px-2 py-0.5 bg-indigo-900 border border-indigo-600 text-xs text-indigo-200 hover:bg-indigo-800">
              {t} <span className="opacity-60">×</span>
            </button>
          ))}
          {moveFilter && (
            <button type="button" onClick={() => setMoveFilter(null)}
              className="flex items-center gap-1 px-2 py-0.5 bg-indigo-900 border border-indigo-600 text-xs text-indigo-200 hover:bg-indigo-800">
              Move: {moveFilter.name} <span className="opacity-60">×</span>
            </button>
          )}
          {abilityFilter && (
            <button type="button" onClick={() => setAbilityFilter(null)}
              className="flex items-center gap-1 px-2 py-0.5 bg-indigo-900 border border-indigo-600 text-xs text-indigo-200 hover:bg-indigo-800">
              Ability: {abilityFilter} <span className="opacity-60">×</span>
            </button>
          )}
        </div>
      )}

      <div className="px-4 py-1 text-[10px] text-gray-500 shrink-0 border-b border-gray-800">{filteredSpecies.length} Pokémon</div>

      {/* Compact filter suggestions — above Pokémon list so results stay visible */}
      {q && hasSuggestions && (
        <div className="px-3 pt-1.5 pb-2 border-b border-gray-700/60 shrink-0 space-y-1.5">
          {suggestedTypes.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[9px] text-gray-500 uppercase tracking-widest mr-0.5 shrink-0">Type:</span>
              {suggestedTypes.map(t => (
                <button key={t} type="button" onClick={() => addType(t)}
                  className="px-2 py-0.5 bg-gray-700 border border-gray-600 text-[10px] text-white hover:border-indigo-500 rounded-sm">
                  {t}
                </button>
              ))}
            </div>
          )}
          {suggestedMoves.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[9px] text-gray-500 uppercase tracking-widest mr-0.5 shrink-0">Move:</span>
              {suggestedMoves.map(m => (
                <button key={m.id} type="button" onClick={() => { setMoveFilter(m); setQuery(''); }}
                  className="flex items-center gap-1 px-2 py-0.5 bg-gray-700 border border-gray-600 text-[10px] text-white hover:border-indigo-500 rounded-sm">
                  {m.name}
                  <TypeBadge type={m.type} size="xs" />
                </button>
              ))}
            </div>
          )}
          {suggestedAbilities.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[9px] text-gray-500 uppercase tracking-widest mr-0.5 shrink-0">Ability:</span>
              {suggestedAbilities.map(a => (
                <button key={a.id} type="button" onClick={() => { setAbilityFilter(a.name); setQuery(''); }}
                  className="px-2 py-0.5 bg-gray-700 border border-gray-600 text-[10px] text-white hover:border-indigo-500 rounded-sm">
                  {a.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="overflow-y-auto flex-1">
        {filteredSpecies.length === 0
          ? <div className="px-4 py-10 text-center text-gray-500 text-sm">No Pokémon found</div>
          : filteredSpecies.map(s => {
              const isSel = subPicker.currentValue?.id === s.id;
              return (
                <button key={s.id} type="button" onClick={() => pick(s)}
                  className={`w-full flex items-center gap-3 px-3 py-2 border-b border-gray-800 text-left ${isSel ? 'bg-indigo-900/40' : 'hover:bg-gray-800 active:bg-gray-700'}`}>
                  <img src={GIF_SPRITE(s.name)} alt="" className="w-9 h-9 object-contain shrink-0"
                    onError={e => handleSpriteError(e, s.name, s.num)} />
                  <span className={`flex-1 text-sm font-medium ${isSel ? 'text-indigo-300' : 'text-white'}`}>{s.name}</span>
                  <div className="flex gap-1 shrink-0">{s.types.map(t => <TypeBadge key={t} type={t} size="xs" />)}</div>
                </button>
              );
            })
        }
        <div className="h-4" />
      </div>
    </div>
  );
}

// ─── Move Sub-Picker ──────────────────────────────────────────────────────────

function MoveSubPicker({ subPicker }) {
  const { closeSubPicker } = usePicker();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 80); return () => clearTimeout(t); }, []);

  const q = query.toLowerCase().trim();
  const moveTypes = useMemo(() => { const ts = new Set((subPicker.options ?? []).map(m => m.type)); return ALL_TYPES.filter(t => ts.has(t)); }, [subPicker.options]);
  const filtered  = useMemo(() =>
    (subPicker.options ?? []).filter(m => (!q || m.name.toLowerCase().includes(q)) && (!typeFilter || m.type === typeFilter)),
    [subPicker.options, q, typeFilter]
  );

  function pick(move) { subPicker.onSelect(move); closeSubPicker(); }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-2 px-3 pb-2 shrink-0">
        {subPicker.currentValue && (
          <button type="button" onClick={() => pick(null)}
            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 border border-red-800 shrink-0">
            Clear
          </button>
        )}
        <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search moves…"
          className="flex-1 bg-gray-800 border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
      </div>
      <div className="flex gap-1 px-3 pb-2 shrink-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <button type="button" onClick={() => setTypeFilter(null)}
          className={`shrink-0 px-2 py-0.5 text-[10px] border ${!typeFilter ? 'bg-gray-600 border-gray-500 text-white' : 'border-gray-700 text-gray-400'}`}>All</button>
        {moveTypes.map(t => (
          <button key={t} type="button" onClick={() => setTypeFilter(typeFilter === t ? null : t)}
            className={`shrink-0 px-2 py-0.5 text-[10px] border ${typeFilter === t ? 'bg-indigo-700 border-indigo-500 text-white' : 'border-gray-700 text-gray-400'}`}>{t}</button>
        ))}
      </div>
      <div className="px-4 py-1 text-[10px] text-gray-500 shrink-0 border-b border-gray-800">{filtered.length} move{filtered.length !== 1 ? 's' : ''}</div>
      <div className="overflow-y-auto flex-1">
        {filtered.length === 0
          ? <div className="px-4 py-10 text-center text-gray-500 text-sm">No moves found</div>
          : filtered.map(move => {
              const isSel = subPicker.currentValue?.id === move.id;
              return (
                <button key={move.id} type="button" onClick={() => pick(move)}
                  className={`w-full flex items-center gap-1.5 px-3 py-2 border-b border-gray-800 text-left ${isSel ? 'bg-indigo-900/40' : 'hover:bg-gray-800 active:bg-gray-700'}`}>
                  <span className={`text-[11px] font-semibold shrink-0 w-28 truncate ${isSel ? 'text-indigo-300' : 'text-white'}`}>{move.name}</span>
                  <TypeBadge type={move.type} size="xs" />
                  <CategoryIcon category={move.category} size="xs" />
                  <div className="flex gap-px shrink-0">
                    <StatStack label="Power" value={move.category === 'Status' ? '—' : (move.basePower || '—')} />
                    <StatStack label="Acc" value={fmtAcc(move.accuracy)} />
                    <StatStack label="PP" value={move.pp || '—'} />
                  </div>
                  {move.shortDesc && <span className="flex-1 min-w-0 text-[9px] text-gray-500 truncate">{move.shortDesc}</span>}
                </button>
              );
            })
        }
        <div className="h-4" />
      </div>
    </div>
  );
}

// ─── Ability Sub-Picker ───────────────────────────────────────────────────────

function AbilitySubPicker({ subPicker }) {
  const { closeSubPicker } = usePicker();
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 80); return () => clearTimeout(t); }, []);

  const q = query.toLowerCase().trim();
  const filtered = useMemo(() =>
    (subPicker.options ?? []).filter(a => !q || a.name.toLowerCase().includes(q) || a.shortDesc?.toLowerCase().includes(q)),
    [subPicker.options, q]
  );

  function pick(a) { subPicker.onSelect(a); closeSubPicker(); }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-2 px-3 pb-2 shrink-0">
        {subPicker.currentValue && (
          <button type="button" onClick={() => pick(null)}
            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 border border-red-800 shrink-0">
            Clear
          </button>
        )}
        <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search abilities…"
          className="flex-1 bg-gray-800 border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
      </div>
      <div className="px-4 py-1 text-[10px] text-gray-500 shrink-0 border-b border-gray-800">{filtered.length} abilit{filtered.length !== 1 ? 'ies' : 'y'}</div>
      <div className="overflow-y-auto flex-1">
        {filtered.length === 0
          ? <div className="px-4 py-10 text-center text-gray-500 text-sm">No abilities found</div>
          : filtered.map(a => {
              const isSel = subPicker.currentValue === a.name;
              return (
                <button key={a.id} type="button" onClick={() => pick(a)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 border-b border-gray-800 text-left ${isSel ? 'bg-indigo-900/40' : 'hover:bg-gray-800 active:bg-gray-700'}`}>
                  <span className={`text-sm font-medium shrink-0 ${isSel ? 'text-indigo-300' : 'text-white'}`}>{a.name}</span>
                  {a.shortDesc && <span className="text-xs text-gray-400 flex-1 truncate">{a.shortDesc}</span>}
                </button>
              );
            })
        }
        <div className="h-4" />
      </div>
    </div>
  );
}

// ─── Item Sub-Picker ──────────────────────────────────────────────────────────

function ItemSubPicker({ subPicker }) {
  const { closeSubPicker, Dex } = usePicker();
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 80); return () => clearTimeout(t); }, []);

  const q = query.toLowerCase().trim();
  const filtered = useMemo(() =>
    (subPicker.options ?? []).filter(i => !q || i.name.toLowerCase().includes(q) || i.shortDesc?.toLowerCase().includes(q)),
    [subPicker.options, q]
  );

  function pick(i) { subPicker.onSelect(i); closeSubPicker(); }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-2 px-3 pb-2 shrink-0">
        {subPicker.currentValue && (
          <button type="button" onClick={() => pick(null)}
            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 border border-red-800 shrink-0">
            Clear
          </button>
        )}
        <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search items…"
          className="flex-1 bg-gray-800 border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
      </div>
      <div className="px-4 py-1 text-[10px] text-gray-500 shrink-0 border-b border-gray-800">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</div>
      <div className="overflow-y-auto flex-1">
        {filtered.length === 0
          ? <div className="px-4 py-10 text-center text-gray-500 text-sm">No items found</div>
          : filtered.map(i => {
              const isSel = subPicker.currentValue?.id === i.id;
              const spriteUrl = getItemSpriteUrl(i);
              return (
                <button key={i.id} type="button" onClick={() => pick(i)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 border-b border-gray-800 text-left ${isSel ? 'bg-indigo-900/40' : 'hover:bg-gray-800 active:bg-gray-700'}`}>
                  {spriteUrl ? <img src={spriteUrl} alt="" className="w-5 h-5 object-contain shrink-0" onError={e => { e.target.style.display='none'; }} /> : <div className="w-5 h-5 shrink-0" />}
                  <span className={`text-sm font-medium shrink-0 ${isSel ? 'text-indigo-300' : 'text-white'}`}>{i.name}</span>
                  {i.shortDesc && <span className="text-xs text-gray-400 flex-1 truncate">{i.shortDesc}</span>}
                </button>
              );
            })
        }
        <div className="h-4" />
      </div>
    </div>
  );
}

// ─── Main BottomSheet ─────────────────────────────────────────────────────────

export default function BottomSheet() {
  const { activeSlotIndex, subPicker, closeSlot, closeSubPicker } = usePicker();
  const [dragY, setDragY] = useState(0);
  const dragStartRef = useRef(null);
  const isOpen = activeSlotIndex !== null;

  useEffect(() => { setDragY(0); }, [activeSlotIndex]);

  useEffect(() => {
    if (isOpen) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [isOpen]);

  if (!isOpen) return null;

  function onHandlePointerDown(e) { dragStartRef.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); }
  function onHandlePointerMove(e) { if (dragStartRef.current === null) return; setDragY(Math.max(0, e.clientY - dragStartRef.current)); }
  function onHandlePointerUp() {
    if (dragY > 80) closeSlot(); else setDragY(0);
    dragStartRef.current = null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={closeSlot}
        style={{ opacity: Math.max(0.1, 1 - dragY / 300) }} />
      <div
        className="relative bg-gray-900 border-t-2 border-indigo-600 flex flex-col"
        style={{
          height: '85dvh',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          transform: `translateY(${dragY}px)`,
          transition: dragY === 0 ? 'transform 0.25s ease' : 'none',
        }}
      >
        {/* Drag handle + nav bar */}
        <div
          className="flex items-center px-3 py-2 shrink-0 cursor-grab active:cursor-grabbing select-none touch-none gap-3"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
        >
          {subPicker ? (
            <button type="button"
              className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 border border-indigo-800 shrink-0 cursor-pointer touch-auto"
              onPointerDown={e => e.stopPropagation()}
              onClick={closeSubPicker}>
              ← Back
            </button>
          ) : (
            <div className="w-8 shrink-0" />
          )}
          <div className="flex-1 flex justify-center">
            <div className="w-10 h-1 bg-gray-600 rounded-full" />
          </div>
          <div className="w-8 shrink-0 flex justify-end">
            <button type="button"
              className="text-gray-500 hover:text-gray-300 text-lg leading-none cursor-pointer touch-auto"
              onPointerDown={e => e.stopPropagation()}
              onClick={closeSlot}>
              ×
            </button>
          </div>
        </div>

        {/* Sub-picker label */}
        {subPicker && (
          <div className="px-4 pb-2 shrink-0">
            <span className="text-sm font-semibold text-white">{subPicker.label}</span>
          </div>
        )}

        {/* Content */}
        {!subPicker && <SlotPanel />}
        {subPicker?.mode === 'species' && <SpeciesSubPicker subPicker={subPicker} />}
        {subPicker?.mode === 'move'    && <MoveSubPicker    subPicker={subPicker} />}
        {subPicker?.mode === 'ability' && <AbilitySubPicker subPicker={subPicker} />}
        {subPicker?.mode === 'item'    && <ItemSubPicker    subPicker={subPicker} />}
      </div>
    </div>,
    document.body
  );
}
