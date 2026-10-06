// Axis helpers for the SVG charts.

const NICE_MULTIPLES = [1, 2, 2.5, 5, 10];

/** A round tick step that splits `range` into about `target` intervals (25, 50, 100, …). */
export function niceStep(range, target = 4) {
  if (!(range > 0)) return 1;
  const raw = range / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  return NICE_MULTIPLES.find(m => m * magnitude >= raw) * magnitude;
}

/** { min, max, ticks } covering `values` on round numbers, padded so a flat line isn't on the edge. */
export function niceTicks(values, target = 4) {
  if (!values.length) return { min: 0, max: 1, ticks: [0, 1] };
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) { lo -= 10; hi += 10; }
  const step = niceStep(hi - lo, target);
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let t = min; t <= max + step / 2; t += step) ticks.push(Math.round(t * 1000) / 1000);
  return { min, max, ticks };
}

/** Linear map from [d0, d1] to [r0, r1]. */
export const linear = (d0, d1, r0, r1) => (v) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));
