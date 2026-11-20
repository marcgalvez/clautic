import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck2, Clock, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Segmented } from '@/components/ui/segmented';
import { Textarea } from '@/components/ui/input';
import { ExerciseSolver } from '@/components/exercise/ExerciseSolver';
import { PrincipleRecall, RecallQuiz, UnderstandStep } from '@/components/training/LessonSteps';
import { useData } from '@/state/DataProvider';
import { usePlanInputs } from '@/state/usePlanInputs';
import { planSession, type SessionBlock, type SessionPlan } from '@/lib/training/sessionPlan';
import { applySessionToReviews } from '@/lib/training/spacedRepetition';
import { allExercises, getExercise } from '@/lib/exercises/bank';
import { LESSONS, getLesson } from '@/data/lessons';
import { conceptLabel } from '@/data/concepts';
import { SESSION_MINUTES, type Attempt, type RecallAnswer, type SessionMinutes, type TrainingSession } from '@/lib/storage/types';
import type { RecallQuestion } from '@/lib/training/lessonTypes';
import { uid } from '@/lib/utils';

type Step =
  | { kind: 'warmup'; questions: RecallQuestion[] }
  | { kind: 'understand' }
  | { kind: 'recall-principle' }
  | { kind: 'recall-quiz' }
  | { kind: 'exercise'; block: 'apply' | 'weakness'; exerciseId: string; index: number; total: number }
  | { kind: 'consolidate' };

const PHASE_LABEL: Record<string, string> = {
  warmup: 'Recuperació',
  understand: 'Comprendre',
  'recall-principle': 'Recordar',
  'recall-quiz': 'Recordar',
  exercise: 'Aplicar',
  consolidate: 'Consolidar',
};

/** Warm-up questions: one retrieval question per due concept, from the lesson that teaches it. */
function warmupQuestions(conceptIds: string[]): RecallQuestion[] {
  const out: RecallQuestion[] = [];
  for (const c of conceptIds) {
    const lesson = LESSONS.find((l) => l.conceptIds.includes(c));
    const q = lesson?.recall.find((r) => !out.some((o) => o.id === r.id));
    if (q) out.push(q);
  }
  return out;
}

function stepsFor(plan: SessionPlan): Step[] {
  const steps: Step[] = [];
  const exerciseBlocks = plan.blocks.filter((b): b is SessionBlock & { kind: 'apply' | 'weakness' } => b.kind === 'apply' || b.kind === 'weakness');
  const total = exerciseBlocks.reduce((n, b) => n + (b.exerciseIds?.length ?? 0), 0);
  let index = 0;
  for (const b of plan.blocks) {
    if (b.kind === 'warmup') {
      const qs = warmupQuestions(b.conceptIds ?? []);
      if (qs.length) steps.push({ kind: 'warmup', questions: qs });
    } else if (b.kind === 'understand') steps.push({ kind: 'understand' });
    else if (b.kind === 'recall') steps.push({ kind: 'recall-principle' }, { kind: 'recall-quiz' });
    else if (b.kind === 'apply' || b.kind === 'weakness') {
      for (const id of b.exerciseIds ?? []) steps.push({ kind: 'exercise', block: b.kind, exerciseId: id, index: index++, total });
    } else if (b.kind === 'consolidate') steps.push({ kind: 'consolidate' });
  }
  return steps;
}

