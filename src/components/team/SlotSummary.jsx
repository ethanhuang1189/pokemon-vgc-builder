import TypeBadge from '../TypeBadge';
import { STAT_KEYS, STAT_LABELS, natureEffect } from '../../domain/stats.js';

const BOX_STYLE = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' };
const ROW_BORDER = { borderColor: 'rgba(255,255,255,0.04)' };

// One row of a box: a button when `onClick` is given, otherwise static.
function Row({ onClick, divider, active = false, className = '', children }) {
  const classes = `flex-1 flex items-center px-2 text-left min-w-0 ${divider ? 'border-t' : ''} ${
    active ? 'bg-indigo-600/30' : onClick ? 'hover:bg-white/5' : ''} ${className}`;
  const style = divider ? ROW_BORDER : undefined;
  return onClick
    ? <button type="button" onClick={onClick} className={classes} style={style}>{children}</button>
    : <div className={classes} style={style}>{children}</div>;
}

const Placeholder = ({ children }) => <span className="text-[9px] text-gray-600 leading-none">{children}</span>;

function IdentityBox({ slot, onItemClick, onAbilityClick }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col py-0.5" style={BOX_STYLE}>
      <Row>
        <span className="text-xs font-semibold text-white truncate">{slot.nickname || slot.species.name}</span>
      </Row>
      <Row divider>
        <div className="flex gap-0.5 flex-wrap">{slot.species.types.map(t => <TypeBadge key={t} type={t} size="xs" />)}</div>
      </Row>
      <Row divider onClick={onItemClick}>
        {slot.item ? <span className="text-[9px] text-white truncate">@ {slot.item}</span> : <Placeholder>— no item</Placeholder>}
      </Row>
      <Row divider onClick={onAbilityClick}>
        {slot.ability ? <span className="text-[9px] text-white truncate">{slot.ability}</span> : <Placeholder>— no ability</Placeholder>}
      </Row>
    </div>
  );
}

function EvBox({ slot, onClick }) {
  const { plus, minus } = natureEffect(slot.nature);
  const Container = onClick ? 'button' : 'div';
  return (
    <Container type={onClick ? 'button' : undefined} onClick={onClick}
      className={`shrink-0 flex flex-col py-0.5 text-left ${onClick ? 'hover:bg-white/5 transition-colors' : ''}`}
      style={BOX_STYLE}>
      {STAT_KEYS.map((key, i) => {
        const ev = slot.evs[key] ?? 0;
        const tone = plus === key ? 'text-blue-400' : minus === key ? 'text-red-400' : 'text-gray-400';
        return (
          <Row key={key} divider={i > 0} className="justify-between gap-2">
            <span className={`text-[9px] font-medium leading-none ${tone}`}>
              {STAT_LABELS[key]}{plus === key ? '+' : minus === key ? '−' : ''}
            </span>
            <span className={`text-[9px] font-mono leading-none ${ev > 0 ? 'text-white' : 'text-gray-600'}`}>
              {ev > 0 ? ev : '—'}
            </span>
          </Row>
        );
      })}
    </Container>
  );
}

function MovesBox({ slot, onMoveClick, activeMoveIndex }) {
  return (
    <div className="shrink-0 flex flex-col py-0.5" style={{ ...BOX_STYLE, minWidth: 90 }}>
      {slot.moves.map((move, i) => {
        const active = activeMoveIndex === i;
        return (
          <Row key={i} divider={i > 0} active={active} onClick={onMoveClick && (() => onMoveClick(i))}>
            {move
              ? <span className={`text-[9px] font-medium truncate leading-none ${active ? 'text-indigo-200' : 'text-white'}`}>{move.name}</span>
              : <Placeholder>—</Placeholder>}
          </Row>
        );
      })}
    </div>
  );
}

/**
 * The three-box summary of a filled slot: identity, EV spread, moves.
 * Pass click handlers to make the fields editable (bottom sheet); omit them for a read-only card.
 */
export default function SlotSummary({ slot, onItemClick, onAbilityClick, onStatsClick, onMoveClick, activeMoveIndex = null }) {
  return (
    <div className="flex-1 min-w-0 flex items-stretch gap-1.5">
      <IdentityBox slot={slot} onItemClick={onItemClick} onAbilityClick={onAbilityClick} />
      <EvBox slot={slot} onClick={onStatsClick} />
      <MovesBox slot={slot} onMoveClick={onMoveClick} activeMoveIndex={activeMoveIndex} />
    </div>
  );
}
