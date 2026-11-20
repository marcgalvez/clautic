import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpenCheck, CalendarClock, Dumbbell, Flame, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useData } from '@/state/DataProvider';
import { usePlanInputs } from '@/state/usePlanInputs';
import { planSession } from '@/lib/training/sessionPlan';
import { strengthsAndWeaknesses, summarize, trainingLevel, MIN_ATTEMPTS_FOR_LEVEL } from '@/lib/training/stats';
import { dueReviews } from '@/lib/training/spacedRepetition';
import { allExercises } from '@/lib/exercises/bank';
import { LESSONS, getLesson } from '@/data/lessons';
import { conceptLabel } from '@/data/concepts';
import { difficultyLabel } from '@/lib/exercises/themes';
import { cn, formatDuration } from '@/lib/utils';

function greeting(name: string) {
  const h = new Date().getHours();
  const g = h < 6 ? 'Bona nit' : h < 13 ? 'Bon dia' : h < 20 ? 'Bona tarda' : 'Bon vespre';
  return `${g}, ${name}`;
}

const BLOCK_LABEL: Record<string, string> = {
  warmup: 'Recuperació de conceptes',
  understand: 'Comprendre',
  recall: 'Recordar',
  apply: 'Aplicar',
  weakness: 'Punt feble',
  consolidate: 'Consolidar',
};

