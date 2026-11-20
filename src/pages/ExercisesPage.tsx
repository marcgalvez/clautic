import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, CircleDashed, ShieldCheck, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EXERCISES, UNVERIFIED_COUNT, VERIFICATION_META } from '@/lib/exercises/bank';
import { CATEGORY_LABELS, difficultyLabel, themeLabel } from '@/lib/exercises/themes';
import { useData } from '@/state/DataProvider';
import { cn } from '@/lib/utils';
import type { Attempt } from '@/lib/storage/types';

function statusOf(attempts: Attempt[]): 'new' | 'clean' | 'help' | 'failed' {
  if (!attempts.length) return 'new';
  const last = [...attempts].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  if (last.outcome === 'solved') return 'clean';
  if (last.outcome === 'solved-with-help') return 'help';
  return 'failed';
}

const STATUS = {
  new: { label: 'Nou', icon: CircleDashed, cls: 'text-muted-foreground' },
  clean: { label: 'Resolt a la primera', icon: CheckCircle2, cls: 'text-success' },
  help: { label: 'Resolt amb ajuda', icon: CheckCircle2, cls: 'text-warning' },
  failed: { label: 'Pendent de dominar', icon: XCircle, cls: 'text-danger' },
};

export function ExercisesPage() {
  const { data } = useData();
  const [theme, setTheme] = useState<string>('all');
  const [difficulty, setDifficulty] = useState<number>(0);
  const themes = useMemo(() => [...new Set(EXERCISES.map((e) => e.theme))], []);
  const byExercise = useMemo(() => {
    const m: Record<string, Attempt[]> = {};
    for (const a of data.attempts) (m[a.exerciseId] ??= []).push(a);
    return m;
  }, [data.attempts]);

  const list = EXERCISES.filter((e) => (theme === 'all' || e.theme === theme) && (!difficulty || e.difficulty === difficulty));

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Banc d'exercicis</h1>
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" />
          {EXERCISES.length} exercicis de {CATEGORY_LABELS.tactics.toLowerCase()} validats amb chess.js i {VERIFICATION_META.engine} (profunditat {VERIFICATION_META.depth}).
          {UNVERIFIED_COUNT > 0 && <span className="text-warning"> {UNVERIFIED_COUNT} ocults per no estar verificats.</span>}
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtra per tema">
        {['all', ...themes].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            aria-pressed={theme === t}
            className={cn(
              'cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors',
              theme === t ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted',
            )}
          >
            {t === 'all' ? 'Tots' : themeLabel(t)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Filtra per dificultat">
        <span className="text-muted-foreground">Dificultat:</span>
        {[0, 1, 2, 3, 4].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDifficulty(d)}
            aria-pressed={difficulty === d}
            className={cn('cursor-pointer rounded-md px-2 py-0.5', difficulty === d ? 'bg-secondary font-medium text-secondary-foreground' : 'text-muted-foreground hover:bg-muted')}
          >
            {d === 0 ? 'Totes' : difficultyLabel(d)}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((e) => {
          const st = STATUS[statusOf(byExercise[e.id] ?? [])];
          return (
            <Link key={e.id} to={`/exercicis/${e.id}`} className="group">
              <Card className="h-full p-4 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/50 group-hover:shadow-md">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Badge>{themeLabel(e.theme)}</Badge>
                  <span className="text-xs text-muted-foreground">{'●'.repeat(e.difficulty)}{'○'.repeat(5 - e.difficulty)}</span>
                </div>
                <h2 className="font-semibold">{e.title}</h2>
                <p className="text-sm text-muted-foreground">{e.objective}</p>
                <p className={cn('mt-3 flex items-center gap-1 text-xs', st.cls)}>
                  <st.icon className="size-3.5" /> {st.label}
                  {byExercise[e.id]?.length ? <span className="text-muted-foreground"> · {byExercise[e.id].length} intents</span> : null}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>
      {list.length === 0 && <p className="text-sm text-muted-foreground">Cap exercici amb aquests filtres.</p>}
    </div>
  );
}
