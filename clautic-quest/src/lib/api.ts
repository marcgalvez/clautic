import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

const FRIENDLY: Record<string, string> = {
  'Invalid login credentials': 'Usuari o contrasenya incorrectes.',
  'User already registered': 'Aquest usuari ja existeix. Prova un altre nom.',
  'Failed to fetch': 'No hi ha connexió amb el servidor.',
};

export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  for (const k of Object.keys(FRIENDLY)) if (msg.includes(k)) return FRIENDLY[k];
  return msg.replace(/^Database error saving new user: /, '').replace(/^ERROR:\s*/, '');
}

/** Totes les dades passen per funcions del servidor que comproven el rol. */
export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(friendlyError(error));
  return data as T;
}

export function useRpc<T>(fn: string | null, args: Record<string, unknown> = {}, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!fn);
  const argsRef = useRef(args);
  argsRef.current = args;
  const seq = useRef(0);

  const reload = useCallback(async (silent = false) => {
    if (!fn) return;
    const id = ++seq.current;
    if (!silent) setLoading(true);
    try {
      const d = await rpc<T>(fn, argsRef.current);
      if (id === seq.current) { setData(d); setError(null); }
    } catch (e) {
      if (id === seq.current) setError(friendlyError(e));
    } finally {
      if (id === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, ...deps]);

  useEffect(() => { reload(); }, [reload]);
  return { data, setData, error, loading, reload };
}

export const uuid = () =>
  (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
