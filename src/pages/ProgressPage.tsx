import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/state/DataProvider';
import { byKey, dailyQuality, recurringTrainingErrors, summarize, weekly } from '@/lib/training/stats';
import { getExercise as findExercise } from '@/lib/exercises/bank';
import { CATEGORY_LABELS } from '@/lib/exercises/themes';
import { LineChart } from '@/components/charts/LineChart';
import { summarizePatterns, ERROR_TYPE_LABELS } from '@/lib/games/patterns';
import { getLesson } from '@/data/lessons';
import { getExercise } from '@/lib/exercises/bank';
import { themeLabel } from '@/lib/exercises/themes';
import { conceptLabel } from '@/data/concepts';
import { formatDuration } from '@/lib/utils';
import type { AttemptOutcome } from '@/lib/storage/types';

const OUTCOME: Record<AttemptOutcome, { label: string; variant: 'success' | 'warning' | 'danger' | 'outline' }> = {
  solved: { label: 'A la primera', variant: 'success' },
  'solved-with-help': { label: 'Amb ajuda', variant: 'warning' },
  revealed: { label: 'Solució vista', variant: 'danger' },
  abandoned: { label: 'Abandonat', variant: 'outline' },
};

export function ProgressPage() {
  const { data } = useData();
  const attempts = data.attempts;
  const summary = summarize(attempts);
  const themes = useMemo(() => Object.entries(byKey(attempts, (a) => a.theme)).sort((a, b) => b[1].total - a[1].total), [attempts]);
  const daily = useMemo(() => dailyQuality(attempts).slice(-14), [attempts]);
  const recent = [...attempts].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 25);
  const reviews = [...data.reviews].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const completedSessions = data.sessions.filter((s) => s.completedAt).length;
  const categoryOf = (id: string) => findExercise(id)?.category ?? 'tactics';
  const byCategory = useMemo(() => byKey(attempts, (a) => categoryOf(a.exerciseId)), [attempts]);
  const weeklyTactics = useMemo(() => weekly(attempts.filter((a) => categoryOf(a.exerciseId) === 'tactics'), (a) => a.quality * 100), [attempts]);
  const weeklyEndgame = useMemo(() => weekly(attempts.filter((a) => categoryOf(a.exerciseId) === 'endgame'), (a) => a.quality * 100), [attempts]);
  const weeklyTime = useMemo(() => weekly(attempts, (a) => a.durationMs / 1000), [attempts]);
  const recurring = useMemo(() => recurringTrainingErrors(attempts), [attempts]);
  const patterns = useMemo(() => summarizePatterns(data.games), [data.games]);
  const sessionsDone = [...data.sessions].filter((s) => s.completedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Progrés</h1>
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          Mètriques internes d'entrenament de ChessLab. No són cap classificació oficial ni un ELO. Les classificacions externes (Lichess, Chess.com,
          FIDE) es mostren al perfil, separades per plataforma i ritme.
        </p>
      </div>

      {attempts.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Encara no hi ha resultats. <Link to="/entrenar" className="text-primary underline">Fes la primera sessió</Link> o resol algun{' '}
            <Link to="/exercicis" className="text-primary underline">exercici</Link>.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi label="Exercicis" value={summary.total} />
            <Kpi label="Resolts a la primera" value={`${Math.round(summary.cleanRate * 100)}%`} />
            <Kpi label="Resolts (amb ajuda inclosa)" value={`${Math.round(summary.successRate * 100)}%`} />
            <Kpi label="Temps mitjà" value={formatDuration(summary.avgTimeMs)} />
            <Kpi label="Sessions completades" value={completedSessions} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Precisió per categoria</CardTitle>
              <CardDescription>Percentatge d'exercicis resolts a la primera, sense pistes.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {(['tactics', 'strategy', 'endgame', 'opening'] as const).map((c) => {
                const s = byCategory[c];
                return (
                  <div key={c} className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[c]}</p>
                    <p className="text-xl font-semibold tabular-nums">{s ? `${Math.round(s.cleanRate * 100)}%` : '–'}</p>
                    <p className="text-xs text-muted-foreground">{s ? `${s.total} intents` : 'Sense dades'}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-1"><CardTitle>Progrés en tàctica</CardTitle><CardDescription>Qualitat setmanal (0–100)</CardDescription></CardHeader>
              <CardContent><LineChart ariaLabel="Qualitat setmanal en tàctica" domain={[0, 100]} height={120} points={weeklyTactics.map((w) => ({ label: `setm. ${w.week}`, value: w.value }))} /></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1"><CardTitle>Progrés en finals</CardTitle><CardDescription>Qualitat setmanal (0–100)</CardDescription></CardHeader>
              <CardContent><LineChart ariaLabel="Qualitat setmanal en finals" domain={[0, 100]} height={120} points={weeklyEndgame.map((w) => ({ label: `setm. ${w.week}`, value: w.value }))} /></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1"><CardTitle>Temps de resolució</CardTitle><CardDescription>Mitjana setmanal (segons)</CardDescription></CardHeader>
              <CardContent><LineChart ariaLabel="Temps mitjà setmanal" height={120} format={(v) => `${Math.round(v)} s`} points={weeklyTime.map((w) => ({ label: `setm. ${w.week}`, value: w.value }))} /></CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Errors recurrents</CardTitle>
                <CardDescription>Només compten si es repeteixen en almenys dues posicions o partides diferents.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">En els exercicis</p>
                  {recurring.length ? (
                    <ul className="divide-y divide-border">
                      {recurring.slice(0, 5).map((r) => (
                        <li key={r.conceptId} className="flex justify-between py-1.5"><span>{conceptLabel(r.conceptId)}</span><span className="text-muted-foreground">{r.errors} errors · {r.exercises} posicions</span></li>
                      ))}
                    </ul>
                  ) : <p className="text-muted-foreground">Cap patró clar encara.</p>}
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">En les partides ({patterns.gamesAnalysed} analitzades)</p>
                  {patterns.recurring.filter((r) => r.games >= 2).length ? (
                    <ul className="divide-y divide-border">
                      {patterns.recurring.filter((r) => r.games >= 2).map((r) => (
                        <li key={r.type} className="flex justify-between py-1.5"><span>{ERROR_TYPE_LABELS[r.type]}</span><span className="text-muted-foreground">{r.count} en {r.games} partides</span></li>
                      ))}
                    </ul>
                  ) : patterns.gamesAnalysed > 0 ? (
                    <p className="text-muted-foreground">Cap tipus d'error es repeteix encara en dues partides. <Link to="/partides" className="text-primary underline">Analitza'n més</Link>.</p>
                  ) : (
                    <p className="text-muted-foreground"><Link to="/partides" className="text-primary underline">Analitza partides</Link> per detectar patrons.</p>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Sessions completades</CardTitle></CardHeader>
              <CardContent>
                {sessionsDone.length ? (
                  <ul className="divide-y divide-border text-sm">
                    {sessionsDone.slice(0, 8).map((s) => {
                      const ok = s.recall.filter((r) => r.correct).length;
                      return (
                        <li key={s.id} className="py-2">
                          <div className="flex justify-between gap-2"><span className="font-medium">{getLesson(s.lessonId)?.title ?? s.lessonId}</span><span className="text-xs text-muted-foreground">{new Date(s.startedAt).toLocaleDateString('ca')}</span></div>
                          <p className="text-xs text-muted-foreground">{s.plannedMinutes}′ · {s.attemptIds.length} exercicis · record {ok}/{s.recall.length}{s.reflection?.learned ? ` · «${s.reflection.learned.slice(0, 80)}»` : ''}</p>
                        </li>
                      );
                    })}
                  </ul>
                ) : <p className="text-sm text-muted-foreground">Cap sessió completada.</p>}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
              <span className="text-muted-foreground">Les classificacions de Lichess, Chess.com o FIDE es mostren al perfil, separades per plataforma i ritme.</span>
              <Link to="/perfil" className="text-primary underline">Veure classificacions externes</Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evolució de la qualitat</CardTitle>
              <CardDescription>Qualitat mitjana diària (0–100): penalitza pistes, errors i temps excessiu.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-36 items-end gap-1.5" role="img" aria-label="Gràfic de qualitat diària">
                {daily.map((d) => (
                  <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] tabular-nums text-muted-foreground">{Math.round(d.avgQuality * 100)}</span>
                    <div className="w-full max-w-10 rounded-t bg-primary/80" style={{ height: `${Math.max(4, d.avgQuality * 100)}px` }} title={`${d.day}: ${d.n} exercicis`} />
                    <span className="text-[10px] text-muted-foreground">{d.day.slice(5)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Rendiment per tema</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr><th className="py-1.5 font-medium">Tema</th><th className="font-medium">Intents</th><th className="font-medium">1a</th><th className="font-medium">Pistes</th><th className="font-medium">Temps</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {themes.map(([theme, s]) => (
                      <tr key={theme}>
                        <td className="py-1.5">{themeLabel(theme)}</td>
                        <td className="tabular-nums">{s.total}</td>
                        <td className="tabular-nums">{Math.round(s.cleanRate * 100)}%</td>
                        <td className="tabular-nums">{s.avgHints.toFixed(1)}</td>
                        <td className="tabular-nums">{formatDuration(s.avgTimeMs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Repassos programats</CardTitle>
                <CardDescription>Intervals adaptatius (1, 3, 7, 14, 30… dies) segons el rendiment.</CardDescription>
              </CardHeader>
              <CardContent>
                {reviews.length ? (
                  <ul className="divide-y divide-border text-sm">
                    {reviews.map((r) => {
                      const due = new Date(r.dueAt) <= new Date();
                      return (
                        <li key={r.conceptId} className="flex items-center justify-between gap-2 py-1.5">
                          <span>{conceptLabel(r.conceptId)}</span>
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            {due ? <Badge variant="warning">Pendent</Badge> : new Date(r.dueAt).toLocaleDateString('ca', { day: 'numeric', month: 'short' })}
                            <span>· {r.intervalDays} d</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Es programaran en acabar una sessió guiada.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Registre d'intents</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="py-1.5 font-medium">Data</th><th className="font-medium">Exercici</th><th className="font-medium">Resultat</th><th className="font-medium">Errors</th><th className="font-medium">Pistes</th><th className="font-medium">Temps</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recent.map((a) => (
                    <tr key={a.id}>
                      <td className="py-1.5 text-muted-foreground">{new Date(a.startedAt).toLocaleString('ca', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                      <td><Link to={`/exercicis/${a.exerciseId}`} className="hover:underline">{getExercise(a.exerciseId)?.title ?? a.exerciseId}</Link></td>
                      <td><Badge variant={OUTCOME[a.outcome].variant}>{OUTCOME[a.outcome].label}</Badge></td>
                      <td className="tabular-nums">{a.wrongMoves}</td>
                      <td className="tabular-nums">{a.hintsUsed}</td>
                      <td className="tabular-nums">{formatDuration(a.durationMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}
