import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { LocalRepository } from '@/lib/storage/localRepository';
import { SupabaseRepository } from '@/lib/storage/supabaseRepository';
import type { Repository } from '@/lib/storage/repository';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';

const LOCAL_ONLY_KEY = 'chesslab:local-only';

/**
 * Chooses where data lives. Without Supabase configured: the browser.
 * With Supabase: the signed-in user's rows (or the browser if they opt out).
 */
export function AuthGate({ children }: { children: (repo: Repository, key: string, signOut?: () => void) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [localOnly, setLocalOnly] = useState(() => {
    try {
      return localStorage.getItem(LOCAL_ONLY_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const repo = useMemo<Repository>(() => {
    const local = new LocalRepository();
    if (supabase && session) return new SupabaseRepository(supabase, session.user.id, { fallback: () => local.load() });
    return local;
  }, [session]);

  if (!ready) return <div className="flex min-h-dvh items-center justify-center text-muted-foreground">Carregant…</div>;
  if (supabase && !session && !localOnly) {
    return (
      <SignIn
        onLocal={() => {
          try {
            localStorage.setItem(LOCAL_ONLY_KEY, '1');
          } catch {
            /* ignore */
          }
          setLocalOnly(true);
        }}
      />
    );
  }
  const signOut = supabase
    ? () => {
        try {
          localStorage.removeItem(LOCAL_ONLY_KEY);
        } catch {
          /* ignore */
        }
        setLocalOnly(false);
        void supabase!.auth.signOut();
      }
    : undefined;
  return <>{children(repo, session?.user.id ?? 'local', signOut)}</>;
}

function SignIn({ onLocal }: { onLocal: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error, data } =
      mode === 'in'
        ? await supabase!.auth.signInWithPassword({ email, password })
        : await supabase!.auth.signUp({ email, password });
    setBusy(false);
    if (error) setMsg({ tone: 'bad', text: error.message });
    else if (mode === 'up' && !data.session) setMsg({ tone: 'ok', text: 'Compte creat. Revisa el correu per confirmar-lo i després entra.' });
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-secondary via-background to-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-10" />
            <div>
              <h1 className="text-xl font-bold">Chess<span className="text-primary">Lab</span></h1>
              <p className="text-sm text-muted-foreground">{mode === 'in' ? 'Entra al teu compte' : 'Crea un compte'}</p>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email">Correu electrònic</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Contrasenya</Label>
              <Input id="password" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {msg && <p role="status" className={msg.tone === 'ok' ? 'text-sm text-success' : 'text-sm text-danger'}>{msg.text}</p>}
            <Button type="submit" className="w-full" disabled={busy}>{mode === 'in' ? 'Entra' : 'Crea el compte'}</Button>
          </form>
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <button type="button" className="cursor-pointer text-primary hover:underline" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
              {mode === 'in' ? 'No tens compte? Crea\'n un' : 'Ja tens compte? Entra'}
            </button>
            <button type="button" className="cursor-pointer text-muted-foreground hover:underline" onClick={onLocal}>
              Continua sense compte
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Sense compte, les dades només es desen en aquest navegador.</p>
        </CardContent>
      </Card>
    </div>
  );
}
