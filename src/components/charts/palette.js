// Chart colors for the dark UI. The series order is the dataviz reference palette's dark steps,
// validated (CVD separation, normal-vision floor, contrast) against the card surface #1f2937.
// Slot 6 (green) is under 3:1 contrast, so every chart pairs color with visible labels.
export const SERIES_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
export const OTHER_COLOR = '#6b7280';

export const CHART = {
  surface: '#1f2937', // tailwind gray-800, the card background
  grid: '#374151',
  muted: '#9ca3af',
  text: '#e5e7eb',
};
