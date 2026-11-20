import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chess } from 'chess.js';
import { ArrowRight, CheckCircle2, ClipboardCheck, XCircle } from 'lucide-react';
import { ChessBoard, type BoardMove } from '@/components/board/ChessBoard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Segmented } from '@/components/ui/segmented';
import { Input, Label, Textarea } from '@/components/ui/input';
import { useData } from '@/state/DataProvider';
import { DIAGNOSTIC_ITEMS, COMPETENCE_LABELS, scoreDiagnostic, shouldStop, weakCompetences, type DiagnosticItem } from '@/lib/diagnostic/diagnostic';
import { getExercise } from '@/lib/exercises/bank';
import { flipTurn } from '@/lib/exercises/validate';
import { tryUciMove } from '@/lib/chess/game';
import { attemptQuality } from '@/lib/training/scoring';
import { difficultyLabel } from '@/lib/exercises/themes';
import { SESSION_MINUTES, type Attempt, type Competence, type DiagnosticItemResult, type DiagnosticResult, type ExternalRating, type RatingPlatform, type SessionMinutes, type TimeControl } from '@/lib/storage/types';
import { uid, cn } from '@/lib/utils';

const GOALS = [
  'Deixar de penjar peces',
  'Millorar la tàctica',
  'Calcular millor',
  'Aprendre obertures',
  'Jugar millor els finals',
  'Entendre els meus errors',
  'Preparar torneigs',
];

const PLATFORM_LABEL: Record<RatingPlatform, string> = { lichess: 'Lichess', chesscom: 'Chess.com', fide: 'FIDE' };
const TC_BY_PLATFORM: Record<RatingPlatform, TimeControl[]> = {
  lichess: ['bullet', 'blitz', 'rapid', 'classical', 'correspondence'],
  chesscom: ['bullet', 'blitz', 'rapid', 'correspondence'],
  fide: ['standard', 'rapid', 'blitz'],
};
export const TC_LABEL: Record<TimeControl, string> = {
  bullet: 'Bala', blitz: 'Blitz', rapid: 'Ràpides', classical: 'Clàssiques', correspondence: 'Correspondència', standard: 'Estàndard',
};

type Phase = 'questionnaire' | 'items' | 'results';

