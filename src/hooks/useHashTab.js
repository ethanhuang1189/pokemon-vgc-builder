import { useCallback, useEffect, useState } from 'react';

const IMPORT_PARAM = 'import';

// Arriving from the bookmarklet (?import=…) means the Battles tab.
const currentTab = (tabs) => {
  const fromHash = window.location.hash.slice(1);
  if (tabs.includes(fromHash)) return fromHash;
  return new URLSearchParams(window.location.search).has(IMPORT_PARAM) ? 'battles' : tabs[0];
};

/** The active top-level tab, kept in the URL hash so reloads and links keep it. */
export function useHashTab(tabs) {
  const [tab, setTab] = useState(() => currentTab(tabs));

  useEffect(() => {
    const onHashChange = () => setTab(currentTab(tabs));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [tabs]);

  const selectTab = useCallback((next) => { window.location.hash = next; }, []);
  return [tab, selectTab];
}

/** Takes the replay passed by the bookmarklet (?import=…) once, removing it from the URL. */
export function takeImportParam() {
  const url = new URL(window.location.href);
  const value = url.searchParams.get(IMPORT_PARAM);
  if (value === null) return null;
  url.searchParams.delete(IMPORT_PARAM);
  url.hash = 'battles';
  window.history.replaceState(null, '', url);
  return value;
}
