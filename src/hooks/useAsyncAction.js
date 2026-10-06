import { useCallback, useState } from 'react';

/**
 * Runs async actions with a pending flag and a result notice ({ tone, text }) for <Notice>.
 * `run(action, successText)` resolves to the action's result, or undefined if it failed.
 */
export function useAsyncAction() {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState(null);

  const run = useCallback(async (action, successText = '') => {
    setPending(true);
    setNotice(null);
    try {
      const result = await action();
      const text = typeof successText === 'function' ? successText(result) : successText;
      if (text) setNotice({ tone: 'success', text });
      return result;
    } catch (err) {
      setNotice({ tone: 'error', text: err?.message || 'Something went wrong' });
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);

  return { pending, notice, setNotice, run };
}
