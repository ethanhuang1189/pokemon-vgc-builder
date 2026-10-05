// Display strings for move stats.
export const formatAccuracy = (acc) => (acc === true || !acc ? '—' : `${acc}%`);

export const formatPower = (move) => (move.category === 'Status' || !move.basePower ? '—' : move.basePower);
