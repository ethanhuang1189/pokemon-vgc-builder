import { useCallback, useEffect, useState } from 'react';
import { fetchMetaStats, clearMetaCache } from '../utils/metaStats.js';

const LOADING = { stats: null, loading: true, error: '' };

async function loadState() {
  try {
    const stats = await fetchMetaStats();
    return { stats, loading: false, error: stats ? '' : 'Could not load usage data — check connection' };
  } catch {
    return { stats: null, loading: false, error: 'Failed to load usage data' };
  }
}

/** Usage stats ({ data, label }) with loading/error state and a cache-busting refresh. */
export function useMetaStats() {
  const [state, setState] = useState(LOADING);

  useEffect(() => {
    let cancelled = false;
    loadState().then(next => { if (!cancelled) setState(next); });
    return () => { cancelled = true; };
  }, []);

  const refresh = useCallback(() => {
    clearMetaCache();
    setState(LOADING);
    loadState().then(setState);
  }, []);

  return { ...state, refresh };
}
