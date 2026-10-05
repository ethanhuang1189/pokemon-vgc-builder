import TeamSlot from './TeamSlot';
import TeamExport from '../TeamExport';
import WeaknessChart from '../WeaknessChart';
import AnalysisPanel from '../analysis/AnalysisPanel';
import { useTeam } from '../../context/TeamContext';
import { useDragReorder } from '../../hooks/useDragReorder.js';
import { safeSides } from '../../utils/safeArea.js';

const SectionLabel = ({ children }) => (
  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">{children}</h2>
);

function SlotList() {
  const { team, reorderSlot } = useTeam();
  const { itemRef, itemStyle, startDrag } = useDragReorder(team.length, reorderSlot);
  return (
    <div className="space-y-1.5">
      {team.map((_, i) => (
        <div key={i} ref={itemRef(i)} style={itemStyle(i)}>
          <TeamSlot index={i} onDragStart={clientY => startDrag(i, clientY)} />
        </div>
      ))}
    </div>
  );
}

/** Team slots with export and weakness chart; the analysis sits beside them on large screens, below on small. */
export default function TeamBuilder() {
  return (
    <>
      <div className="max-w-3xl mx-auto px-3 py-3 lg:flex lg:gap-4 lg:items-start" style={safeSides('0.75rem')}>
        <div className="flex-1 min-w-0">
          <SlotList />
          <div className="mt-3"><TeamExport /></div>
          <div className="mt-4 bg-gray-800 border border-gray-700 rounded-sm p-3">
            <h3 className="text-xs font-semibold text-gray-300 mb-3 uppercase tracking-wide">Weakness / Resistance Chart</h3>
            <WeaknessChart />
          </div>
        </div>
        <div className="w-72 shrink-0 hidden lg:block">
          <div className="sticky top-4">
            <SectionLabel>Analysis</SectionLabel>
            <AnalysisPanel />
          </div>
        </div>
      </div>
      <div className="lg:hidden max-w-3xl mx-auto pb-8" style={safeSides('0.75rem')}>
        <SectionLabel>Analysis</SectionLabel>
        <AnalysisPanel />
      </div>
    </>
  );
}
