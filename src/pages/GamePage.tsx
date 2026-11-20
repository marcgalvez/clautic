import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Puzzle, Target } from 'lucide-react';
import { ChessBoard } from '@/components/board/ChessBoard';
import { LineChart } from '@/components/charts/LineChart';
import { CoachBox } from '@/components/coach/CoachBox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/state/DataProvider';
import { ERROR_TYPE_LABELS } from '@/lib/games/patterns';
import { buildFacts, quickLines } from '@/lib/coach/facts';
import { tryUciMove } from '@/lib/chess/game';
import { conceptLabel } from '@/data/concepts';
import { sanToCatalan } from '../../supabase/functions/_shared/coach-core.ts';
import type { MoveAnalysis, MoveClass } from '@/lib/games/types';
import { cn } from '@/lib/utils';

const CLASS_STYLE: Record<MoveClass, { mark: string; cls: string; label: string }> = {
  best: { mark: '', cls: '', label: 'Millor jugada' },
  good: { mark: '', cls: '', label: 'Bona' },
  inaccuracy: { mark: '?!', cls: 'text-warning', label: 'Imprecisió' },
  mistake: { mark: '?', cls: 'text-accent', label: 'Error' },
  blunder: { mark: '??', cls: 'text-danger', label: 'Error greu' },
};

const CONFIDENCE_LABEL = { 'engine-verified': 'verificat pel motor', heuristic: 'interpretació probable', 'needs-evidence': 'cal més evidència' } as const;