export function TrainPage() {
  const { data, upsertSession } = useData();
  const planInputs = usePlanInputs();
  const [minutes, setMinutes] = useState<SessionMinutes>(data.profile!.sessionMinutes);
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [sessionAttempts, setSessionAttempts] = useState<Attempt[]>([]);
  const sessionRef = useRef<TrainingSession | null>(null);

  const preview = useMemo(
    () => planSession({ minutes, lessons: LESSONS, exercises: allExercises(), attempts: data.attempts, sessions: data.sessions, reviews: data.reviews, baseDifficulty: planInputs.baseDifficulty, externalWeakConcepts: planInputs.externalWeakConcepts }),
    [minutes, data.attempts, data.sessions, data.reviews, planInputs],
  );

  const steps = useMemo(() => (plan ? stepsFor(plan) : []), [plan]);
  const step = steps[stepIndex];
  const lesson = plan ? getLesson(plan.lessonId)! : getLesson(preview.lessonId)!;

  const save = (s: TrainingSession) => {
    sessionRef.current = s;
    setSession(s);
    upsertSession(s);
  };

  const start = () => {
    const frozen = preview;
    const s: TrainingSession = {
      id: uid('ses'),
      lessonId: frozen.lessonId,
      plannedMinutes: minutes,
      startedAt: new Date().toISOString(),
      exerciseIds: frozen.blocks.flatMap((b) => b.exerciseIds ?? []),
      attemptIds: [],
      recall: [],
    };
    setPlan(frozen);
    setStepIndex(0);
    setSessionAttempts([]);
    save(s);
  };

  const next = () => setStepIndex((i) => i + 1);

  const addRecall = (answers: RecallAnswer[]) => {
    const s = sessionRef.current!;
    save({ ...s, recall: [...s.recall, ...answers] });
    next();
  };

  const onExerciseDone = (a: Attempt) => {
    const s = sessionRef.current!;
    setSessionAttempts((list) => [...list, a]);
    save({ ...s, attemptIds: [...s.attemptIds, a.id] });
    next();
  };

  if (!plan || !session) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sessió d'entrenament</h1>
          <p className="text-muted-foreground">Quatre fases: comprendre, recordar, aplicar i consolidar.</p>
        </div>
        <Card>
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium"><Clock className="size-4" /> Durada</p>
              <Segmented label="Durada" value={minutes} onChange={setMinutes} options={SESSION_MINUTES.map((m) => ({ value: m, label: `${m} min` }))} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tema</p>
              <h2 className="text-xl font-semibold">{lesson.title}</h2>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {preview.rationale.map((r) => <li key={r}>• {r}</li>)}
              </ul>
            </div>
            <ol className="grid gap-2 sm:grid-cols-2">
              {preview.blocks.map((b) => (
                <li key={b.kind} className="rounded-md border border-border p-3 text-sm">
                  <span className="font-medium">{blockTitle(b.kind)}</span>
                  <span className="float-right text-muted-foreground">{b.minutes}′</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{blockDescription(b)}</span>
                </li>
              ))}
            </ol>
            <Button size="lg" onClick={start} className="w-full sm:w-auto">
              Comença <ArrowRight />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress = steps.length ? (stepIndex / steps.length) * 100 : 0;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge>{step ? PHASE_LABEL[step.kind] : 'Fet'}</Badge>
            <span className="text-sm text-muted-foreground">{lesson.title}</span>
          </div>
          {step?.kind === 'exercise' && (
            <span className="text-sm text-muted-foreground">
              Exercici {step.index + 1} de {step.total}
              {step.block === 'weakness' && ' · punt feble'}
            </span>
          )}
        </div>
        <Progress value={progress} label="Progrés de la sessió" />
      </div>

      <div key={stepIndex} className="animate-fade-in">
        {step?.kind === 'warmup' && (
          <RecallQuiz
            title="Recuperació de conceptes anteriors"
            intro="Abans del tema nou, recupera de memòria conceptes que vas treballar fa uns dies."
            questions={step.questions}
            onDone={addRecall}
          />
        )}
        {step?.kind === 'understand' && <UnderstandStep lesson={lesson} onDone={next} />}
        {step?.kind === 'recall-principle' && (
          <PrincipleRecall lesson={lesson} onDone={() => next()} />
        )}
        {step?.kind === 'recall-quiz' && <RecallQuiz title="Recordar" questions={lesson.recall} onDone={addRecall} />}
        {step?.kind === 'exercise' && (() => {
          const ex = getExercise(step.exerciseId);
          if (!ex) {
            return (
              <div className="space-y-3">
                <p className="text-sm text-danger">Aquest exercici ja no està disponible.</p>
                <Button onClick={next}>Continua</Button>
              </div>
            );
          }
          return (
            <div className="space-y-3">
              <ExerciseSolver key={ex.id} exercise={ex} context="session" sessionId={session.id} onDone={onExerciseDone} />
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={next} title="L'exercici no es comptarà">
                  <SkipForward /> Salta
                </Button>
              </div>
            </div>
          );
        })()}
        {step?.kind === 'consolidate' && (
          <Consolidate
            session={session}
            attempts={sessionAttempts}
            onFinish={(reflection, reviews) => {
              save({ ...session, reflection, completedAt: new Date().toISOString() });
              return reviews;
            }}
          />
        )}
        {!step && <SessionDone session={session} onRestart={() => { setPlan(null); setSession(null); }} />}
      </div>
    </div>
  );
}

function blockTitle(kind: SessionBlock['kind']) {
  return { warmup: 'Recuperació', understand: 'Comprendre', recall: 'Recordar', apply: 'Aplicar', weakness: 'Punt feble', consolidate: 'Consolidar' }[kind];
}

