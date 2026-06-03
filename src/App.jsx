import { useState, useRef, useCallback } from 'react';
import { Dex } from '@pkmn/dex';
import { TeamProvider, useTeam } from './context/TeamContext';
import TeamSlot from './components/TeamSlot';
import AnalysisPanel from './components/AnalysisPanel';
import TeamExport from './components/TeamExport';
import { REGULATION } from './data/regulations';
import { LEGAL_MON_NAMES, LEGAL_ITEM_NAMES, LEGAL_MOVE_NAMES, normalize } from './data/legalLists';
import { buildMegaForms, MEGA_STONE_NAMES } from './data/megaForms';
import { exportToShowdown } from './utils/showdown';

// Pre-compute all data once at module level (synchronous, bundled)
const allMegas = buildMegaForms(Dex);

const allSpecies = [...Dex.species.all()]
  .filter(s => {
    if (!s.exists || s.isNonstandard || s.battleOnly) return false;
    return LEGAL_MON_NAMES.has(normalize(s.name)) || LEGAL_MON_NAMES.has(normalize(s.baseSpecies));
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const allMoves = [...Dex.moves.all()]
  .filter(m => m.exists && LEGAL_MOVE_NAMES.has(normalize(m.name)))
  .sort((a, b) => a.name.localeCompare(b.name));

// Mega stones are handled via the Mega button, not the item dropdown
const allItems = [...Dex.items.all()]
  .filter(i => i.exists && LEGAL_ITEM_NAMES.has(normalize(i.name)) && !MEGA_STONE_NAMES.has(i.name))
  .sort((a, b) => a.name.localeCompare(b.name));

const allAbilities = [...Dex.abilities.all()]
  .filter(a => a.exists && !a.isNonstandard)
  .sort((a, b) => a.name.localeCompare(b.name));

function Header() {
  const { clearTeam } = useTeam();

  return (
    <header
      className="bg-gray-900 border-b border-gray-700"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
        paddingBottom: '0.75rem',
      }}
    >
      <div className="max-w-3xl mx-auto flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <span className="text-base font-bold text-white">Pokemon Champions</span>
          <span className="text-xs text-gray-500 ml-2 hidden sm:inline">{REGULATION.label}</span>
        </div>

        <button
          onClick={() => { if (confirm('Clear all 6 slots?')) clearTeam(); }}
          className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700 transition-colors shrink-0"
        >
          Clear
        </button>
      </div>
    </header>
  );
}

