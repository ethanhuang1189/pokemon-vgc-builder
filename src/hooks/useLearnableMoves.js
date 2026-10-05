import { useEffect, useState } from 'react';
import { useFormat } from '../context/FormatContext';

/** Moves `species` can learn in the current format (all format moves while loading or with no species). */
export function useLearnableMoves(species) {
  const { format, learnsets } = useFormat();
  const [result, setResult] = useState({ speciesId: null, moves: format.moves });

  useEffect(() => {
    if (!species) return;
    let cancelled = false;
    learnsets.learnableMoves(species).then(moves => {
      if (!cancelled) setResult({ speciesId: species.id, moves });
    });
    return () => { cancelled = true; };
  }, [species, learnsets]);

  // Never show a previous species' moves while the new learnset loads.
  return species && result.speciesId === species.id ? result.moves : format.moves;
}
