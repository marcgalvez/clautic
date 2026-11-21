import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, toLoginEmail } from './supabase';
import { friendlyError, rpc } from './api';
import type { MyContext, Role } from './types';

interface SessionCtx {
  session: Session | null;
  ctx: MyContext | null;
  loading: boolean;
  error: string | null;
  signIn: (user: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  hasRole: (r: Role) => boolean;
}
const C = createContext<SessionCtx>(null as unknown as SessionCtx);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ctx, setCtx] = useState<MyContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCtx = useCallback(async (s: Session | null) => {
    if (!s) { setCtx(null); setLoading(false); return; }
    try {
      setCtx(await rpc<MyContext>('get_my_context'));
      setError(null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); loadCtx(data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        setTimeout(() => loadCtx(s), 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadCtx]);

  const value: SessionCtx = {
    session, ctx, loading, error,
    async signIn(user, password) {
      const { error } = await supabase.auth.signInWithPassword({ email: toLoginEmail(user), password });
      if (error) throw new Error(friendlyError(error));
    },
    async signOut() { await supabase.auth.signOut(); setCtx(null); },
    refresh: () => loadCtx(session),
    hasRole: (r) => !!ctx?.roles.includes(r),
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
export const useSession = () => useContext(C);