export function HomePage() {
  const { data } = useData();
  const planInputs = usePlanInputs();
  const { profile, attempts, sessions, reviews } = data;
  const plan = useMemo(
    () => planSession({ minutes: profile!.sessionMinutes, lessons: LESSONS, exercises: allExercises(), attempts, sessions, reviews, baseDifficulty: planInputs.baseDifficulty, externalWeakConcepts: planInputs.externalWeakConcepts }),
    [profile, attempts, sessions, reviews, planInputs],
  );
  const lesson = getLesson(plan.lessonId)!;
  const summary = summarize(attempts);
  const level = trainingLevel(attempts);
  const { strengths, weaknesses } = strengthsAndWeaknesses(attempts);
  const due = dueReviews(reviews);
  const analysedGames = data.games.filter((g) => g.analysis).sort((a, b) => b.importedAt.localeCompare(a.importedAt));
  const completed = sessions.filter((s) => s.completedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const lessonsDone = new Set(completed.map((s) => s.lessonId));
  const today = new Date().toISOString().slice(0, 10);
  const trainedToday = completed.some((s) => s.completedAt!.slice(0, 10) === today);

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{greeting(profile!.displayName)}</h1>
        <p className="text-muted-foreground">
          {trainedToday ? 'Avui ja has entrenat. Pots fer una altra sessió o repassar exercicis.' : 'Tens una sessió preparada per avui.'}
        </p>
      </section>

      {!planInputs.diagnostic && (
        <Card className="border-accent/40 bg-accent/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="font-semibold">Encara no t'hem fet el diagnòstic</p>
              <p className="text-sm text-muted-foreground">13 posicions i unes preguntes per ajustar el nivell inicial i detectar per on començar.</p>
            </div>
            <Link to="/diagnostic" className={buttonVariants({ variant: 'accent' })}>Fes el diagnòstic</Link>
          </CardContent>
        </Card>
      )}

      {/* Today's recommended training */}
      <Card className="overflow-hidden border-primary/30">
        <div className="grid gap-0 md:grid-cols-[1fr_auto]">
          <div className="p-5 sm:p-6">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
              <Dumbbell className="size-4" /> Entrenament recomanat per avui · {plan.minutes} min
            </div>
            <h2 className="text-xl font-semibold">{lesson.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{lesson.principle}</p>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {plan.rationale.map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {plan.blocks.map((b) => (
                <Badge key={b.kind} variant="outline">
                  {BLOCK_LABEL[b.kind]} · {b.minutes}′{b.exerciseIds ? ` · ${b.exerciseIds.length} ex.` : ''}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex items-end bg-secondary/60 p-5 sm:p-6 md:items-center">
            <Link to="/entrenar" className={cn(buttonVariants({ size: 'lg' }), 'w-full md:w-auto')}>
              Comença la sessió <ArrowRight />
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5"><TrendingUp className="size-4" /> Nivell d'entrenament</CardDescription>
            <CardTitle className="text-2xl">
              {level.provisional
                ? planInputs.diagnostic
                  ? `${planInputs.baseDifficulty} / 5 · provisional`
                  : 'Provisional'
                : `${level.level} / 5 · ${difficultyLabel(level.level)}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {level.provisional ? (
              <>
                <p>
                  {planInputs.diagnostic ? 'Estimat pel diagnòstic. ' : ''}Calen almenys {MIN_ATTEMPTS_FOR_LEVEL} exercicis per confirmar-lo ({attempts.length} fets).
                </p>
                <Progress value={(attempts.length / MIN_ATTEMPTS_FOR_LEVEL) * 100} label="Dades per estimar el nivell" />
              </>
            ) : (
              <p>Basat en {level.basedOn} intents. És una mètrica interna de ChessLab, no un ELO.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5"><Target className="size-4" /> Objectiu actual</CardDescription>
            <CardTitle>Dominar els patrons tàctics bàsics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              {lessonsDone.size} de {LESSONS.length} temes treballats.
            </p>
            <Progress value={(lessonsDone.size / LESSONS.length) * 100} label="Temes treballats" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5"><CalendarClock className="size-4" /> Repassos</CardDescription>
            <CardTitle className="text-2xl">{due.length} pendents</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {reviews.length === 0
              ? 'Quan acabis la primera sessió es programaran els repassos (1, 3, 7, 14 dies…).'
              : due.length
                ? `Avui toca recuperar: ${due.slice(0, 3).map((r) => conceptLabel(r.conceptId)).join(', ')}.`
                : `Proper repàs: ${new Date([...reviews].sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0].dueAt).toLocaleDateString('ca')}.`}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Flame className="size-4 text-success" /> Punts forts</CardTitle>
          </CardHeader>
          <CardContent>
            {strengths.length ? (
              <ul className="space-y-1.5 text-sm">
                {strengths.slice(0, 4).map((s) => (
                  <li key={s.conceptId} className="flex justify-between gap-2">
                    <span>{conceptLabel(s.conceptId)}</span>
                    <span className="text-muted-foreground">{s.distinctExercises} posicions</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Encara no n'hi ha prou evidència. Un concepte compta com a punt fort quan el resols bé en almenys dues posicions diferents.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingDown className="size-4 text-danger" /> Punts a millorar</CardTitle>
          </CardHeader>
          <CardContent>
            {weaknesses.length ? (
              <ul className="space-y-1.5 text-sm">
                {weaknesses.slice(0, 4).map((s) => (
                  <li key={s.conceptId} className="flex justify-between gap-2">
                    <span>{conceptLabel(s.conceptId)}</span>
                    <span className="text-muted-foreground">qualitat {Math.round(s.avg * 100)}%</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Cap debilitat detectada encara. Es necessiten almenys dos intents per concepte.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Historial de sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {completed.length ? (
              <ul className="divide-y divide-border text-sm">
                {completed.slice(0, 5).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-medium">{getLesson(s.lessonId)?.title ?? s.lessonId}</span>
                      <span className="block text-xs text-muted-foreground">
                        {new Date(s.startedAt).toLocaleDateString('ca', { weekday: 'short', day: 'numeric', month: 'short' })} · {s.attemptIds.length} exercicis
                      </span>
                    </span>
                    <Badge variant="outline">{s.plannedMinutes}′</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Encara no has completat cap sessió.</p>
            )}
            {summary.total > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                {summary.total} exercicis · {Math.round(summary.cleanRate * 100)}% resolts a la primera · temps mitjà {formatDuration(summary.avgTimeMs)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BookOpenCheck className="size-4" /> Partides analitzades</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {analysedGames.length ? (
              <ul className="divide-y divide-border">
                {analysedGames.slice(0, 4).map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-2 py-2">
                    <Link to={`/partides/${g.id}`} className="min-w-0 truncate hover:underline">
                      {g.headers.White ?? '?'} – {g.headers.Black ?? '?'} <span className="text-muted-foreground">{g.headers.Result ?? ''}</span>
                    </Link>
                    <Badge variant="outline">{Math.round(g.analysis!.report.accuracy)}% precisió</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Encara no has analitzat cap partida. Importa-les de Lichess o enganxa un PGN: el sistema et dirà per què has perdut i què has d'entrenar.</p>
            )}
            <Link to="/partides">
              <Button variant="outline" size="sm">{analysedGames.length ? 'Totes les partides' : 'Analitza una partida'}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