function blockDescription(b: SessionBlock) {
  switch (b.kind) {
    case 'warmup':
      return `Recuperar de memòria: ${(b.conceptIds ?? []).map(conceptLabel).join(', ')}`;
    case 'understand':
      return 'El concepte i què cal observar, amb una posició d\'exemple.';
    case 'recall':
      return 'Recuperar el principi sense mirar l\'explicació.';
    case 'apply':
      return `${b.exerciseIds?.length ?? 0} posicions noves al tauler.`;
    case 'weakness':
      return `Posicions noves sobre: ${(b.conceptIds ?? []).map(conceptLabel).join(', ')}`;
    case 'consolidate':
      return 'Reflexió i programació dels repassos.';
  }
}

function Consolidate({
  session,
  attempts,
  onFinish,
}: {
  session: TrainingSession;
  attempts: Attempt[];
  onFinish: (reflection: TrainingSession['reflection'], reviews: unknown) => unknown;
}) {
  const { data, setReviews } = useData();
  const [learned, setLearned] = useState('');
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [scheduled, setScheduled] = useState<{ conceptId: string; dueAt: string; days: number }[] | null>(null);
  const lesson = getLesson(session.lessonId)!;

  const clean = attempts.filter((a) => a.outcome === 'solved').length;
  const help = attempts.filter((a) => a.outcome === 'solved-with-help').length;
  const revealed = attempts.filter((a) => a.outcome === 'revealed').length;
  const recallOk = session.recall.filter((r) => r.correct).length;

  const finish = () => {
    // Per-concept quality: exercise quality, blended with recall answers for lesson concepts.
    const q: Record<string, { sum: number; n: number }> = {};
    for (const a of attempts) for (const c of a.concepts) {
      q[c] ??= { sum: 0, n: 0 };
      q[c].sum += a.quality;
      q[c].n++;
    }
    const recallRate = session.recall.length ? recallOk / session.recall.length : 0.5;
    for (const c of lesson.conceptIds) {
      q[c] ??= { sum: 0, n: 0 };
      q[c].sum += recallRate;
      q[c].n++;
    }
    const qualities = Object.fromEntries(Object.entries(q).map(([c, v]) => [c, v.sum / v.n]));
    const reviews = applySessionToReviews(data.reviews, qualities);
    setReviews(reviews);
    onFinish({ learned: learned.trim(), confidence }, reviews);
    setScheduled(
      Object.keys(qualities)
        .map((c) => reviews.find((r) => r.conceptId === c)!)
        .map((r) => ({ conceptId: r.conceptId, dueAt: r.dueAt, days: r.intervalDays }))
        .sort((a, b) => a.days - b.days),
    );
  };

  if (scheduled) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-semibold"><CalendarCheck2 className="size-5 text-primary" /> Repassos programats</h2>
        <p className="text-sm text-muted-foreground">
          Els conceptes que t'han costat tornaran abans; els que domines, més endavant. Al repàs veuràs posicions diferents, no les mateixes.
        </p>
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {scheduled.map((s) => (
            <li key={s.conceptId} className="flex justify-between gap-2 p-3">
              <span>{conceptLabel(s.conceptId)}</span>
              <span className="text-muted-foreground">
                d'aquí a {s.days} {s.days === 1 ? 'dia' : 'dies'} · {new Date(s.dueAt).toLocaleDateString('ca', { day: 'numeric', month: 'short' })}
              </span>
            </li>
          ))}
        </ul>
        <Link to="/"><Button>Torna a l'inici</Button></Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h2 className="text-xl font-semibold">Consolidar</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="A la primera" value={clean} />
        <Stat label="Amb ajuda" value={help} />
        <Stat label="Solució vista" value={revealed} />
        <Stat label="Preguntes encertades" value={`${recallOk}/${session.recall.length}`} />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Què t'emportes d'aquesta sessió? Què faràs diferent a la propera partida?</p>
        <Textarea value={learned} onChange={(e) => setLearned(e.target.value)} placeholder="Ex.: abans de moure revisaré si el cavall rival pot fer forquilla…" aria-label="Reflexió" />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Fins a quin punt et sents segur/a amb aquest tema?</p>
        <Segmented
          label="Confiança"
          value={confidence}
          onChange={setConfidence}
          options={[1, 2, 3, 4, 5].map((v) => ({ value: v as 1 | 2 | 3 | 4 | 5, label: ['Gens', 'Poc', 'Regular', 'Bastant', 'Molt'][v - 1] }))}
        />
      </div>
      <Button size="lg" onClick={finish}>Acaba i programa els repassos</Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SessionDone({ session, onRestart }: { session: TrainingSession; onRestart: () => void }) {
  return (
    <div className="mx-auto max-w-xl space-y-3 text-center">
      <h2 className="text-xl font-semibold">Sessió completada</h2>
      <p className="text-muted-foreground">{session.attemptIds.length} exercicis registrats.</p>
      <Button onClick={onRestart}>Nova sessió</Button>
    </div>
  );
}
