import { Dex } from '@pkmn/dex';
import { FormatProvider } from './context/FormatContext';
import { TeamProvider } from './context/TeamContext';
import { PickerProvider } from './context/PickerContext';
import { Header, Footer } from './components/layout/Layout';
import TeamBuilder from './components/team/TeamBuilder';
import BottomSheet from './components/sheet/BottomSheet';
import { buildFormat } from './domain/format.js';
import { CURRENT_REGULATION } from './regulations/index.js';

// Resolved once at startup; switching regulations is a one-line change in regulations/index.js.
const format = buildFormat(CURRENT_REGULATION, Dex);

export default function App() {
  return (
    <FormatProvider format={format} Dex={Dex}>
      <TeamProvider>
        <PickerProvider>
          <div className="min-h-screen bg-gray-900 flex flex-col">
            <Header />
            <div className="flex-1"><TeamBuilder /></div>
            <Footer />
          </div>
          <BottomSheet />
        </PickerProvider>
      </TeamProvider>
    </FormatProvider>
  );
}
