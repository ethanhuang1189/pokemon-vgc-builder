import { useCallback, useEffect, useState } from 'react';

/** Loads a list with `load()` on mount; `reload()` refreshes it. */
export function useRemoteList(load) {
  const [state, setState] = useState({ items: [], loading: true, error: '' });

  const fetchItems = useCallback(async () => {
    try {
      return { items: await load(), loading: false, error: '' };
    } catch (err) {
      return { items: [], loading: false, error: err?.message || 'Could not load' };
    }
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    fetchItems().then(next => { if (!cancelled) setState(next); });
    return () => { cancelled = true; };
  }, [fetchItems]);

  const reload = useCallback(() => fetchItems().then(setState), [fetchItems]);
  return { ...state, reload };
}
