import legalMonsRaw from '../../legal_mons.txt?raw';
import legalItemsRaw from '../../legal_items.txt?raw';
import legalMovesRaw from '../../legal_moves.txt?raw';

// Normalize names for fuzzy matching (handles "Kommo-o" vs "Kommo O", "Mr. Rime" vs "Mr Rime", etc.)
export const normalize = (name) =>
  name.toLowerCase().replace(/[-.']/g, '').replace(/\s+/g, ' ').trim();

function parseNames(raw) {
  return raw
    .split('\n')
    .flatMap(line => line.split('\t'))
    .map(s => s.trim())
    .filter(Boolean);
}

export const LEGAL_MON_NAMES = new Set(parseNames(legalMonsRaw).map(normalize));
export const LEGAL_ITEM_NAMES = new Set(parseNames(legalItemsRaw).map(normalize));
export const LEGAL_MOVE_NAMES = new Set(parseNames(legalMovesRaw).map(normalize));
