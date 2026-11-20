import { supabase } from '@/lib/supabase';
import type { CoachRequest, CoachResponse } from '../../../supabase/functions/_shared/coach-core.ts';
import { sanToCatalan } from '../../../supabase/functions/_shared/coach-core.ts';

/** Where the coach lives: explicit URL, the Supabase Edge Function, or the local dev server. */
export function coachEndpoint(): string {
  const explicit = import.meta.env.VITE_COACH_URL as string | undefined;
  if (explicit) return explicit;
  const sb = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (sb) return `${sb.replace(/\/$/, '')}/functions/v1/coach`;
  return '/api/coach';
}

async function headers(): Promise<Record<string, string>> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session) h.Authorization = `Bearer ${data.session.access_token}`;
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (anon) h.apikey = anon;
  }
  return h;
}

export type CoachStatus = { available: boolean; model?: string; reason?: string };
let statusPromise: Promise<CoachStatus> | null = null;

/** Health check (cached). The coach is optional: the app works without it. */
export function getCoachStatus(): Promise<CoachStatus> {
  if (!statusPromise) {
    statusPromise = (async () => {
      try {
        const res = await fetch(coachEndpoint(), { headers: await headers() });
        if (!res.ok) return { available: false, reason: `El servei de l'entrenador no respon (${res.status}).` };
        const body = (await res.json()) as { ok?: boolean; model?: string };
        return body.ok ? { available: true, model: body.model } : { available: false, reason: 'L\'entrenador IA no té cap clau d\'API configurada.' };
      } catch {
        return { available: false, reason: 'L\'entrenador IA no està disponible (servei no configurat o sense connexió).' };
      }
    })();
  }
  return statusPromise;
}

export class CoachError extends Error {}

/** Sends a request; the answer is grounded server-side and translated to Catalan notation here. */
export async function askCoach(req: CoachRequest, signal?: AbortSignal): Promise<CoachResponse> {
  let res: Response;
  try {
    res = await fetch(coachEndpoint(), { method: 'POST', headers: await headers(), body: JSON.stringify(req), signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new CoachError('No s\'ha pogut contactar amb l\'entrenador. Comprova la connexió.');
  }
  const body = (await res.json().catch(() => ({}))) as Partial<CoachResponse> & { error?: string };
  if (!res.ok) throw new CoachError(body.error ?? `Error de l'entrenador (${res.status}).`);
  return { text: sanToCatalan(body.text ?? ''), flagged: body.flagged ?? [], model: body.model };
}
