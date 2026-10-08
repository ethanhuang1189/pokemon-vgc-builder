// Every page (header, tabs, footer, each tab's content) shares this width so switching tabs
// doesn't move anything: one column on small screens, wider with a side column on large ones.
export const PAGE_WIDTH = 'max-w-3xl lg:max-w-5xl';
// The main column and side column on large screens, used by both tabs.
export const PAGE_COLUMNS = 'lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-4 lg:items-start';

// Top-level sections, in display order. The first is the default.
export const TABS = Object.freeze([
  { id: 'team', label: 'Team' },
  { id: 'battles', label: 'Battles' },
]);
