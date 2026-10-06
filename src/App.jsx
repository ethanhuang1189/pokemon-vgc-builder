import { Dex } from '@pkmn/dex';
import { FormatProvider } from './context/FormatContext';
import { TeamProvider } from './context/TeamContext';
import { PickerProvider } from './context/PickerContext';
import { AuthProvider } from './context/AuthContext';
import { Header, Footer } from './components/layout/Layout';
import { TABS } from './components/layout/tabs.js';
import TeamBuilder from './components/team/TeamBuilder';
import BattlesTab from './components/battles/BattlesTab';
import BottomSheet from './components/sheet/BottomSheet';
import { useHashTab } from './hooks/useHashTab.js';
import { buildFormat } from './domain/format.js';
import { CURRENT_REGULATION } from './regulations/index.js';

// Resolved once at startup; switching regulations is a one-line change in regulations/index.js.
const format = buildFormat(CURRENT_REGULATION, Dex);
const TAB_IDS = TABS.map(t => t.id);

export default function App() {
  const [tab, selectTab] = useHashTab(TAB_IDS);
  return (
    <FormatProvider format={format} Dex={Dex}>
      <AuthProvider>
        <TeamProvider>
          <PickerProvider>
            <div className="min-h-screen bg-gray-900 flex flex-col">
              <Header tab={tab} onSelectTab={selectTab} />
              <main className="flex-1">{tab === 'battles' ? <BattlesTab /> : <TeamBuilder />}</main>
              <Footer />
            </div>
            <BottomSheet />
          </PickerProvider>
        </TeamProvider>
      </AuthProvider>
    </FormatProvider>
  );
}
