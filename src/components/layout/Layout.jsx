import { useTeam } from '../../context/TeamContext';
import { useFormat } from '../../context/FormatContext';
import { safeSides } from '../../utils/safeArea.js';

function ClearTeamButton() {
  const { clearTeam } = useTeam();
  return (
    <button onClick={() => { if (confirm('Clear all 6 slots?')) clearTeam(); }}
      className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700 transition-colors shrink-0">
      Clear
    </button>
  );
}

export function Header() {
  const { format } = useFormat();
  return (
    <header className="bg-gray-900 border-b border-gray-700"
      style={{ ...safeSides('1rem'), paddingTop: 'max(0.75rem, env(safe-area-inset-top))', paddingBottom: '0.75rem' }}>
      <div className="max-w-3xl mx-auto flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <span className="text-base font-bold text-white">Pokémon Champions</span>
          <span className="text-xs text-gray-500 ml-2 hidden sm:inline">{format.regulation.label}</span>
        </div>
        <ClearTeamButton />
      </div>
    </header>
  );
}

const CREDITS = [
  { text: 'Pokémon sprites from the', name: 'Project Pokémon Sprite Index', href: 'https://projectpokemon.org/home/docs/spriteindex_148/' },
  { text: ', with fallbacks from', name: 'Pokémon Showdown', href: 'https://play.pokemonshowdown.com/sprites/' },
  { text: '. Item sprites from', name: 'pokesprite', href: 'https://github.com/msikma/pokesprite' },
  { text: 'by msikma and', name: 'Serebii', href: 'https://www.serebii.net/' },
  { text: '. Pokémon data provided by', name: '@pkmn/dex', href: 'https://github.com/pkmn/ps' },
];

export function Footer() {
  return (
    <footer className="border-t border-gray-800 mt-8 pb-8" style={safeSides('1rem')}>
      <div className="max-w-3xl mx-auto pt-6 space-y-3">
        <p className="text-xs text-gray-400 leading-relaxed">
          <span className="text-white font-semibold">Pokémon Champions Team Builder</span>
          {' '}— a fan-made tool for building and sharing competitive VGC teams in the Pokémon Champions format.
          Select your Pokémon, configure natures, EVs, items, abilities, and moves, then export directly to Pokémon Showdown or PokéPaste.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed">
          {CREDITS.map(({ text, name, href }) => (
            <span key={name}>
              {text}{' '}
              <a href={href} target="_blank" rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">{name}</a>
            </span>
          ))}
          . Pokémon and all related names are trademarks of Nintendo / Game Freak.
          This is a fan project and is not affiliated with or endorsed by Nintendo, Game Freak, or The Pokémon Company.
        </p>
      </div>
    </footer>
  );
}
