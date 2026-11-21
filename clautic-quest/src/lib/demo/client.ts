// Client compatible amb la part de supabase-js que fa servir l'app, però contra la BD del navegador.
import type { Session } from '@supabase/supabase-js';

type Listener = (event: string, s: Session | null) => void;
const KEY = 'clautic-quest-demo-session';
const backend = () => import('./backend');

function makeSession(u: { id: string; email: string; meta?: Record<string, unknown> }): Session {
  return {
    access_token: `demo-${u.id}`, refresh_token: 'demo', token_type: 'bearer', expires_in: 3600 * 24 * 365,
    expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
    user: { id: u.id, email: u.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: u.meta ?? {}, created_at: new Date().toISOString() },
  } as Session;
}
const load = (): Session | null => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
const save = (s: Session | null) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* sense emmagatzematge */ } };

export function createDemoClient() {
  const listeners = new Set<Listener>();
  const emit = (e: string, s: Session | null) => listeners.forEach((l) => l(e, s));
  const err = (e: unknown) => ({ message: (e as Error).message ?? String(e) });
  return {
    auth: {
      async getSession() { return { data: { session: load() }, error: null }; },
      onAuthStateChange(cb: Listener) { listeners.add(cb); return { data: { subscription: { unsubscribe: () => { listeners.delete(cb); } } } }; },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        try {
          const u = await (await backend()).demoLogin(email, password);
          if (!u) return { data: { session: null }, error: { message: 'Invalid login credentials' } };
          const s = makeSession(u); save(s); emit('SIGNED_IN', s);
          return { data: { session: s }, error: null };
        } catch (e) { return { data: { session: null }, error: err(e) }; }
      },
      async signUp({ email, password, options }: { email: string; password: string; options?: { data?: Record<string, unknown> } }) {
        try {
          const u = await (await backend()).demoSignUp(email, password, options?.data ?? {});
          const s = makeSession(u); save(s); emit('SIGNED_IN', s);
          return { data: { session: s, user: s.user }, error: null };
        } catch (e) { return { data: { session: null, user: null }, error: err(e) }; }
      },
      async signOut() { save(null); emit('SIGNED_OUT', null); return { error: null }; },
    },
    async rpc(fn: string, args: Record<string, unknown> = {}) {
      try {
        const data = await (await backend()).demoRpc(fn, args, load()?.user.id ?? null);
        return { data, error: null };
      } catch (e) { return { data: null, error: err(e) }; }
    },
  };
}
