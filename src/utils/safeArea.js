// Side padding that respects iOS safe areas (notches, rounded corners).
export const safeSides = (min) => ({
  paddingLeft: `max(${min}, env(safe-area-inset-left))`,
  paddingRight: `max(${min}, env(safe-area-inset-right))`,
});
