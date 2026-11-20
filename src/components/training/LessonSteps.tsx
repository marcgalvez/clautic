import { useState } from 'react';
import { Chess } from 'chess.js';
import { CheckCircle2, Eye, XCircle } from 'lucide-react';
import { ChessBoard, type BoardMove } from '@/components/board/ChessBoard';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import type { Lesson, RecallQuestion } from '@/lib/training/lessonTypes';
import type { RecallAnswer } from '@/lib/storage/types';
import { cn } from '@/lib/utils';

/** Phase 1 — COMPRENDRE: concept + what to look at + interactive example. */
export function UnderstandStep({ lesson, onDone }: { lesson: Lesson; onDone: () => void }) {
  const { example } = lesson.understand;
  const q = example.question;
  const [fen, setFen] = useState(example.fen);
  const [tries, setTries] = useState(0);
  const [result, setResult] = useState<'correct' | 'wrong' | 'shown' | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const answered = result === 'correct' || result === 'shown';
  const orientation = example.fen.split(' ')[1] === 'b' ? 'black' : 'white';

  const check = (value: string) => {
    if (answered) return;
    const ok = q.answer.includes(value);
    setTries((t) => t + 1);
    setResult(ok ? 'correct' : 'wrong');
  };

  const onMove = (m: BoardMove) => {
    if (answered) return false;
    const uci = `${m.from}${m.to}${m.promotion ?? ''}`;
    if (q.answer.includes(uci)) {
      const g = new Chess(fen);
      g.move(m);
      setFen(g.fen());
    }
    check(uci);
    return q.answer.includes(uci);
  };

  const highlights: Record<string, string> = {};
  for (const sq of example.highlights ?? []) highlights[sq] = 'rgba(20,184,166,0.35)';
  if (picked) highlights[picked] = result === 'correct' ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.55)';
  if (result === 'shown' && q.kind === 'square') for (const sq of q.answer) highlights[sq] = 'rgba(34,197,94,0.6)';

  const arrows = [
    ...(example.arrows ?? []).map(([s, e]) => ({ startSquare: s, endSquare: e, color: 'rgba(20,184,166,0.8)' })),
    ...(result === 'shown' && q.kind === 'move' ? q.answer.slice(0, 1).map((u) => ({ startSquare: u.slice(0, 2), endSquare: u.slice(2, 4), color: 'rgba(34,197,94,0.85)' })) : []),
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="mx-auto w-full max-w-[min(100%,600px)]">
        <ChessBoard
          fen={fen}
          orientation={orientation}
          movable={q.kind === 'move' && !answered ? 'turn' : 'none'}
          onMove={q.kind === 'move' ? onMove : undefined}
          onSquarePick={q.kind === 'square' && !answered ? (sq) => { setPicked(sq); check(sq); } : undefined}
          highlights={highlights}
          arrows={arrows}
          id={`lesson-${lesson.id}`}
        />
        <p className="mt-2 text-center text-sm text-muted-foreground">{example.caption}</p>
      </div>
      <div className="space-y-4">
        {lesson.understand.intro.map((p) => (
          <p key={p} className="text-[15px] leading-relaxed">{p}</p>
        ))}
        <div className="rounded-lg border border-border p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Què has d'observar</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {lesson.understand.observe.map((o) => <li key={o}>{o}</li>)}
          </ul>
        </div>
        <div className="rounded-lg bg-secondary p-4 text-secondary-foreground">
          <p className="font-medium">{q.prompt}</p>
          {result === 'correct' && <Feedback ok text={q.correctFeedback} />}
          {result === 'wrong' && <Feedback ok={false} text={q.wrongFeedback} />}
          {result === 'shown' && <Feedback ok text={q.correctFeedback} />}
          {result === 'wrong' && tries >= 2 && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setResult('shown')}>
              <Eye /> Mostra la resposta
            </Button>
          )}
        </div>
        <Button onClick={onDone} disabled={!answered} className="w-full">
          Continua: ara toca recordar
        </Button>
      </div>
    </div>
  );
}

function Feedback({ ok, text }: { ok: boolean; text: string }) {
  return (
    <p className={cn('mt-2 flex items-start gap-2 text-sm animate-fade-in', ok ? 'text-success' : 'text-danger')} role="status">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
      {text}
    </p>
  );
}

/**
 * Retrieval practice: multiple-choice questions answered from memory. The
 * explanation is shown only after answering.
 */
export function RecallQuiz({
  questions,
  title,
  intro,
  onDone,
}: {
  questions: RecallQuestion[];
  title: string;
  intro?: string;
  onDone: (answers: RecallAnswer[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [answers, setAnswers] = useState<RecallAnswer[]>([]);
  const q = questions[index];

  const answer = (i: number) => {
    if (choice !== null) return;
    setChoice(i);
    setAnswers((a) => [...a, { questionId: q.id, correct: i === q.correct, answer: q.options[i] }]);
  };

  const next = () => {
    if (index + 1 >= questions.length) onDone(answers);
    else {
      setIndex(index + 1);
      setChoice(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title} · pregunta {index + 1} de {questions.length}
        </p>
        {intro && index === 0 && <p className="mt-1 text-sm text-muted-foreground">{intro}</p>}
      </div>
      <h3 className="text-lg font-semibold">{q.prompt}</h3>
      <div className="grid gap-2">
        {q.options.map((o, i) => {
          const state = choice === null ? 'idle' : i === q.correct ? 'correct' : i === choice ? 'wrong' : 'dim';
          return (
            <button
              key={o}
              type="button"
              onClick={() => answer(i)}
              disabled={choice !== null}
              className={cn(
                'cursor-pointer rounded-lg border p-3 text-left text-sm transition-colors',
                state === 'idle' && 'border-border bg-card hover:border-primary hover:bg-secondary',
                state === 'correct' && 'border-success bg-success/10',
                state === 'wrong' && 'border-danger bg-danger/10',
                state === 'dim' && 'border-border opacity-60',
              )}
            >
              {o}
            </button>
          );
        })}
      </div>
      {choice !== null && (
        <div className="space-y-3 animate-fade-in">
          <Feedback ok={choice === q.correct} text={(choice === q.correct ? 'Correcte. ' : 'No exactament. ') + q.explanation} />
          <Button onClick={next}>{index + 1 >= questions.length ? 'Continua' : 'Següent pregunta'}</Button>
        </div>
      )}
    </div>
  );
}

/** Free recall of the principle (generation effect) before showing it again. */
export function PrincipleRecall({ lesson, onDone }: { lesson: Lesson; onDone: (text: string) => void }) {
  const [text, setText] = useState('');
  const [shown, setShown] = useState(false);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recordar · sense mirar enrere</p>
      <h3 className="text-lg font-semibold">Amb les teves paraules: quin és el principi que acabem de treballar?</h3>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Escriu-lo com si l'expliquessis a un company…" disabled={shown} aria-label="El principi amb les teves paraules" />
      {!shown ? (
        <div className="flex gap-2">
          <Button onClick={() => setShown(true)} disabled={text.trim().length < 3}>Compara</Button>
          <Button variant="ghost" onClick={() => setShown(true)}>No ho recordo</Button>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-in">
          <div className="rounded-lg bg-secondary p-4 text-secondary-foreground">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70">El principi</p>
            <p className="mt-1">{lesson.principle}</p>
          </div>
          <p className="text-sm text-muted-foreground">Compara-ho amb el que has escrit. Recuperar-ho de memòria, encara que costi, és el que fa que es quedi.</p>
          <Button onClick={() => onDone(text)}>Continua</Button>
        </div>
      )}
    </div>
  );
}
