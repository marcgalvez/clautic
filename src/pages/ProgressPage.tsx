import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/state/DataProvider';
import { byKey, dailyQuality, summarize } from '@/lib/training/stats';
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

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Progrés</h1>
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          Mètriques internes d'entrenament de ChessLab. No són cap classificació oficial ni un ELO. La importació de l'ELO de Lichess arribarà en una fase
          posterior i es mostrarà per separat.
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
