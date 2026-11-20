import { Cpu, Loader2, TriangleAlert } from 'lucide-react';
import { formatScore, toWhitePov, type EngineLine } from '@/lib/engine/uci';
import { formatSanLine, sideToMove, uciLineToSan } from '@/lib/chess/game';
import type { EngineState } from '@/lib/engine/stockfishClient';
import { cn } from '@/lib/utils';

export function EngineLines({
  fen,
  lines,
  depth,
  running,
  engineState,
  error,
  perspective = 'white',
  onPlayLine,
}: {
  fen: string;
  lines: EngineLine[];
  depth: number;
  running: boolean;
  engineState: EngineState;
  error?: string;
  /** 'white' shows White-relative scores; 'b'/'w' shows from that side. */
  perspective?: 'white' | 'w' | 'b';
  onPlayLine?: (uciMoves: string[]) => void;
}) {
  const stm = sideToMove(fen);
  if (engineState === 'error' || error) {
    return (
      <div className="flex items-start gap-2 rounded-md bg-danger/10 p-3 text-sm text-danger">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <span>{error ?? 'El motor no està disponible.'} Pots continuar fent servir el tauler sense anàlisi.</span>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Cpu className="size-3.5" />
        <span>Stockfish 19 (lite)</span>
        <span aria-live="polite">· profunditat {depth || '–'}</span>
        {(running || engineState === 'loading') && <Loader2 className="size-3.5 animate-spin" aria-label="Calculant" />}
        {engineState === 'loading' && <span>carregant el motor…</span>}
      </div>
      {lines.length === 0 && engineState !== 'loading' && running && <p className="text-sm text-muted-foreground">Calculant…</p>}
      {lines.map((l) => {
        const white = toWhitePov(l.score, stm);
        const shown = perspective === 'white' ? white : perspective === 'w' ? white : { ...white, value: -white.value };
        const sans = uciLineToSan(fen, l.pv, 10);
        const positive = shown.type === 'mate' ? shown.value > 0 : shown.value >= 0;
        return (
          <button
            key={l.multipv}
            type="button"
            onClick={() => onPlayLine?.(l.pv)}
            className="flex w-full cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
            title="Afegeix aquesta variant al tauler"
          >
            <span
              className={cn(
                'min-w-14 rounded px-1.5 py-0.5 text-center font-mono text-xs font-semibold',
                positive ? 'bg-neutral-100 text-neutral-900' : 'bg-neutral-800 text-neutral-100',
              )}
            >
              {formatScore(shown)}
            </span>
            <span className="line-clamp-2 font-mono text-xs leading-5 text-foreground/90">{formatSanLine(fen, sans)}</span>
          </button>
        );
      })}
    </div>
  );
}
