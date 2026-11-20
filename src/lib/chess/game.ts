import { Chess, type Move, type Square } from 'chess.js';
import { parseUciMove } from '@/lib/engine/uci';

export type GameStatus =
  | { kind: 'playing'; check: boolean }
  | { kind: 'checkmate'; winner: 'w' | 'b' }
  | { kind: 'stalemate' }
  | { kind: 'draw'; reason: 'insufficient-material' | 'threefold-repetition' | 'fifty-moves' };

/** Status of a position. Threefold repetition requires the game history. */
export function gameStatus(game: Chess): GameStatus {
  if (game.isCheckmate()) return { kind: 'checkmate', winner: game.turn() === 'w' ? 'b' : 'w' };
  if (game.isStalemate()) return { kind: 'stalemate' };
  if (game.isInsufficientMaterial()) return { kind: 'draw', reason: 'insufficient-material' };
  if (game.isThreefoldRepetition()) return { kind: 'draw', reason: 'threefold-repetition' };
  if (game.isDrawByFiftyMoves()) return { kind: 'draw', reason: 'fifty-moves' };
  return { kind: 'playing', check: game.isCheck() };
}

/** Plays a UCI move on a copy; returns the move or null if illegal. */
export function tryUciMove(fen: string, uci: string): { move: Move; fen: string } | null {
  try {
    const g = new Chess(fen);
    const move = g.move(parseUciMove(uci));
    return { move, fen: g.fen() };
  } catch {
    return null;
  }
}

export function legalTargets(game: Chess, from: Square): Square[] {
  return game.moves({ square: from, verbose: true }).map((m) => m.to);
}

/** True if moving from→to is a pawn promotion (legal promotion moves exist). */
export function isPromotionMove(game: Chess, from: Square, to: Square): boolean {
  return game.moves({ square: from, verbose: true }).some((m) => m.to === to && !!m.promotion);
}

export function uciOf(move: Pick<Move, 'from' | 'to' | 'promotion'>): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

/** Converts a UCI line into SAN strings starting at `fen`; stops at first illegal move. */
export function uciLineToSan(fen: string, line: string[], max = line.length): string[] {
  const out: string[] = [];
  let g: Chess;
  try {
    g = new Chess(fen);
  } catch {
    return out;
  }
  for (const uci of line.slice(0, max)) {
    try {
      out.push(g.move(parseUciMove(uci)).san);
    } catch {
      break;
    }
  }
  return out;
}

/** Formats SAN moves with move numbers, e.g. "12. Nf3 Nc6 13. O-O" or "12... Nc6 13. O-O". */
export function formatSanLine(fen: string, sans: string[]): string {
  const parts = fen.split(' ');
  let moveNo = Number(parts[5] ?? 1);
  let white = parts[1] !== 'b';
  const out: string[] = [];
  sans.forEach((san, i) => {
    if (white) out.push(`${moveNo}. ${san}`);
    else out.push(i === 0 ? `${moveNo}... ${san}` : san);
    if (!white) moveNo++;
    white = !white;
  });
  return out.join(' ');
}

export function sideToMove(fen: string): 'w' | 'b' {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w';
}

/** Find the king square of the side to move (for check highlighting). */
export function kingSquare(game: Chess, color: 'w' | 'b'): Square | null {
  for (const row of game.board()) {
    for (const p of row) if (p && p.type === 'k' && p.color === color) return p.square;
  }
  return null;
}
