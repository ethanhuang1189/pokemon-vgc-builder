import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabase.js';

// The signed-in session. `session` is undefined while loading and null when signed out.
// `recovering` is set when the user arrives from a password-reset email.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(supabase ? undefined : null);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({
    configured: Boolean(supabase),
    session,
    user: session?.user ?? null,
    recovering,
    finishRecovery: () => setRecovering(false),
  }), [session, recovering]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
