import TeamSlot from './TeamSlot';
import TeamExport from '../TeamExport';
import WeaknessChart from '../WeaknessChart';
import { OffenseSections, DefenseSections } from '../analysis/AnalysisPanel';
import { useTeamAnalysis } from '../../hooks/useTeamAnalysis.js';
import { useTeam } from '../../context/TeamContext';
import { useDragReorder } from '../../hooks/useDragReorder.js';
import { safeSides } from '../../utils/safeArea.js';
import { PAGE_WIDTH, PAGE_COLUMNS } from '../layout/tabs.js';

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

/**
 * Team slots, export and weakness chart, then the analysis. Large screens split the analysis
 * across both columns (defense under the weakness chart, offense and meta beside it) so they
 * end at a similar height; small screens stack it all below.
 */
export default function TeamBuilder() {
  const analysis = useTeamAnalysis();
  return (
    <>
      <div className={`${PAGE_WIDTH} mx-auto py-3 ${PAGE_COLUMNS}`} style={safeSides('0.75rem')}>
        <div className="min-w-0">
          <SlotList />
          <div className="mt-3"><TeamExport /></div>
          <div className="mt-4 bg-gray-800 border border-gray-700 rounded-sm p-3">
            <h3 className="text-xs font-semibold text-gray-300 mb-3 uppercase tracking-wide">Weakness / Resistance Chart</h3>
            <WeaknessChart />
          </div>
          <div className="hidden lg:block mt-4"><DefenseSections analysis={analysis} /></div>
        </div>
        <div className="hidden lg:block">
          <SectionLabel>Analysis</SectionLabel>
          <OffenseSections analysis={analysis} />
        </div>
      </div>
      <div className={`lg:hidden ${PAGE_WIDTH} mx-auto pb-8 space-y-5`} style={safeSides('0.75rem')}>
        <div>
          <SectionLabel>Analysis</SectionLabel>
          <OffenseSections analysis={analysis} />
        </div>
        <DefenseSections analysis={analysis} />
      </div>
    </>
  );
}