export function GamePage() {
  const { id } = useParams();
  const { data } = useData();
  const game = data.games.find((g) => g.id === id);
  const [ply, setPly] = useState(0);
  const moves = game?.analysis?.moves ?? [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') setPly((p) => Math.max(0, p - 1));
      if (e.key === 'ArrowRight') setPly((p) => Math.min(moves.length, p + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moves.length]);

  const fenAt = (p: number) => (p === 0 ? moves[0]?.fenBefore : moves[p]?.fenBefore ?? null);

  if (!game || !game.analysis) {
    return (
      <div className="space-y-3">
        <p>{game ? 'Aquesta partida encara no està analitzada.' : 'No s\'ha trobat la partida.'}</p>
        <Link to="/partides" className="text-primary underline">Torna a les partides</Link>
      </div>
    );
  }

  const { report } = game.analysis;
  const current: MoveAnalysis | undefined = ply > 0 ? moves[ply - 1] : undefined;
  const boardFen = ply < moves.length ? fenAt(ply)! : lastPositionFen(moves);
  const orientation = game.userColor === 'b' ? 'black' : 'white';
  const evalPoints = moves.map((m) => ({ label: `${m.moveNumber}${m.color === 'w' ? '.' : '...'} ${sanToCatalan(m.san)}`, value: Math.max(-10, Math.min(10, m.evalAfterCp / 100)) }));
  const arrows = current && current.bestUci && current.bestUci !== current.uci && (current.classification === 'mistake' || current.classification === 'blunder' || current.classification === 'inaccuracy')
    ? [{ startSquare: current.bestUci.slice(0, 2), endSquare: current.bestUci.slice(2, 4), color: 'rgba(34,160,90,0.8)' }]
    : [];
  const exercises = data.customExercises.filter((e) => game.exerciseIds?.includes(e.id));
  const notes = [
    ...report.verdict,
    ...moves.filter((m) => m.facts?.length).slice(0, 6).map((m) => `${m.moveNumber}${m.color === 'w' ? '.' : '...'} ${m.san} (${CLASS_STYLE[m.classification].label.toLowerCase()}, ${m.errorType ? ERROR_TYPE_LABELS[m.errorType] : ''}, ${m.errorConfidence ? CONFIDENCE_LABEL[m.errorConfidence] : ''}): ${m.facts!.join(' ')} Millor: ${m.bestSan ?? '?'}.`),
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <Link to="/partides" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> Partides</Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{game.headers.White ?? '?'} – {game.headers.Black ?? '?'} <span className="text-muted-foreground">{game.headers.Result}</span></h1>
        <p className="text-sm text-muted-foreground">
          {game.headers.Event ?? ''} {game.headers.Opening ? `· ${game.headers.Opening}` : ''} · anàlisi a profunditat {game.analysis.depth}
        </p>
      </div>

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Target className="size-4" /> Per què ha anat així i què has d'entrenar</CardTitle>
          <CardDescription>Les dades objectives venen de Stockfish; les interpretacions s'indiquen com a tals.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ul className="space-y-1.5">
            {report.verdict.map((v) => <li key={v}>{sanToCatalan(v)}</li>)}
          </ul>
          {report.recommendations.length > 0 && (
            <div className="rounded-md bg-secondary p-3 text-secondary-foreground">
              <p className="font-medium">Entrena:</p>
              <ul className="mt-1 list-disc pl-5">
                {report.recommendations.map((r) => <li key={r.conceptId}><strong>{conceptLabel(r.conceptId)}</strong>, {r.reason}</li>)}
              </ul>
              <p className="mt-2 text-xs">Aquests conceptes s'incorporen al pla quan es repeteixen en dues partides o més.</p>
            </div>
          )}
          {report.criticalPlies.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Moments crítics:</span>
              {report.criticalPlies.map((p) => {
                const m = moves[p - 1];
                return (
                  <Button key={p} size="sm" variant="outline" onClick={() => setPly(p)}>
                    {m.moveNumber}{m.color === 'w' ? '.' : '...'} {sanToCatalan(m.san)}{CLASS_STYLE[m.classification].mark}
                  </Button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3">
          <div className="mx-auto w-full max-w-[min(100%,620px)]">
            <ChessBoard fen={boardFen} orientation={orientation} movable="none" lastMove={current ? { from: current.uci.slice(0, 2), to: current.uci.slice(2, 4) } : null} arrows={arrows} id="game-board" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="icon" aria-label="Jugada anterior" onClick={() => setPly(Math.max(0, ply - 1))}><ChevronLeft /></Button>
            <span className="min-w-28 text-center text-sm tabular-nums">{current ? `${current.moveNumber}${current.color === 'w' ? '.' : '...'} ${sanToCatalan(current.san)}` : 'Inici'}</span>
            <Button variant="outline" size="icon" aria-label="Jugada següent" onClick={() => setPly(Math.min(moves.length, ply + 1))}><ChevronRight /></Button>
          </div>
          {current && (
            <div className={cn('rounded-lg border border-border p-3 text-sm', current.classification === 'blunder' && 'border-danger/40')}>
              <p>
                <span className={cn('font-semibold', CLASS_STYLE[current.classification].cls)}>{sanToCatalan(current.san)}{CLASS_STYLE[current.classification].mark}</span>{' '}
                · {CLASS_STYLE[current.classification].label} · expectativa {Math.round(current.winBefore)}% → {Math.round(current.winAfter)}%
                {current.timeSpentSec !== undefined && ` · ${Math.round(current.timeSpentSec)} s`}
              </p>
              {current.bestSan && current.bestUci !== current.uci && <p className="mt-1">Stockfish preferia <strong>{sanToCatalan(current.bestSan)}</strong> (fletxa verda).</p>}
              {current.errorType && (
                <p className="mt-1">
                  <Badge variant={current.errorConfidence === 'engine-verified' ? 'danger' : 'outline'}>{ERROR_TYPE_LABELS[current.errorType]}</Badge>{' '}
                  <span className="text-xs text-muted-foreground">{current.errorConfidence ? CONFIDENCE_LABEL[current.errorConfidence] : ''}</span>
                </p>
              )}
              {current.facts?.map((f) => <p key={f} className="mt-1 text-muted-foreground">{sanToCatalan(f)}</p>)}
              <Link to={`/analisi?fen=${encodeURIComponent(current.fenBefore)}`} className="mt-2 inline-block text-xs text-primary underline">Analitza aquesta posició al tauler</Link>
            </div>
          )}
          <Card>
            <CardHeader className="pb-1"><CardTitle>Avaluació</CardTitle><CardDescription>Peons d'avantatge de les blanques (Stockfish), limitat a ±10.</CardDescription></CardHeader>
            <CardContent><LineChart ariaLabel="Evolució de l'avaluació" points={evalPoints} format={(v) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1))} height={130} /></CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle>Jugades</CardTitle></CardHeader>
            <CardContent>
              <div className="max-h-80 overflow-y-auto text-sm leading-7">
                {moves.map((m, i) => (
                  <span key={m.ply}>
                    {m.color === 'w' && <span className="ml-1 text-muted-foreground tabular-nums">{m.moveNumber}.</span>}
                    <button
                      type="button"
                      onClick={() => setPly(i + 1)}
                      className={cn('cursor-pointer rounded px-1 font-medium hover:bg-muted', CLASS_STYLE[m.classification].cls, ply === i + 1 && 'bg-primary text-primary-foreground hover:bg-primary')}
                    >
                      {sanToCatalan(m.san)}{CLASS_STYLE[m.classification].mark}
                    </button>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2"><Puzzle className="size-4" /> Exercicis creats amb els teus errors</CardTitle>
              <CardDescription>Només s'hi inclouen les posicions on Stockfish confirma una solució única.</CardDescription>
            </CardHeader>
            <CardContent>
              {exercises.length ? (
                <ul className="space-y-1.5 text-sm">
                  {exercises.map((e) => <li key={e.id}><Link to={`/exercicis/${e.id}`} className="text-primary hover:underline">{e.title}</Link></li>)}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Cap error d'aquesta partida té una solució prou clara per convertir-lo en exercici.</p>
              )}
            </CardContent>
          </Card>

          <CoachBox
            key={`game-${game.id}`}
            context={{ kind: 'game', gameId: game.id }}
            title="Entrenador"
            actions={[{ label: 'Explica\'m la partida', mode: 'game-review', display: 'Explica\'m per què ha anat així.' }]}
            placeholder="Pregunta sobre la partida…"
            getFacts={async () => {
              const fen = current?.fenBefore ?? moves[0].fenBefore;
              return buildFacts({ fen, studentColor: game.userColor ?? 'w', level: 3, engineLines: await quickLines(fen, 14, 2), solutionRevealed: true, notes });
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** Position after the last move of the analysed mainline. */
function lastPositionFen(moves: MoveAnalysis[]): string {
  const last = moves[moves.length - 1];
  // Replaying one move is cheap and avoids storing an extra FEN.
  return replay(last.fenBefore, last.uci);
}

function replay(fen: string, uci: string): string {
  return tryUciMove(fen, uci)?.fen ?? fen;
}
