import { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Send, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { askCoach, CoachError, getCoachStatus, type CoachStatus } from '@/lib/coach/client';
import type { CoachFacts, CoachMode } from '../../../supabase/functions/_shared/coach-core.ts';
import type { CoachConversation, CoachMessage } from '@/lib/coach/types';
import { useData } from '@/state/DataProvider';
import { uid, cn } from '@/lib/utils';

export interface CoachAction {
  label: string;
  mode: CoachMode;
  hintLevel?: 1 | 2 | 3;
  /** Text sent with the request (e.g. the student's reasoning). */
  text?: string;
  /** Shown as the student's message in the conversation. */
  display?: string;
}

/**
 * Conversation with the AI coach. Facts are computed on demand by the caller
 * (chess.js + Stockfish); the server checks every move the coach writes.
 */
export function CoachBox({
  context,
  getFacts,
  actions,
  allowQuestions = true,
  onAction,
  title = 'Entrenador',
  placeholder = 'Pregunta a l\'entrenador…',
}: {
  context: CoachConversation['context'];
  getFacts: () => Promise<CoachFacts>;
  actions: CoachAction[];
  allowQuestions?: boolean;
  onAction?: (a: CoachAction) => void;
  title?: string;
  placeholder?: string;
}) {
  const { upsertConversation } = useData();
  const [status, setStatus] = useState<CoachStatus | null>(null);
  const [conv, setConv] = useState<CoachConversation>(() => ({ id: uid('coach'), context, createdAt: new Date().toISOString(), messages: [] }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    getCoachStatus().then((s) => alive && setStatus(s));
    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, []);

  if (!status) return null;
  if (!status.available) {
    return (
      <p className="flex items-start gap-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
        <Bot className="mt-0.5 size-4 shrink-0" />
        <span>{status.reason} Les pistes de l'exercici continuen disponibles.</span>
      </p>
    );
  }

  const send = async (mode: CoachMode, opts: { text?: string; display?: string; hintLevel?: 1 | 2 | 3 }) => {
    setBusy(true);
    setError(null);
    const userMsg: CoachMessage | null = opts.display ? { role: 'user', content: opts.display, createdAt: new Date().toISOString() } : null;
    const base = { ...conv, messages: userMsg ? [...conv.messages, userMsg] : conv.messages };
    setConv(base);
    abortRef.current = new AbortController();
    try {
      const facts = await getFacts();
      const history = conv.messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await askCoach({ mode, facts, hintLevel: opts.hintLevel, text: opts.text, history }, abortRef.current.signal);
      const next: CoachConversation = {
        ...base,
        messages: [...base.messages, { role: 'assistant', content: res.text, createdAt: new Date().toISOString(), ...(res.flagged.length ? { flagged: res.flagged } : {}) }],
      };
      setConv(next);
      upsertConversation(next);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(e instanceof CoachError ? e.message : 'L\'entrenador no ha pogut respondre.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-2 rounded-lg border border-primary/25 bg-secondary/40 p-3" aria-label={title}>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-secondary-foreground">
        <Bot className="size-4" /> {title}
      </p>
      {conv.messages.length > 0 && (
        <ol className="max-h-72 space-y-2 overflow-y-auto" aria-live="polite">
          {conv.messages.map((m, i) => (
            <li key={i} className={cn('rounded-md p-2.5 text-sm', m.role === 'assistant' ? 'bg-card' : 'ml-6 bg-primary/10')}>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.flagged && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <ShieldCheck className="size-3.5" /> {m.flagged.length > 1 ? `S'han amagat ${m.flagged.length} jugades que no estaven verificades pel motor.` : "S'ha amagat 1 jugada que no estava verificada pel motor."}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
      {error && <p className="text-sm text-danger" role="status">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button
            key={a.label}
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => {
              onAction?.(a);
              void send(a.mode, { text: a.text, display: a.display ?? a.label, hintLevel: a.hintLevel });
            }}
          >
            {a.label}
          </Button>
        ))}
        {busy && <Loader2 className="size-4 animate-spin self-center text-muted-foreground" aria-label="Pensant" />}
      </div>
      {allowQuestions && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            const q = text.trim();
            setText('');
            void send('chat', { text: q, display: q });
          }}
        >
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className="min-h-10 flex-1" aria-label="Pregunta" rows={1} />
          <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Envia"><Send /></Button>
        </form>
      )}
      <p className="text-[11px] text-muted-foreground">Respostes de Claude basades en dades de chess.js i Stockfish. Les jugades no verificades s'amaguen.</p>
    </section>
  );
}
