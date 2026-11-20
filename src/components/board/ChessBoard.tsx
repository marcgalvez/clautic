import { useMemo, useState, type CSSProperties } from 'react';
import { Chessboard, type Arrow, type PieceDropHandlerArgs, type SquareHandlerArgs } from 'react-chessboard';
import { Chess, type Square } from 'chess.js';
import { isPromotionMove, kingSquare } from '@/lib/chess/game';
import { PromotionPicker } from './PromotionPicker';
import { BoardErrorBoundary } from './BoardErrorBoundary';
import { cn } from '@/lib/utils';

export interface BoardMove {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

export interface ChessBoardProps {
  fen: string;
  orientation?: 'white' | 'black';
  /** Which side the user may move. 'none' makes the board read-only. */
  movable?: 'w' | 'b' | 'both' | 'none' | 'turn';
  /** Called with a legal move. Return false to reject it (board stays). */
  onMove?: (move: BoardMove) => boolean | void;
  /** Square-picking mode (for questions): clicks report squares instead of moving. */
  onSquarePick?: (square: string) => void;
  lastMove?: { from: string; to: string } | null;
  arrows?: Arrow[];
  highlights?: Record<string, string>;
  showCoordinates?: boolean;
  className?: string;
  id?: string;
}

const COLORS = {
  lastMove: 'rgba(250, 204, 21, 0.42)',
  selected: 'rgba(20, 184, 166, 0.55)',
  user: 'rgba(239, 68, 68, 0.55)',
};

export function ChessBoard({
  fen,
  orientation = 'white',
  movable = 'turn',
  onMove,
  onSquarePick,
  lastMove,
  arrows = [],
  highlights = {},
  showCoordinates = true,
  className,
  id = 'chesslab-board',
}: ChessBoardProps) {
  const game = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return null;
    }
  }, [fen]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [userMarks, setUserMarks] = useState<Record<string, boolean>>({});
  const [marksFen, setMarksFen] = useState(fen);

  // Reset transient UI state when the position changes (render-time state sync).
  if (marksFen !== fen) {
    setMarksFen(fen);
    setUserMarks({});
    setSelected(null);
    setPendingPromotion(null);
  }

  const canMoveColor = (color: string) => {
    if (!game || !onMove || movable === 'none') return false;
    if (movable === 'both') return true;
    if (movable === 'turn') return color === game.turn();
    return color === movable && color === game.turn();
  };

  const targets = useMemo(() => {
    if (!game || !selected) return [];
    return game.moves({ square: selected, verbose: true });
  }, [game, selected]);

  const commit = (from: Square, to: Square, promotion?: BoardMove['promotion']) => {
    if (!game || !onMove) return false;
    const legal = game.moves({ square: from, verbose: true }).some((m) => m.to === to && (!m.promotion || m.promotion === promotion));
    if (!legal) return false;
    const res = onMove({ from, to, ...(promotion ? { promotion } : {}) });
    setSelected(null);
    return res !== false;
  };

  const attempt = (from: Square, to: Square): boolean => {
    if (!game) return false;
    if (isPromotionMove(game, from, to)) {
      setPendingPromotion({ from, to });
      setSelected(null);
      return false;
    }
    return commit(from, to);
  };

  const onSquareClick = ({ square, piece }: SquareHandlerArgs) => {
    if (onSquarePick) {
      onSquarePick(square);
      return;
    }
    if (!game) return;
    const sq = square as Square;
    if (selected) {
      if (sq === selected) {
        setSelected(null);
        return;
      }
      if (targets.some((m) => m.to === sq)) {
        attempt(selected, sq);
        return;
      }
    }
    if (piece && canMoveColor(piece.pieceType[0])) setSelected(sq);
    else setSelected(null);
  };

  const onPieceDrop = ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
    if (!targetSquare || sourceSquare === targetSquare) return false;
    return attempt(sourceSquare as Square, targetSquare as Square);
  };

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    if (lastMove) {
      styles[lastMove.from] = { background: COLORS.lastMove };
      styles[lastMove.to] = { background: COLORS.lastMove };
    }
    for (const [sq, color] of Object.entries(highlights)) styles[sq] = { ...styles[sq], background: color };
    for (const sq of Object.keys(userMarks)) styles[sq] = { ...styles[sq], background: COLORS.user };
    if (game?.isCheck()) {
      const k = kingSquare(game, game.turn());
      if (k) styles[k] = { ...styles[k], background: 'radial-gradient(circle, rgba(239,68,68,0.9) 0%, rgba(239,68,68,0.35) 55%, transparent 75%)' };
    }
    if (selected) styles[selected] = { ...styles[selected], background: COLORS.selected };
    for (const m of targets) {
      const capture = !!game?.get(m.to as Square);
      styles[m.to] = {
        ...styles[m.to],
        background: capture
          ? 'radial-gradient(circle, transparent 58%, rgba(15,118,110,0.55) 60%)'
          : 'radial-gradient(circle, rgba(15,118,110,0.5) 22%, transparent 24%)',
        cursor: 'pointer',
      };
    }
    return styles;
  }, [lastMove, highlights, userMarks, game, selected, targets]);

  if (!game) {
    return <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-muted text-sm text-danger">Posició FEN invàlida</div>;
  }

  return (
    <div className={cn('relative w-full select-none', className)} data-testid="chess-board">
      <BoardErrorBoundary resetKey={fen}>
      <Chessboard
        options={{
          id,
          position: fen,
          boardOrientation: orientation,
          showNotation: showCoordinates,
          allowDragging: !onSquarePick && movable !== 'none' && !!onMove,
          canDragPiece: ({ piece }) => canMoveColor(piece.pieceType[0]),
          onPieceDrop,
          onSquareClick,
          onSquareRightClick: ({ square }) => setUserMarks((m) => {
            const next = { ...m };
            if (next[square]) delete next[square];
            else next[square] = true;
            return next;
          }),
          squareStyles,
          arrows,
          allowDrawingArrows: true,
          clearArrowsOnPositionChange: true,
          animationDurationInMs: 180,
          boardStyle: { borderRadius: '10px', overflow: 'hidden', boxShadow: '0 6px 24px -8px rgba(0,0,0,0.35)' },
          darkSquareStyle: { backgroundColor: 'var(--board-dark)' },
          lightSquareStyle: { backgroundColor: 'var(--board-light)' },
        }}
      />
      </BoardErrorBoundary>
      {pendingPromotion && (
        <PromotionPicker
          color={game.turn()}
          onPick={(p) => {
            const { from, to } = pendingPromotion;
            setPendingPromotion(null);
            commit(from, to, p);
          }}
          onCancel={() => setPendingPromotion(null)}
        />
      )}
    </div>
  );
}
