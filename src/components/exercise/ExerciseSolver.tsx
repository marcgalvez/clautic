import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chess } from 'chess.js';
import { CheckCircle2, Eye, Lightbulb, RotateCcw, SearchCode, Timer, XCircle } from 'lucide-react';
import { ChessBoard, type BoardMove } from '@/components/board/ChessBoard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/input';
import { ThinkingChecklist } from './ThinkingChecklist';
import type { Exercise } from '@/lib/exercises/types';
import type { Attempt } from '@/lib/storage/types';
import { parseUciMove, formatScore, negate, type EngineScore } from '@/lib/engine/uci';
import { getEngine } from '@/lib/engine/stockfishClient';
import { uciLineToSan, formatSanLine, tryUciMove } from '@/lib/chess/game';
import { flipTurn } from '@/lib/exercises/validate';
import { attemptQuality, outcomeOf } from '@/lib/training/scoring';
import { difficultyLabel, themeLabel } from '@/lib/exercises/themes';
import { formatDuration, uid } from '@/lib/utils';
import { useData } from '@/state/DataProvider';
import { CoachBox, type CoachAction } from '@/components/coach/CoachBox';
import { buildFacts, quickLines } from '@/lib/coach/facts';
import { targetDifficulty } from '@/lib/training/sessionPlan';

type Status = 'solving' | 'opponent' | 'wrong' | 'solved' | 'revealed';

interface Refutation {
  loading: boolean;
  text?: string;
  error?: string;
}

