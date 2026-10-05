// Pokémon Champions stat rules: level 50, "stat points" instead of EVs, +15 to every base stat.
export const CHAMPIONS = Object.freeze({
  LEVEL: 50,
  BASE_STAT_BUFF: 15,
  MAX_EV: 32,
  MAX_TOTAL_EV: 66,
});

export const STAT_KEYS = Object.freeze(['hp', 'atk', 'def', 'spa', 'spd', 'spe']);

export const STAT_LABELS = Object.freeze({ hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' });

export const NATURES = Object.freeze({
  Hardy: {}, Lonely: { plus: 'atk', minus: 'def' }, Brave: { plus: 'atk', minus: 'spe' },
  Adamant: { plus: 'atk', minus: 'spa' }, Naughty: { plus: 'atk', minus: 'spd' },
  Bold: { plus: 'def', minus: 'atk' }, Docile: {}, Relaxed: { plus: 'def', minus: 'spe' },
  Impish: { plus: 'def', minus: 'spa' }, Lax: { plus: 'def', minus: 'spd' },
  Timid: { plus: 'spe', minus: 'atk' }, Hasty: { plus: 'spe', minus: 'def' },
  Serious: {}, Jolly: { plus: 'spe', minus: 'spa' }, Naive: { plus: 'spe', minus: 'spd' },
  Modest: { plus: 'spa', minus: 'atk' }, Mild: { plus: 'spa', minus: 'def' },
  Quiet: { plus: 'spa', minus: 'spe' }, Bashful: {}, Rash: { plus: 'spa', minus: 'spd' },
  Calm: { plus: 'spd', minus: 'atk' }, Gentle: { plus: 'spd', minus: 'def' },
  Sassy: { plus: 'spd', minus: 'spe' }, Careful: { plus: 'spd', minus: 'spa' }, Quirky: {},
});

export const DEFAULT_NATURE = 'Hardy';

export const isNature = (name) => Object.hasOwn(NATURES, name ?? '');

export const natureEffect = (name) => NATURES[name] ?? {};

/** The nature that raises `plus` and lowers `minus`; neutral (Hardy) when either is missing. */
export function findNature(plus, minus) {
  if (!plus || !minus || plus === minus) return DEFAULT_NATURE;
  return Object.keys(NATURES).find(n => NATURES[n].plus === plus && NATURES[n].minus === minus)
    ?? DEFAULT_NATURE;
}

export const emptyEvs = () => Object.fromEntries(STAT_KEYS.map(k => [k, 0]));

const toEv = (value) => Math.max(0, Math.trunc(Number(value)) || 0);

export const totalEvs = (evs) => STAT_KEYS.reduce((sum, k) => sum + toEv(evs?.[k]), 0);

/** Sets one stat's EVs, clamped to the per-stat cap and whatever the total budget has left. */
export function setEv(evs, key, value) {
  if (!STAT_KEYS.includes(key)) return evs;
  const current = toEv(evs[key]);
  const available = CHAMPIONS.MAX_TOTAL_EV - totalEvs(evs) + current;
  const next = Math.min(toEv(value), CHAMPIONS.MAX_EV, Math.max(0, available));
  return { ...evs, [key]: next };
}

/** Coerces arbitrary input (saved data, imports) into a legal EV spread, filling stats in order. */
export function sanitizeEvs(raw) {
  return STAT_KEYS.reduce((evs, k) => setEv(evs, k, raw?.[k]), emptyEvs());
}

/** Final level-50 stat. `plus`/`minus` are passed separately so a half-chosen nature can be previewed. */
export function calcStat(key, base, ev, plus = null, minus = null) {
  if (!base) return 0;
  const buffed = base + CHAMPIONS.BASE_STAT_BUFF;
  const inner = Math.floor((2 * buffed * CHAMPIONS.LEVEL) / 100);
  if (key === 'hp') return inner + CHAMPIONS.LEVEL + 10 + toEv(ev);
  const natureMult = plus === key ? 1.1 : minus === key ? 0.9 : 1;
  return Math.floor((inner + 5 + toEv(ev)) * natureMult);
}

/**
 * Moves one stat's nature marker: position 'plus', 'minus' or null (neutral).
 * Returns the pending { plus, minus } and the nature to commit — null while only one side is chosen.
 */
export function applyNatureChoice({ plus, minus }, key, position) {
  let nextPlus = plus ?? null;
  let nextMinus = minus ?? null;
  if (position === 'plus') {
    nextPlus = key;
    if (nextMinus === key) nextMinus = null;
  } else if (position === 'minus') {
    nextMinus = key;
    if (nextPlus === key) nextPlus = null;
  } else {
    if (nextPlus === key) nextPlus = null;
    if (nextMinus === key) nextMinus = null;
  }
  const complete = (nextPlus === null) === (nextMinus === null);
  return { plus: nextPlus, minus: nextMinus, nature: complete ? findNature(nextPlus, nextMinus) : null };
}
