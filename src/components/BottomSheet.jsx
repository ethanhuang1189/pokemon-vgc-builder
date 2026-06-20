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
  handleSpriteError,
} from '../utils/sprites';
import { MEGA_LEARNSETS } from '../data/megaLearnsets';
import { MEGA_STONE_NAMES, toShowdownId } from '../data/megaForms';

const ALL_TYPES = [
  'Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison',
  'Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy',
];

function fmtAcc(acc) { return acc === true ? '—' : acc ? `${acc}%` : '—'; }

function StatStack({ label, value }) {
  return (
    <div className="flex flex-col items-center shrink-0 min-w-[18px]">
      <span className="text-[6px] text-gray-500 leading-none">{label}</span>
      <span className="text-[8px] text-gray-300 leading-none mt-px font-mono">{value}</span>
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

// ─── Team Tabs ────────────────────────────────────────────────────────────────

function TeamTabs() {
  const { activeSlotIndex, openSlot } = usePicker();
  const { team } = useTeam();
  return (
    <div className="flex shrink-0 border-b-2 border-gray-800 bg-gray-900">
      {Array.from({ length: 6 }, (_, i) => {
        const s      = team[i];
        const isAct  = activeSlotIndex === i;
        const isMega = s?.species?.isMega ?? false;
        const spName = isMega ? s.species.baseSpeciesName : s?.species?.name;
        return (
          <button
            key={i}
            type="button"
            onClick={() => openSlot(i)}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 gap-0.5 transition-colors border-b-2 -mb-0.5
              ${isAct ? 'border-indigo-500 bg-gray-800' : 'border-transparent hover:bg-gray-800/50'}`}
          >
            {s?.species ? (
              <div className="relative w-9 h-9 flex items-center justify-center">
                {isMega && (
                  <div className="absolute pointer-events-none" style={{ top: -18, left: '50%', transform: 'translateX(-50%)', filter: 'blur(3px)', zIndex: 0 }}>
                    <div style={{ width: 48, height: 62, clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', background: 'linear-gradient(to bottom, rgba(255,255,215,0.3) 0%, rgba(255,255,215,0.04) 100%)' }} />
                  </div>
                )}
                <img
                  src={isMega ? SHOWDOWN_GIF(s.species.name) : GIF_SPRITE(spName)}
                  alt={s.nickname || s.species.name}
                  className="w-9 h-9 object-contain relative"
                  style={{ zIndex: 1 }}
                  onError={e => handleSpriteError(e, spName, s.species.num)}
                />
              </div>
            ) : (
              <div className="w-9 h-9 flex items-center justify-center text-gray-600 text-lg font-bold">
                {i + 1}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Slot Edit Panel ──────────────────────────────────────────────────────────

function SlotPanel() {
  const { activeSlotIndex, subPicker, openSubPicker, allSpecies, allMoves, allItems, allAbilities, allMegas, Dex } = usePicker();
  const { team, updateSlot } = useTeam();
  const slot = team[activeSlotIndex];
  const [slotMoves, setSlotMoves] = useState(allMoves);
  const [spriteUrlIdx, setSpriteUrlIdx] = useState(0);

  useEffect(() => { setSpriteUrlIdx(0); }, [activeSlotIndex]);
  useEffect(() => { setSpriteUrlIdx(0); }, [slot?.species?.id]);

  useEffect(() => {
    if (!slot?.species) { setSlotMoves(allMoves); return; }
    // For mega species, fetch learnset via base species id; add any custom mega moves
    const lookupId    = slot.species.isMega ? slot.species.baseId : slot.species.id;
    const extraMoves  = slot.species.isMega ? (MEGA_LEARNSETS[slot.species.id] ?? []) : [];
    fetchLearnableIds(Dex, lookupId).then(ids => {
      if (ids) {
        const merged = new Set(ids);
        for (const id of extraMoves) merged.add(id);
        setSlotMoves(allMoves.filter(m => merged.has(m.id)));
      } else if (extraMoves.length > 0) {
        setSlotMoves(allMoves.filter(m => new Set(extraMoves).has(m.id)));
      } else {
        setSlotMoves(allMoves);
      }
    });
  }, [slot?.species?.id, allMoves, Dex]);

  const slotAbilities = useMemo(() => {
    if (!slot?.species) return allAbilities;
    return Object.values(slot.species.abilities ?? {}).filter(Boolean)
      .map(name => Dex.abilities.get(name)).filter(a => a?.exists);
  }, [slot?.species, allAbilities, Dex]);

  const isMega  = slot?.species?.isMega ?? false;
  const megaUrls = isMega ? (() => {
    const slug = toShowdownId(slot.species.id);
    const bulba = BULBAPEDIA_MEGA[slug];
    return [
      `https://projectpokemon.org/images/normal-sprite/${slug}.gif`,
      ...(bulba ? [bulba] : []),
      SHOWDOWN_GIF(slot.species.name),    // play.pokemonshowdown.com/sprites/ani/froslass-mega.gif
      SHOWDOWN_STATIC(slot.species.name), // play.pokemonshowdown.com/sprites/dex/froslass-mega.png
    ];
  })() : [];
  // Base species fallbacks — use base name (e.g. 'Froslass') not mega name to avoid duplicate URLs
  const fallbackName = isMega ? slot.species.baseSpeciesName : slot?.species?.name;
  const baseGifUrl         = fallbackName ? GIF_SPRITE(fallbackName)      : null;
  const baseSwshUrl        = fallbackName ? SWSH_SPRITE(fallbackName)     : null;
  const baseShowdownGif    = fallbackName ? SHOWDOWN_GIF(fallbackName)    : null;
  const baseStaticUrl      = slot?.species ? STATIC_SPRITE(slot.species.num) : null;
  const allSpriteUrls = [...megaUrls, baseGifUrl, baseSwshUrl, baseShowdownGif, baseStaticUrl].filter(Boolean);
  const spriteUrl = allSpriteUrls[Math.min(spriteUrlIdx, allSpriteUrls.length - 1)] ?? null;

  const displayName  = slot?.species ? (slot.nickname || slot.species.name) : `Slot ${activeSlotIndex + 1}`;
  const displayTypes = slot?.species?.types ?? null;
  const natData = useMemo(() => NATURES[slot?.nature] ?? {}, [slot?.nature]);

  if (!slot) return null;

  // Find the base (non-mega) species object for a given mega entry
  function getBaseSpecies(mega) {
    return allSpecies.find(s => !s.isMega && s.name === mega.baseSpeciesName)
        ?? Dex.species.get(mega.baseId);
  }

  function handleSpeciesSelect(species) {
    if (!species) { updateSlot(activeSlotIndex, { species: null, item: null, ability: '' }); return; }
    const updates = { species, item: null };
    if (species.isMega) {
      // Auto-equip the mega stone and set the mega's ability
      if (species.stoneItem) updates.item = species.stoneItem;
      const a = Object.values(species.abilities ?? {})[0];
      if (a) updates.ability = a;
    } else {
      const a = Object.values(species.abilities ?? {})[0];
      if (a) updates.ability = a;
    }
    updateSlot(activeSlotIndex, updates);
  }

  function handleMoveChange(mi, move) {
    const moves = [...slot.moves]; moves[mi] = move;
    updateSlot(activeSlotIndex, { moves });
  }

  function handleItemSelect(item) {
    if (!item) {
      // Clearing item — revert to base if currently mega
      if (isMega) {
        updateSlot(activeSlotIndex, { item: null, species: getBaseSpecies(slot.species) });
      } else {
        updateSlot(activeSlotIndex, { item: null });
      }
      return;
    }

    const baseSpeciesName = isMega ? slot.species.baseSpeciesName : slot.species?.name;

    if (MEGA_STONE_NAMES.has(item.name)) {
      // Find the mega matching this stone + current base species
      const megaSp = allMegas.find(m => m.stoneItem === item.name && m.baseSpeciesName === baseSpeciesName);
      if (megaSp) {
        const a = Object.values(megaSp.abilities ?? {})[0];
        const updates = { species: megaSp, item: item.name };
        if (a) updates.ability = a;
        updateSlot(activeSlotIndex, updates);
      } else {
        // Stone doesn't match this Pokémon — revert to base if currently mega, then set item
        if (isMega) {
          updateSlot(activeSlotIndex, { species: getBaseSpecies(slot.species), item: item.name });
        } else {
          updateSlot(activeSlotIndex, { item: item.name });
        }
      }
    } else {
      // Regular item — revert to base species if currently mega
      if (isMega) {
        updateSlot(activeSlotIndex, { species: getBaseSpecies(slot.species), item: item.name });
      } else {
        updateSlot(activeSlotIndex, { item: item.name });
      }
    }
  }

  function openSpecies() {
    openSubPicker({ mode: 'species', label: 'Pokémon', options: allSpecies, currentValue: slot.species,
      onSelect: handleSpeciesSelect });
  }
  function openItem() {
    const currentItemObj = slot.item ? (allItems.find(i => i.name === slot.item) ?? null) : null;
    openSubPicker({ mode: 'item', label: 'Item', options: allItems,
      currentValue: currentItemObj,
      onSelect: handleItemSelect });
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
  function openStats() {
    openSubPicker({ mode: 'stats', label: 'EVs / Nature' });
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* ── Compact card (always visible) ── */}
      <div className="shrink-0 flex items-stretch gap-2 px-3 py-2.5 border-b border-gray-800">

        {/* Sprite — tap to pick species */}
        <button
          type="button"
          onClick={openSpecies}
          className="shrink-0 w-14 flex items-center justify-center hover:bg-white/5 transition-colors relative"
        >
          {isMega && (
            <div className="absolute pointer-events-none" style={{ top: -25, left: '50%', transform: 'translateX(-50%)', filter: 'blur(4px)', zIndex: 0 }}>
              <div style={{ width: 70, height: 90, clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', background: 'linear-gradient(to bottom, rgba(255,255,215,0.3) 0%, rgba(255,255,215,0.04) 100%)' }} />
            </div>
          )}
          {spriteUrl
            ? <img key={spriteUrl} src={spriteUrl} alt={displayName}
                className="w-14 h-14 object-contain relative" style={{ zIndex: 1 }} draggable="false"
                onError={() => setSpriteUrlIdx(i => i + 1)} />
            : <div className="w-14 h-14 bg-gray-800 border-2 border-dashed border-gray-700 flex items-center justify-center">
                <span className="text-gray-500 text-2xl">+</span>
              </div>
          }
        </button>

        {slot.species ? (
          <div className="flex-1 min-w-0 flex items-stretch gap-1.5">

            {/* Box 1: name / types / item / ability */}
            <div className="flex-1 min-w-0 flex flex-col" style={BOX_STYLE}>
              <div className="flex-1 flex items-center px-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                <span className="text-xs font-semibold text-white truncate">{displayName}</span>
              </div>
              <div className="flex-1 flex items-center px-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                <div className="flex gap-0.5 flex-wrap">{displayTypes?.map(t => <TypeBadge key={t} type={t} size="xs" />)}</div>
              </div>
              <button type="button" onClick={openItem}
                className="flex-1 flex items-center px-2 border-b hover:bg-white/5 text-left"
                style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                {slot.item
                  ? <span className="text-[9px] text-white truncate">@ {slot.item}</span>
                  : <span className="text-[9px] text-gray-600">— no item</span>}
              </button>
              <button type="button" onClick={openAbility}
                className="flex-1 flex items-center px-2 hover:bg-white/5 text-left">
                {slot.ability
                  ? <span className="text-[9px] text-white truncate">{slot.ability}</span>
                  : <span className="text-[9px] text-gray-600">— no ability</span>}
              </button>
            </div>

            {/* Box 2: EVs — tap to open stat editor */}
            <button type="button" onClick={openStats}
              className="shrink-0 flex flex-col px-2 py-1.5 hover:bg-white/5 transition-colors text-left"
              style={BOX_STYLE}>
              {STATS_LIST.map(({ key, label }, i) => {
                const ev      = slot.evs[key] ?? 0;
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
            </button>

            {/* Box 3: Moves — each row tappable */}
            <div className="shrink-0 flex flex-col" style={{ ...BOX_STYLE, minWidth: '90px' }}>
              {slot.moves.map((move, mi) => (
                <button key={mi} type="button" onClick={() => openMove(mi)}
                  className={`flex-1 flex items-center px-2 hover:bg-white/5 text-left ${mi > 0 ? 'border-t' : ''}`}
                  style={mi > 0 ? { borderColor: 'rgba(255,255,255,0.04)' } : undefined}>
                  {move
                    ? <span className="text-[9px] font-medium text-white truncate leading-none">{move.name}</span>
                    : <span className="text-[9px] text-gray-600 leading-none">—</span>}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center">
            <span className="text-gray-500 text-sm">Tap the sprite to add a Pokémon</span>
          </div>
        )}
      </div>

      {/* ── Inline picker area (fills remaining space) ── */}
      <div className="flex flex-col flex-1 min-h-0">
        {!subPicker && (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-gray-600 text-sm">Tap a field above to edit</span>
          </div>
        )}
        {subPicker?.mode === 'species' && <SpeciesSubPicker subPicker={subPicker} />}
        {subPicker?.mode === 'move'    && <MoveSubPicker    subPicker={subPicker} />}
        {subPicker?.mode === 'ability' && <AbilitySubPicker subPicker={subPicker} />}
        {subPicker?.mode === 'item'    && <ItemSubPicker    subPicker={subPicker} />}
        {subPicker?.mode === 'stats'   && (
          <div className="overflow-y-auto flex-1 px-3 pt-3">
            <StatEditor slot={slot} onChange={updates => updateSlot(activeSlotIndex, updates)} />
            <div className="h-8" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Type effectiveness helper ────────────────────────────────────────────────

function typeEffectiveness(Dex, attackType, defenderTypes) {
  let mult = 1;
  for (const defType of defenderTypes) {
    const info = Dex.types.get(defType);
    if (!info?.exists) continue;
    const code = info.damageTaken[attackType] ?? 0;
    if (code === 1) mult *= 2;
    else if (code === 2) mult *= 0.5;
    else if (code === 3) { mult = 0; break; }
  }
  return mult;
}

// ─── Species Sub-Picker ───────────────────────────────────────────────────────

function SpeciesSubPicker({ subPicker }) {
  const { allMoves, allAbilities, moveIndexRef, moveIndexReady, Dex } = usePicker();
  const [query, setQuery] = useState('');
  const [typeFilters, setTypeFilters] = useState([]);
  const [moveFilter, setMoveFilter] = useState(null);
  const [abilityFilter, setAbilityFilter] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 80); return () => clearTimeout(t); }, []);

  const q = query.toLowerCase().trim();

  // Resist-search mode: "resist: fire water" → filter to species that resist all listed types
  const isResistMode = q.startsWith('resist:');
  const resistRaw = isResistMode ? q.slice(7) : '';
  const resistTypeNames = resistRaw.trim().split(/\s+/).filter(Boolean)
    .map(w => ALL_TYPES.find(t => t.toLowerCase().startsWith(w)))
    .filter(Boolean);

  const hasFilters = typeFilters.length > 0 || moveFilter || abilityFilter;

  const suggestedTypes     = useMemo(() => q && !isResistMode ? ALL_TYPES.filter(t => t.toLowerCase().includes(q) && !typeFilters.includes(t)) : [], [q, typeFilters, isResistMode]);
  const suggestedMoves     = useMemo(() => q && !isResistMode ? allMoves.filter(m => m.name.toLowerCase().includes(q)).slice(0, 6) : [], [allMoves, q, isResistMode]);
  const suggestedAbilities = useMemo(() => q && !isResistMode && !abilityFilter ? allAbilities.filter(a => a.name.toLowerCase().includes(q)).slice(0, 5) : [], [allAbilities, q, abilityFilter, isResistMode]);

  const moveFilterIds = useMemo(() => {
    if (!moveFilter || !moveIndexRef.current) return null;
    return moveIndexRef.current.get(moveFilter.id) ?? new Set();
  }, [moveFilter, moveIndexReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredSpecies = useMemo(() =>
    (subPicker.options ?? []).filter(s => {
      if (isResistMode) {
        for (const rType of resistTypeNames) {
          if (typeEffectiveness(Dex, rType, s.types) >= 1) return false;
        }
        return true;
      }
      if (q && !s.name.toLowerCase().includes(q)) return false;
      for (const t of typeFilters) if (!s.types.includes(t)) return false;
      if (moveFilter && moveFilterIds !== null && !moveFilterIds.has(s.id)) return false;
      if (abilityFilter && !Object.values(s.abilities).includes(abilityFilter)) return false;
      return true;
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subPicker.options, q, typeFilters, moveFilter, abilityFilter, moveFilterIds, isResistMode, resistTypeNames.join(','), Dex]
  );

  const hasSuggestions = suggestedTypes.length > 0 || suggestedMoves.length > 0 || suggestedAbilities.length > 0;

  function pick(species) { subPicker.onSelect(species); }
  function addType(t) { setTypeFilters(f => [...f, t]); setQuery(''); }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-3 pb-2 shrink-0">
        <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Name, type, move, ability, or: resist: fire water…"
          className="w-full bg-gray-800 border border-gray-600 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
      </div>

      {isResistMode && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2 shrink-0">
          <span className="text-[9px] text-gray-500 uppercase tracking-widest shrink-0">Resists:</span>
          {resistTypeNames.length > 0
            ? resistTypeNames.map(t => <TypeBadge key={t} type={t} size="xs" />)
            : <span className="text-[10px] text-gray-600">type a type name…</span>}
        </div>
      )}

      {!isResistMode && hasFilters && (
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

  function pick(move) { subPicker.onSelect(move); }

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
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 80); return () => clearTimeout(t); }, []);

  const q = query.toLowerCase().trim();
  const filtered = useMemo(() =>
    (subPicker.options ?? []).filter(a => !q || a.name.toLowerCase().includes(q) || a.shortDesc?.toLowerCase().includes(q)),
    [subPicker.options, q]
  );

  function pick(a) { subPicker.onSelect(a); }

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
  const { Dex } = usePicker();
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 80); return () => clearTimeout(t); }, []);

  const q = query.toLowerCase().trim();
  const filtered = useMemo(() =>
    (subPicker.options ?? []).filter(i => !q || i.name.toLowerCase().includes(q) || i.shortDesc?.toLowerCase().includes(q)),
    [subPicker.options, q]
  );

  function pick(i) { subPicker.onSelect(i); }

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
          height: '92dvh',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          transform: `translateY(${dragY}px)`,
          transition: dragY === 0 ? 'transform 0.25s ease' : 'none',
        }}
      >
        {/* Drag handle row */}
        <div
          className="flex items-center px-3 py-1.5 shrink-0 cursor-grab active:cursor-grabbing select-none touch-none"
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
            <div className="w-12 shrink-0" />
          )}
          <div className="flex-1 flex justify-center">
            <div className="w-10 h-1 bg-gray-600 rounded-full" />
          </div>
          <div className="w-12 shrink-0 flex justify-end">
            <button type="button"
              className="text-gray-500 hover:text-gray-300 text-xl leading-none cursor-pointer touch-auto"
              onPointerDown={e => e.stopPropagation()}
              onClick={closeSlot}>
              ×
            </button>
          </div>
        </div>

        {/* Team tabs — always visible */}
        <TeamTabs />

        {/* Slot panel — compact card + inline pickers */}
        <SlotPanel />
      </div>
    </div>,
    document.body
  );
}