export function ExerciseSolver({
  exercise,
  context,
  sessionId,
  onDone,
  doneLabel = 'Següent',
}: {
  exercise: Exercise;
  context: Attempt['context'];
  sessionId?: string;
  onDone?: (attempt: Attempt) => void;
  doneLabel?: string;
}) {
  const { addAttempt, data } = useData();
  const solverColor = useMemo(() => (exercise.fen.split(' ')[1] === 'b' ? 'b' : 'w'), [exercise.fen]);
  const [fen, setFen] = useState(exercise.fen);
  const [ply, setPly] = useState(0);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [status, setStatus] = useState<Status>('solving');
  const [wrongMoves, setWrongMoves] = useState(0);
  const [hintsShown, setHintsShown] = useState(0);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'bad' | 'info'; text: string } | null>(null);
  const [lastWrong, setLastWrong] = useState<{ fen: string; san: string } | null>(null);
  const [refutation, setRefutation] = useState<Refutation | null>(null);
  const [reasoning, setReasoning] = useState('');
  const [explanationVisible, setExplanationVisible] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const kind = exercise.kind ?? 'move';
  const isChoice = kind !== 'move';
  const optionFen = kind === 'threat' ? flipTurn(exercise.fen) : exercise.fen;
  const options = useMemo(
    () => (exercise.options ?? []).map((u) => ({ uci: u, san: tryUciMove(optionFen, u)?.move.san ?? u })),
    [exercise.options, optionFen],
  );
  const [rejected, setRejected] = useState<string[]>([]);
  const [aiHints, setAiHints] = useState(0);
  const wrongList = useRef<{ fen: string; uci: string }[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const startRef = useRef(Date.now());
  const endRef = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const recorded = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    const pending = timers.current;
    return () => {
      window.clearInterval(id);
      pending.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const finished = status === 'solved' || status === 'revealed';
  const elapsed = (endRef.current ?? now) - startRef.current;

  const finish = (s: 'solved' | 'revealed') => {
    endRef.current = Date.now();
    setStatus(s);
  };

  const playOpponent = (fromFen: string, nextPly: number) => {
    const reply = exercise.solution[nextPly];
    if (!reply) {
      finish('solved');
      return;
    }
    setStatus('opponent');
    later(() => {
      try {
        const g = new Chess(fromFen);
        const m = g.move(parseUciMove(reply));
        setFen(g.fen());
        setLastMove({ from: m.from, to: m.to });
        setPly(nextPly + 1);
        setStatus('solving');
        setFeedback({ tone: 'ok', text: `Bé! El rival respon ${m.san}. Continua.` });
      } catch {
        finish('solved');
      }
    }, 550);
  };

  const onMove = (move: BoardMove): boolean => {
    if (status !== 'solving') return false;
    const g = new Chess(fen);
    let played;
    try {
      played = g.move(move);
    } catch {
      return false;
    }
    const uci = `${played.from}${played.to}${played.promotion ?? ''}`;
    const accepted = [exercise.solution[ply], ...(exercise.alternatives?.[String(ply)] ?? [])];
    const correct = accepted.includes(uci) || g.isCheckmate();
    setFen(g.fen());
    setLastMove({ from: played.from, to: played.to });
    if (correct) {
      setLastWrong(null);
      setRefutation(null);
      if (g.isCheckmate() || ply + 1 >= exercise.solution.length) {
        setFeedback({ tone: 'ok', text: g.isCheckmate() ? `${played.san} — escac i mat!` : `${played.san} — correcte!` });
        finish('solved');
      } else {
        setFeedback({ tone: 'ok', text: `${played.san} — bona jugada!` });
        playOpponent(g.fen(), ply + 1);
      }
      return true;
    }
    // Wrong: show the move briefly, then take it back.
    const before = fen;
    wrongList.current.push({ fen: before, uci });
    const n = wrongMoves + 1;
    setWrongMoves(n);
    setStatus('wrong');
    setLastWrong({ fen: g.fen(), san: played.san });
    setRefutation(null);
    setFeedback({
      tone: 'bad',
      text:
        hintsShown < 3
          ? `${played.san} no és la millor jugada. Torna-ho a provar${n === 1 ? '' : ''} o demana una pista.`
          : `${played.san} no és la millor jugada. Ja pots veure la solució si ho necessites.`,
    });
    later(() => {
      setFen(before);
      setLastMove(null);
      setStatus('solving');
    }, 900);
    return true;
  };

  const choose = (uci: string) => {
    if (finished || rejected.includes(uci)) return;
    const opt = options.find((o) => o.uci === uci)!;
    if (uci === exercise.solution[0]) {
      setLastMove({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
      setFeedback({ tone: 'ok', text: `${opt.san} — correcte!` });
      setLastWrong(null);
      finish('solved');
      return;
    }
    setWrongMoves((n) => n + 1);
    setRejected((r) => [...r, uci]);
    if (kind === 'choice') wrongList.current.push({ fen: exercise.fen, uci });
    setRefutation(null);
    // only a real candidate move (not an opponent threat) can be refuted by the engine
    setLastWrong(kind === 'choice' ? { fen: tryUciMove(exercise.fen, uci)!.fen, san: opt.san } : null);
    setFeedback({ tone: 'bad', text: `${opt.san} no és la resposta. Torna-ho a provar o demana una pista.` });
  };

  const showHint = () => setHintsShown((h) => Math.min(3, h + 1));

  const reveal = () => {
    if (finished) return;
    if (isChoice) {
      const sol = exercise.solution[0];
      setLastMove({ from: sol.slice(0, 2), to: sol.slice(2, 4) });
      setFeedback({ tone: 'info', text: `Resposta: ${options.find((o) => o.uci === sol)?.san}` });
      finish('revealed');
      return;
    }
    setStatus('revealed');
    endRef.current = Date.now();
    const remaining = exercise.solution.slice(ply);
    let g = new Chess(fen);
    const sans: string[] = [];
    remaining.forEach((uci, i) => {
      later(() => {
        g = new Chess(g.fen());
        const m = g.move(parseUciMove(uci));
        sans.push(m.san);
        setFen(g.fen());
        setLastMove({ from: m.from, to: m.to });
        if (i === remaining.length - 1) setFeedback({ tone: 'info', text: `Solució: ${formatSanLine(fen, sans)}` });
      }, 400 + i * 700);
    });
  };

  const explainWrong = () => {
    if (!lastWrong) return;
    setRefutation({ loading: true });
    const { promise } = getEngine().analyze(lastWrong.fen, { depth: 14, multiPv: 1 });
    promise
      .then((r) => {
        const line = r.lines[0];
        if (!line) {
          setRefutation({ loading: false, error: 'El motor no ha retornat cap variant.' });
          return;
        }
        // line.score is from the opponent's point of view (side to move after the wrong move)
        const forSolver: EngineScore = negate(line.score);
        const sans = uciLineToSan(lastWrong.fen, line.pv, 4);
        const evalText = formatScore(forSolver);
        const verdict =
          forSolver.type === 'mate'
            ? forSolver.value < 0
              ? 'i reps mat'
              : 'però encara tens un mat'
            : forSolver.value <= -150
              ? 'i perds material o la posició'
              : forSolver.value < 150
                ? 'i l\'avantatge desapareix'
                : 'i guanyes menys del que podries';
        setRefutation({
          loading: false,
          text: `Després de ${lastWrong.san}, el rival pot jugar ${formatSanLine(lastWrong.fen, sans)} ${verdict} (avaluació ${evalText} des del teu punt de vista, Stockfish profunditat ${r.depth}).`,
        });
      })
      .catch((e: Error) => setRefutation({ loading: false, error: `No s'ha pogut analitzar: ${e.message}` }));
  };

  const buildAttempt = (): Attempt => {
    const solved = status === 'solved';
    const revealed = status === 'revealed';
    const base = {
      outcome: outcomeOf({ solved, revealed, hintsUsed: hintsShown + aiHints, wrongMoves }),
      hintsUsed: hintsShown + aiHints,
      wrongMoves,
      durationMs: elapsed,
      difficulty: exercise.difficulty,
    };
    return {
      id: uid('att'),
      exerciseId: exercise.id,
      theme: exercise.theme,
      concepts: exercise.concepts,
      startedAt: new Date(startRef.current).toISOString(),
      firstTry: solved && hintsShown + aiHints === 0 && wrongMoves === 0,
      reasoning: reasoning.trim() || undefined,
      quality: attemptQuality(base),
      context,
      sessionId,
      ...base,
    };
  };

  const complete = () => {
    if (recorded.current) return;
    recorded.current = true;
    const attempt = buildAttempt();
    addAttempt(attempt);
    onDone?.(attempt);
  };

  const level = targetDifficulty(data.attempts, data.diagnostics.at(-1)?.startDifficulty ?? 1);
  const getFacts = async () => {
    const position = finished ? exercise.fen : fen;
    const engineLines = await quickLines(position, 14, finished ? 2 : 1);
    const wrongAttempts = await Promise.all(
      wrongList.current.slice(-3).map(async (w) => {
        const after = tryUciMove(w.fen, w.uci);
        const lines = after ? await quickLines(after.fen, 12, 1) : [];
        return { uci: w.uci, refutation: lines[0]?.pv ?? [], scoreForOpponent: lines[0]?.score };
      }),
    );
    return buildFacts({
      fen: position,
      studentColor: solverColor,
      level,
      objective: kind === 'move' ? exercise.objective : exercise.question,
      engineLines,
      solution: kind === 'threat' ? undefined : exercise.solution.slice(finished ? 0 : ply),
      solutionRevealed: finished,
      explanation: finished ? exercise.explanation : undefined,
      wrongAttempts: kind === 'threat' ? [] : wrongAttempts.filter((w) => w.uci && tryUciMove(position, w.uci)),
    });
  };
  const nextAiHint = Math.min(3, aiHints + 1) as 1 | 2 | 3;
  const solvingActions: CoachAction[] = [{ label: aiHints === 0 ? 'Pista de l\'entrenador' : 'Una altra pista de l\'entrenador', mode: 'hint', hintLevel: nextAiHint, display: `Pista ${nextAiHint}` }];
  const postActions: CoachAction[] = [
    { label: 'Explica-m\'ho', mode: 'explain', display: 'Explica-m\'ho, si us plau.' },
    ...(reasoning.trim() ? [{ label: 'Valora el meu raonament', mode: 'review-reasoning' as const, text: reasoning.trim(), display: reasoning.trim() }] : []),
  ];

  const orientation = solverColor === 'w' ? 'white' : 'black';
  const previous = data.attempts.filter((a) => a.exerciseId === exercise.id);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="mx-auto w-full max-w-[min(100%,640px)]">
        <ChessBoard
          fen={fen}
          orientation={orientation}
          movable={status === 'solving' && !isChoice ? solverColor : 'none'}
          onMove={isChoice ? undefined : onMove}
          lastMove={lastMove}
          arrows={
            isChoice && hovered && !finished
              ? [{ startSquare: hovered.slice(0, 2), endSquare: hovered.slice(2, 4), color: kind === 'threat' ? 'rgba(220,38,38,0.75)' : 'rgba(20,130,230,0.75)' }]
              : []
          }
          showCoordinates={data.settings.showCoordinates}
          id={`ex-${exercise.id}`}
        />
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge>{themeLabel(exercise.theme)}</Badge>
            <Badge variant="outline">Dificultat: {difficultyLabel(exercise.difficulty)}</Badge>
            {previous.length > 0 && <Badge variant="outline">Intents previs: {previous.length}</Badge>}
          </div>
          <h2 className="text-lg font-semibold">{exercise.title}</h2>
          <p className="mt-1 text-sm">
            <span className="font-medium">{solverColor === 'w' ? 'Juguen les blanques.' : 'Juguen les negres.'}</span> {exercise.objective}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Timer className="size-3.5" /> {formatDuration(elapsed)}
          </p>
        </div>

        {!finished && <ThinkingChecklist key={exercise.id} />}

        {isChoice && (
          <div className="space-y-2">
            <p className="font-medium">{exercise.question}</p>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Opcions">
              {options.map((o) => {
                const isSol = finished && o.uci === exercise.solution[0];
                const isRejected = rejected.includes(o.uci);
                return (
                  <button
                    key={o.uci}
                    type="button"
                    onClick={() => choose(o.uci)}
                    onMouseEnter={() => setHovered(o.uci)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(o.uci)}
                    onBlur={() => setHovered(null)}
                    disabled={finished || isRejected}
                    className={
                      'cursor-pointer rounded-lg border p-3 text-center font-mono text-base font-semibold transition-colors disabled:cursor-default ' +
                      (isSol ? 'border-success bg-success/10 text-success' : isRejected ? 'border-danger/50 bg-danger/10 text-danger line-through' : 'border-border bg-card hover:border-primary hover:bg-secondary')
                    }
                  >
                    {kind === 'threat' ? '…' : ''}{o.san}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {feedback && (
          <div
            role="status"
            aria-live="polite"
            className={
              'flex items-start gap-2 rounded-md p-3 text-sm animate-fade-in ' +
              (feedback.tone === 'ok' ? 'bg-success/10 text-success' : feedback.tone === 'bad' ? 'bg-danger/10 text-danger' : 'bg-secondary text-secondary-foreground')
            }
          >
            {feedback.tone === 'ok' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : feedback.tone === 'bad' ? <XCircle className="mt-0.5 size-4 shrink-0" /> : <Eye className="mt-0.5 size-4 shrink-0" />}
            <span>{feedback.text}</span>
          </div>
        )}

        {!finished && lastWrong && (
          <div className="rounded-md border border-border p-3 text-sm">
            {!refutation && (
              <Button variant="ghost" size="sm" onClick={explainWrong}>
                <SearchCode /> Per què no funciona {lastWrong.san}?
              </Button>
            )}
            {refutation?.loading && <p className="text-muted-foreground">Analitzant amb Stockfish…</p>}
            {refutation?.text && <p>{refutation.text}</p>}
            {refutation?.error && <p className="text-danger">{refutation.error}</p>}
          </div>
        )}

        {hintsShown > 0 && (
          <ol className="space-y-2" aria-label="Pistes">
            {exercise.hints.slice(0, hintsShown).map((h, i) => (
              <li key={i} className="flex gap-2 rounded-md bg-accent/10 p-3 text-sm animate-fade-in">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>
                  <span className="font-medium">Pista {i + 1}:</span> {h}
                </span>
              </li>
            ))}
          </ol>
        )}

        {!finished && (
          <CoachBox
            key={`solve-${exercise.id}`}
            context={{ kind: 'exercise', exerciseId: exercise.id }}
            getFacts={getFacts}
            actions={solvingActions}
            allowQuestions={false}
            onAction={() => setAiHints((n) => n + 1)}
          />
        )}

        {!finished && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={showHint} disabled={hintsShown >= 3 || status === 'opponent'}>
              <Lightbulb /> {hintsShown === 0 ? 'Vull una pista' : hintsShown < 3 ? 'Una pista més concreta' : 'No queden pistes'}
            </Button>
            <Button
              variant="outline"
              onClick={reveal}
              disabled={wrongMoves === 0 || status === 'opponent'}
              title={wrongMoves === 0 ? 'Primer intenta-ho: fes almenys una jugada.' : undefined}
            >
              <Eye /> Mostra la solució
            </Button>
            {wrongMoves === 0 && <p className="w-full text-xs text-muted-foreground">La solució es desbloqueja quan hagis fet almenys un intent.</p>}
          </div>
        )}

        {finished && (
          <div className="space-y-3 animate-fade-in">
            {!explanationVisible ? (
              <div className="space-y-2 rounded-lg border border-border p-4">
                <p className="text-sm font-medium">
                  {status === 'solved' ? 'Abans de veure l\'explicació: per què funciona aquesta jugada?' : 'Mira la solució al tauler. Amb les teves paraules: quina era la idea?'}
                </p>
                <Textarea
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  placeholder="Ex.: el cavall fa escac i alhora ataca la dama…"
                  aria-label="El teu raonament"
                />
                <p className="text-xs text-muted-foreground">Explicar el raonament ajuda a fixar el patró. És opcional i queda desat amb l'intent.</p>
                <Button onClick={() => setExplanationVisible(true)}>Mostra l'explicació</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg bg-secondary p-4 text-sm text-secondary-foreground">
                  <p className="mb-1 font-semibold">Explicació</p>
                  <p>{exercise.explanation}</p>
                </div>
                <CoachBox
                  key={`post-${exercise.id}`}
                  context={{ kind: 'exercise', exerciseId: exercise.id }}
                  getFacts={getFacts}
                  actions={postActions}
                  placeholder="Tens dubtes sobre la solució? Pregunta…"
                />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={complete}>{doneLabel}</Button>
                  <Link
                    to={`/analisi?fen=${encodeURIComponent(exercise.fen)}`}
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-input px-4 text-sm font-medium hover:bg-muted"
                  >
                    <RotateCcw className="size-4" /> Analitza la posició
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
