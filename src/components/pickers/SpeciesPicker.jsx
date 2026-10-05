import { useMemo, useState } from 'react';
import PickerShell, { PickerRow } from './PickerShell';
import TypeBadge from '../TypeBadge';
import StatStack from '../StatStack';
import PokemonSprite from '../PokemonSprite';
import { useFormat } from '../../context/FormatContext';
import { ALL_TYPES } from '../../domain/typeChart.js';
import { STAT_KEYS, STAT_LABELS } from '../../domain/stats.js';
import { filterSpecies, parseResistQuery } from '../../domain/search.js';
import { plural } from '../../domain/ids.js';

const SUGGESTED_MOVES = 6;
const SUGGESTED_ABILITIES = 5;

const filterChipClass = 'flex items-center gap-1 px-2 py-0.5 bg-indigo-900 border border-indigo-600 text-xs text-indigo-200 hover:bg-indigo-800';
const suggestionClass = 'flex items-center gap-1 px-2 py-0.5 bg-gray-700 border border-gray-600 text-[10px] text-white hover:border-indigo-500 rounded-sm';

function ActiveFilter({ label, onRemove }) {
  return (
    <button type="button" onClick={onRemove} className={filterChipClass}>
      {label} <span className="opacity-60">×</span>
    </button>
  );
}

function SuggestionRow({ label, children }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-[9px] text-gray-500 uppercase tracking-widest mr-0.5 shrink-0">{label}:</span>
      {children}
    </div>
  );
}

function SpeciesRow({ species, selected, onClick }) {
  const abilities = [species.abilities[0], species.abilities[1]].filter(Boolean);
  return (
    <PickerRow selected={selected} onClick={onClick} className="gap-2 px-3 py-1.5">
      <PokemonSprite species={species} size={32} glow={false} lazy alt="" />
      <span className={`text-xs font-medium shrink-0 truncate w-20 ${selected ? 'text-indigo-300' : 'text-white'}`}>{species.name}</span>
      <div className="flex flex-col gap-0.5 shrink-0 items-start">
        {species.types.map(t => <TypeBadge key={t} type={t} size="xs" />)}
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        {abilities.map(a => <span key={a} className="text-[9px] text-gray-400 leading-none truncate">{a}</span>)}
      </div>
      <div className="flex gap-1 shrink-0">
        {STAT_KEYS.map(k => <StatStack key={k} label={STAT_LABELS[k]} value={species.baseStats[k]} minWidth={16} />)}
      </div>
    </PickerRow>
  );
}

/**
 * Species search. Typing suggests type/move/ability filters to add;
 * "resist: fire water" lists species resisting every named type.
 */
export default function SpeciesPicker({ current, onSelect }) {
  const { format, moveIndex } = useFormat();
  const [query, setQuery] = useState('');
  const [types, setTypes] = useState([]);
  const [move, setMove] = useState(null);
  const [ability, setAbility] = useState(null);

  const q = query.toLowerCase().trim();
  const resistTypes = parseResistQuery(query);
  const suggesting = q && !resistTypes;

  const suggestions = useMemo(() => (suggesting ? {
    types: ALL_TYPES.filter(t => t.toLowerCase().includes(q) && !types.includes(t)),
    moves: format.moves.filter(m => m.name.toLowerCase().includes(q)).slice(0, SUGGESTED_MOVES),
    abilities: ability ? [] : format.abilities.filter(a => a.name.toLowerCase().includes(q)).slice(0, SUGGESTED_ABILITIES),
  } : { types: [], moves: [], abilities: [] }), [suggesting, q, types, ability, format]);

  const learnerIds = useMemo(
    () => (move && moveIndex ? (moveIndex.get(move.id) ?? new Set()) : null),
    [move, moveIndex],
  );
  const filtered = useMemo(
    () => filterSpecies(format.species, { query, types, learnerIds, ability }),
    [format.species, query, types, learnerIds, ability],
  );

  const addFilter = (apply) => { apply(); setQuery(''); };
  const hasSuggestions = Object.values(suggestions).some(list => list.length > 0);

  const filters = resistTypes ? (
    <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2 shrink-0">
      <span className="text-[9px] text-gray-500 uppercase tracking-widest shrink-0">Resists:</span>
      {resistTypes.length
        ? resistTypes.map(t => <TypeBadge key={t} type={t} size="xs" />)
        : <span className="text-[10px] text-gray-600">type a type name…</span>}
    </div>
  ) : (types.length > 0 || move || ability) && (
    <div className="flex flex-wrap gap-1.5 px-3 pb-2 shrink-0">
      {types.map(t => <ActiveFilter key={t} label={t} onRemove={() => setTypes(ts => ts.filter(x => x !== t))} />)}
      {move && <ActiveFilter label={`Move: ${move.name}`} onRemove={() => setMove(null)} />}
      {ability && <ActiveFilter label={`Ability: ${ability}`} onRemove={() => setAbility(null)} />}
    </div>
  );

  const suggestionBlock = hasSuggestions && (
    <div className="px-3 pt-1.5 pb-2 border-b border-gray-700/60 shrink-0 space-y-1.5">
      {suggestions.types.length > 0 && (
        <SuggestionRow label="Type">
          {suggestions.types.map(t => (
            <button key={t} type="button" className={suggestionClass}
              onClick={() => addFilter(() => setTypes(ts => [...ts, t]))}>{t}</button>
          ))}
        </SuggestionRow>
      )}
      {suggestions.moves.length > 0 && (
        <SuggestionRow label="Move">
          {suggestions.moves.map(m => (
            <button key={m.id} type="button" className={suggestionClass} onClick={() => addFilter(() => setMove(m))}>
              {m.name}<TypeBadge type={m.type} size="xs" />
            </button>
          ))}
        </SuggestionRow>
      )}
      {suggestions.abilities.length > 0 && (
        <SuggestionRow label="Ability">
          {suggestions.abilities.map(a => (
            <button key={a.id} type="button" className={suggestionClass}
              onClick={() => addFilter(() => setAbility(a.name))}>{a.name}</button>
          ))}
        </SuggestionRow>
      )}
    </div>
  );

  return (
    <PickerShell query={query} onQueryChange={setQuery}
      placeholder="Name, type, move, ability, or: resist: fire water…"
      onClear={current ? () => onSelect(null) : null} clearLabel="Remove"
      filters={filters}
      countLabel={plural(filtered.length, 'Pokémon', 'Pokémon')}
      suggestions={suggestionBlock}
      isEmpty={!filtered.length} emptyText="No Pokémon found">
      {filtered.map(s => (
        <SpeciesRow key={s.id} species={s} selected={current?.id === s.id} onClick={() => onSelect(s)} />
      ))}
    </PickerShell>
  );
}