export function DiagnosticPage() {
  const { data, setProfile, addDiagnostic, addAttempt, addExternalRatings } = useData();
  const profile = data.profile!;
  const [phase, setPhase] = useState<Phase>('questionnaire');
  const [knowsRules, setKnowsRules] = useState(true);
  const [plays, setPlays] = useState<DiagnosticResult['questionnaire']['playsRegularly']>('occasionally');
  const [goals, setGoals] = useState<string[]>([]);
  const [minutes, setMinutes] = useState<SessionMinutes>(profile.sessionMinutes);
  const [ratings, setRatings] = useState<{ platform: RatingPlatform; timeControl: TimeControl; rating: string }[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<DiagnosticItemResult[]>([]);
  const [final, setFinal] = useState<DiagnosticResult | null>(null);

  const ratingErrors = ratings.map((r) => {
    const n = Number(r.rating);
    return r.rating && (!Number.isInteger(n) || n < 100 || n > 3500) ? 'Ha de ser un número entre 100 i 3500' : null;
  });

  const startItems = () => {
    setProfile({ ...profile, sessionMinutes: minutes });
    const valid: ExternalRating[] = ratings
      .filter((r, i) => r.rating && !ratingErrors[i])
      .map((r) => ({ id: uid('rat'), platform: r.platform, timeControl: r.timeControl, rating: Number(r.rating), source: 'self-reported', recordedAt: new Date().toISOString() }));
    if (valid.length) addExternalRatings(valid);
    setPhase('items');
  };

  const finish = (all: DiagnosticItemResult[], stopped: boolean) => {
    const d = scoreDiagnostic(all, { knowsRules, playsRegularly: plays, goals }, stopped);
    addDiagnostic(d);
    setFinal(d);
    setPhase('results');
  };

  const onItemDone = (r: DiagnosticItemResult, attempt: Attempt) => {
    addAttempt(attempt);
    const all = [...results, r];
    setResults(all);
    if (index + 1 >= DIAGNOSTIC_ITEMS.length) finish(all, false);
    else if (shouldStop(all)) finish(all, true);
    else setIndex(index + 1);
  };

  if (phase === 'questionnaire') {
    return (
      <div className="mx-auto max-w-2xl space-y-5 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Diagnòstic inicial</h1>
          <p className="text-muted-foreground">
            Unes preguntes i {DIAGNOSTIC_ITEMS.length} posicions de dificultat creixent. Serveix per decidir per on començar; no és un examen. Uns 10–15 minuts.
          </p>
        </div>
        <Card>
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Coneixes les regles (enroc, captura al pas, promoció)?</p>
              <Segmented label="Regles" value={knowsRules ? 'y' : 'n'} onChange={(v) => setKnowsRules(v === 'y')} options={[{ value: 'y', label: 'Sí' }, { value: 'n', label: 'No del tot' }]} />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Jugues habitualment?</p>
              <Segmented
                label="Freqüència"
                value={plays}
                onChange={setPlays}
                options={[{ value: 'no', label: 'No' }, { value: 'occasionally', label: 'De tant en tant' }, { value: 'weekly', label: 'Cada setmana' }, { value: 'daily', label: 'Cada dia' }]}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Tens classificació a alguna plataforma? (opcional)</p>
              <p className="text-xs text-muted-foreground">Cada plataforma i ritme es desa per separat: un 1500 de Lichess no és un 1500 FIDE.</p>
              {ratings.map((r, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2">
                  <select aria-label="Plataforma" className="h-10 rounded-md border border-input bg-card px-2 text-sm" value={r.platform}
                    onChange={(e) => { const platform = e.target.value as RatingPlatform; setRatings(ratings.map((x, j) => (j === i ? { ...x, platform, timeControl: TC_BY_PLATFORM[platform][1] ?? TC_BY_PLATFORM[platform][0] } : x))); }}>
                    {(Object.keys(PLATFORM_LABEL) as RatingPlatform[]).map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
                  </select>
                  <select aria-label="Ritme" className="h-10 rounded-md border border-input bg-card px-2 text-sm" value={r.timeControl}
                    onChange={(e) => setRatings(ratings.map((x, j) => (j === i ? { ...x, timeControl: e.target.value as TimeControl } : x)))}>
                    {TC_BY_PLATFORM[r.platform].map((tc) => <option key={tc} value={tc}>{TC_LABEL[tc]}</option>)}
                  </select>
                  <div className="w-28">
                    <Input inputMode="numeric" aria-label="Classificació" placeholder="1500" value={r.rating} onChange={(e) => setRatings(ratings.map((x, j) => (j === i ? { ...x, rating: e.target.value } : x)))} />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setRatings(ratings.filter((_, j) => j !== i))}>Treu</Button>
                  {ratingErrors[i] && <p className="w-full text-xs text-danger">{ratingErrors[i]}</p>}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setRatings([...ratings, { platform: 'lichess', timeControl: 'blitz', rating: '' }])}>Afegeix una classificació</Button>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Quant de temps vols dedicar a cada sessió?</p>
              <Segmented label="Durada" value={minutes} onChange={setMinutes} options={SESSION_MINUTES.map((m) => ({ value: m, label: `${m} min` }))} />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Què vols aconseguir?</p>
              <div className="flex flex-wrap gap-2">
                {GOALS.map((g) => (
                  <button key={g} type="button" aria-pressed={goals.includes(g)}
                    onClick={() => setGoals(goals.includes(g) ? goals.filter((x) => x !== g) : [...goals, g])}
                    className={cn('cursor-pointer rounded-full border px-3 py-1 text-sm', goals.includes(g) ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <Button size="lg" onClick={startItems} disabled={ratingErrors.some(Boolean)}>Comença les posicions <ArrowRight /></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === 'items') {
    const item = DIAGNOSTIC_ITEMS[index];
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Badge>Diagnòstic</Badge> Posició {index + 1} de {DIAGNOSTIC_ITEMS.length}</span>
            <span>Un sol intent, sense pistes</span>
          </div>
          <Progress value={(index / DIAGNOSTIC_ITEMS.length) * 100} label="Progrés del diagnòstic" />
        </div>
        <DiagnosticItemRunner key={item.exerciseId} item={item} onDone={onItemDone} />
      </div>
    );
  }

  return <DiagnosticResults result={final!} />;
}

function DiagnosticItemRunner({ item, onDone }: { item: DiagnosticItem; onDone: (r: DiagnosticItemResult, a: Attempt) => void }) {
  const ex = getExercise(item.exerciseId)!;
  const kind = ex.kind ?? 'move';
  const start = useRef(Date.now());
  const [answer, setAnswer] = useState<{ correct: boolean; label: string; timeMs: number; fen?: string; move?: { from: string; to: string } } | null>(null);
  const [reason, setReason] = useState<number | null>(null);
  const [reasoning, setReasoning] = useState('');
  const optionFen = kind === 'threat' ? flipTurn(ex.fen) : ex.fen;
  const options = useMemo(() => (ex.options ?? []).map((u) => ({ uci: u, san: tryUciMove(optionFen, u)?.move.san ?? u })), [ex.options, optionFen]);
  const color = ex.fen.split(' ')[1] === 'b' ? 'b' : 'w';

  const submit = (uci: string, san: string, fen?: string) => {
    if (answer) return;
    let correct = uci === ex.solution[0] || (ex.alternatives?.['0'] ?? []).includes(uci);
    if (kind === 'move' && !correct && fen && new Chess(fen).isCheckmate()) correct = true;
    setAnswer({ correct, label: san, timeMs: Date.now() - start.current, fen, move: { from: uci.slice(0, 2), to: uci.slice(2, 4) } });
  };

  const onMove = (m: BoardMove) => {
    const r = tryUciMove(ex.fen, `${m.from}${m.to}${m.promotion ?? ''}`);
    if (!r) return false;
    submit(`${m.from}${m.to}${m.promotion ?? ''}`, r.move.san, r.fen);
    return true;
  };

  const next = () => {
    const r: DiagnosticItemResult = {
      exerciseId: ex.id,
      competences: item.competences as Competence[],
      difficulty: ex.difficulty,
      correct: answer!.correct,
      timeMs: answer!.timeMs,
      ...(item.justify ? { reasonCorrect: reason === item.justify.correct } : {}),
      ...(reasoning.trim() ? { reasoning: reasoning.trim() } : {}),
    };
    const base = { outcome: answer!.correct ? ('solved' as const) : ('revealed' as const), hintsUsed: 0, wrongMoves: answer!.correct ? 0 : 1, durationMs: answer!.timeMs, difficulty: ex.difficulty };
    const attempt: Attempt = {
      id: uid('att'), exerciseId: ex.id, theme: ex.theme, concepts: ex.concepts, startedAt: new Date(start.current).toISOString(),
      firstTry: answer!.correct, reasoning: r.reasoning, quality: attemptQuality(base), context: 'diagnostic', ...base,
    };
    onDone(r, attempt);
  };

  const ready = answer && (!item.justify || reason !== null);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="mx-auto w-full max-w-[min(100%,620px)]">
        <ChessBoard
          fen={answer?.fen ?? ex.fen}
          orientation={color === 'w' ? 'white' : 'black'}
          movable={kind === 'move' && !answer ? color : 'none'}
          onMove={kind === 'move' ? onMove : undefined}
          lastMove={answer?.move ?? null}
          id={`diag-${ex.id}`}
        />
      </div>
      <div className="space-y-4">
        <div>
          <Badge variant="outline">Dificultat: {difficultyLabel(ex.difficulty)}</Badge>
          <p className="mt-2 font-medium">{color === 'w' ? 'Juguen les blanques.' : 'Juguen les negres.'} {kind === 'move' ? ex.objective : ex.question}</p>
          {kind === 'move' && !answer && <p className="text-sm text-muted-foreground">Mou una peça al tauler. Compta la primera jugada.</p>}
        </div>
        {kind !== 'move' && (
          <div className="grid grid-cols-3 gap-2">
            {options.map((o) => (
              <button key={o.uci} type="button" disabled={!!answer} onClick={() => submit(o.uci, o.san)}
                className={cn('cursor-pointer rounded-lg border p-3 font-mono font-semibold disabled:cursor-default',
                  answer && o.san === answer.label ? (answer.correct ? 'border-success bg-success/10' : 'border-danger bg-danger/10') : 'border-border bg-card hover:border-primary')}>
                {kind === 'threat' ? '…' : ''}{o.san}
              </button>
            ))}
          </div>
        )}
        {answer && (
          <div className="space-y-3 animate-fade-in">
            <p className={cn('flex items-center gap-2 text-sm', answer.correct ? 'text-success' : 'text-danger')} role="status">
              {answer.correct ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
              {answer.correct ? 'Correcte.' : 'No era la millor resposta.'} Ho repassarem a les sessions.
            </p>
            {item.justify && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-sm font-medium">{item.justify.question}</p>
                {item.justify.options.map((o, i) => (
                  <label key={o} className="flex cursor-pointer items-start gap-2 text-sm">
                    <input type="radio" name={`why-${ex.id}`} checked={reason === i} onChange={() => setReason(i)} className="mt-1" />
                    {o}
                  </label>
                ))}
                <Label htmlFor={`why-text-${ex.id}`} className="block pt-1 text-xs text-muted-foreground">Amb les teves paraules (opcional)</Label>
                <Textarea id={`why-text-${ex.id}`} value={reasoning} onChange={(e) => setReasoning(e.target.value)} className="min-h-14" />
              </div>
            )}
            <Button onClick={next} disabled={!ready}>Següent</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function DiagnosticResults({ result }: { result: DiagnosticResult }) {
  const weak = weakCompetences(result);
  const entries = (Object.entries(result.competences) as [Competence, { score: number; n: number }][]).sort((a, b) => b[1].score - a[1].score);
  return (
    <div className="mx-auto max-w-2xl space-y-5 animate-fade-in">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><ClipboardCheck className="size-6 text-primary" /> El teu perfil inicial</h1>
      <Card>
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div>
            <p className="text-sm text-muted-foreground">Nivell inicial d'entrenament</p>
            <p className="text-2xl font-semibold">
              {result.startDifficulty} / 5 · {difficultyLabel(result.startDifficulty)}
              {result.provisional && <Badge variant="warning" className="ml-2 align-middle">Provisional</Badge>}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {result.stoppedEarly
                ? `Hem aturat el diagnòstic després de ${result.items.length} posicions per no fer-lo massa llarg. El nivell s'ajustarà amb les sessions.`
                : `Basat en ${result.items.length} posicions. És una mètrica interna de ChessLab, no un ELO.`}
            </p>
          </div>
          <div className="space-y-2">
            {entries.map(([c, v]) => (
              <div key={c} className="grid grid-cols-[160px_1fr_auto] items-center gap-3 text-sm">
                <span>{COMPETENCE_LABELS[c]}</span>
                <Progress value={v.score * 100} label={COMPETENCE_LABELS[c]} />
                <span className="w-24 text-right text-xs text-muted-foreground">{Math.round(v.score * 100)}% · {v.n} ítem{v.n > 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
          {weak.length > 0 && (
            <p className="rounded-md bg-secondary p-3 text-sm text-secondary-foreground">
              Començarem reforçant: {weak.map((c) => COMPETENCE_LABELS[c].toLowerCase()).join(', ')}. Les sessions hi dedicaran un bloc de punt feble.
            </p>
          )}
          <Link to="/"><Button>Veure el pla d'avui <ArrowRight /></Button></Link>
        </CardContent>
      </Card>
    </div>
  );
}