function TeamBuilder() {
  const { reorderSlot } = useTeam();
  // drag = { fromIdx, toIdx, deltaY, heights, tops }
  const [drag, setDrag] = useState(null);
  // Suppressed for one frame on commit so slots don't animate back before reorder paints
  const [suppressTransition, setSuppressTransition] = useState(false);
  const slotRefs = useRef({});

  // Find the slot index whose center is nearest the dragged slot's current center
  function computeToIdx(fromIdx, deltaY, tops, heights) {
    const dragCenterY = tops[fromIdx] + heights[fromIdx] / 2 + deltaY;
    let best = fromIdx;
    let bestDist = Infinity;
    for (let i = 0; i < 6; i++) {
      const dist = Math.abs(dragCenterY - (tops[i] + heights[i] / 2));
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    return best;
  }

  const onMoveHandlePointerDown = useCallback((fromIdx, e) => {
    e.preventDefault();
    // Snapshot natural slot positions before any transforms
    const tops = {}, heights = {};
    for (let i = 0; i < 6; i++) {
      const el = slotRefs.current[i];
      if (el) {
        const r = el.getBoundingClientRect();
        tops[i] = r.top;
        heights[i] = r.height;
      }
    }
    const startY = e.clientY;
    setDrag({ fromIdx, toIdx: fromIdx, deltaY: 0, tops, heights });

    function onMove(ev) {
      const deltaY = ev.clientY - startY;
      const toIdx = computeToIdx(fromIdx, deltaY, tops, heights);
      setDrag(d => d ? { ...d, deltaY, toIdx } : null);
    }
    function onUp(ev) {
      const deltaY = ev.clientY - startY;
      const toIdx = computeToIdx(fromIdx, deltaY, tops, heights);
      if (toIdx !== fromIdx) reorderSlot(fromIdx, toIdx);
      // Suppress transitions for this commit frame so slots land instantly
      // at their post-reorder natural positions with no backward slide
      setSuppressTransition(true);
      setDrag(null);
      requestAnimationFrame(() => setSuppressTransition(false));
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [reorderSlot]); // eslint-disable-line react-hooks/exhaustive-deps

  function slotTransform(i) {
    if (!drag) return 'none';
    const { fromIdx, toIdx, deltaY, heights } = drag;
    if (i === fromIdx) return `translateY(${deltaY}px)`;
    const h = heights[fromIdx] ?? 60;
    if (toIdx > fromIdx && i > fromIdx && i <= toIdx) return `translateY(${-h}px)`;
    if (toIdx < fromIdx && i < fromIdx && i >= toIdx) return `translateY(${h}px)`;
    return 'none';
  }

  return (
    <div
      className="max-w-3xl mx-auto px-3 py-3 lg:flex lg:gap-4 lg:items-start"
      style={{
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
      }}
    >
      {/* Team slots */}
      <div className="flex-1 min-w-0">
        <div className="space-y-1.5">
          {Array.from({ length: 6 }, (_, i) => {
            const isDragging = drag?.fromIdx === i;
            return (
              <div
                key={i}
                ref={el => { slotRefs.current[i] = el; }}
                style={{
                  transform: slotTransform(i),
                  zIndex: isDragging ? 20 : 'auto',
                  opacity: isDragging ? 0.85 : 1,
                  position: 'relative',
                  transition: (isDragging || suppressTransition) ? 'none' : 'transform 0.18s ease',
                  boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.5)' : 'none',
                }}
              >
                <TeamSlot
                  index={i}
                  allSpecies={allSpecies}
                  allMoves={allMoves}
                  allItems={allItems}
                  allAbilities={allAbilities}
                  allMegas={allMegas}
                  onMoveHandlePointerDown={e => onMoveHandlePointerDown(i, e)}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-3">
          <TeamExport />
        </div>
      </div>

      {/* Analysis — sidebar on lg+, hidden on mobile (shown below) */}
      <div className="w-72 shrink-0 hidden lg:block">
        <div className="sticky top-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Analysis</h2>
          <AnalysisPanel />
        </div>
      </div>
    </div>
  );
}

function MobileAnalysis() {
  return (
    <div
      className="lg:hidden max-w-3xl mx-auto pb-8"
      style={{
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
      }}
    >
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Analysis</h2>
      <AnalysisPanel />
    </div>
  );
}

function Footer() {
  return (
    <footer
      className="border-t border-gray-800 mt-8 pb-8"
      style={{
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <div className="max-w-3xl mx-auto pt-6 space-y-3">
        <p className="text-xs text-gray-400 leading-relaxed">
          <span className="text-white font-semibold">Pokémon Champions Team Builder</span>
          {' '}— a fan-made tool for building and sharing competitive VGC teams in the Pokémon Champions format.
          Select your Pokémon, configure natures, EVs, items, abilities, and moves, then export directly to Pokémon Showdown or PokéPaste.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed">
          Animated Pokémon sprites courtesy of{' '}
          <a
            href="https://projectpokemon.org/home/docs/spriteindex_148/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
          >
            Project Pokémon Sprite Index
          </a>
          . Item sprites courtesy of{' '}
          <a
            href="https://github.com/msikma/pokesprite"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
          >
            pokesprite
          </a>
          {' '}by msikma. Mega Pokémon artwork from{' '}
          <a
            href="https://bulbapedia.bulbagarden.net/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
          >
            Bulbapedia
          </a>
          . Pokémon data provided by{' '}
          <a
            href="https://github.com/pkmn/ps"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
          >
            @pkmn/dex
          </a>
          . Pokémon and all related names are trademarks of Nintendo / Game Freak.
          This is a fan project and is not affiliated with or endorsed by Nintendo, Game Freak, or The Pokémon Company.
        </p>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <TeamProvider Dex={Dex}>
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <Header />
        <div className="flex-1">
          <TeamBuilder />
          <MobileAnalysis />
        </div>
        <Footer />
      </div>
    </TeamProvider>
  );
}
