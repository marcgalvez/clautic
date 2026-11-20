export type GameSource = 'pgn' | 'lichess' | 'chesscom';

export type MoveClass = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

/** Error categories from the specification. */
export type ErrorType = 'hanging-piece' | 'missed-threat' | 'calculation' | 'opening' | 'positional' | 'endgame' | 'rushed';

/**
 * How solid the classification is:
 * - engine-verified: follows directly from engine data + board facts (e.g. a piece left en prise).
 * - heuristic: plausible pattern, may be wrong.
 * - needs-evidence: interpretation that needs more games to confirm.
 */
export type Confidence = 'engine-verified' | 'heuristic' | 'needs-evidence';

export interface MoveAnalysis {
  ply: number;
  /** Move number and side, for display. */
  moveNumber: number;
  color: 'w' | 'b';
  san: string;
  uci: string;
  fenBefore: string;
  /** Engine best move in the position before (UCI) and its SAN. */
  bestUci: string | null;
  bestSan: string | null;
  /** Expected score (0-100) for the side that moved, before and after the move. */
  winBefore: number;
  winAfter: number;
  /** White-relative centipawns (mate clamped to ±10000) for charts. */
  evalAfterCp: number;
  classification: MoveClass;
  errorType?: ErrorType;
  errorConfidence?: Confidence;
  /** Plain explanation built only from engine/board facts. */
  facts?: string[];
  /** Seconds spent on the move when the PGN has clock data. */
  timeSpentSec?: number;
  /** Engine line after the best move (UCI), for exercise generation. */
  bestLine?: string[];
}

export interface GameReport {
  userColor: 'w' | 'b';
  result: string;
  /** 0-100 Lichess-style accuracy for the user. */
  accuracy: number;
  counts: Record<MoveClass, number>;
  errorTypes: Partial<Record<ErrorType, number>>;
  /** Plies where the evaluation swung the most against the user. */
  criticalPlies: number[];
  /** Ply where the game was decided against the user, if any. */
  decisivePly: number | null;
  /** Short verdict sentences grounded in the data. */
  verdict: string[];
  /** What to train, mapped to lessons/themes. */
  recommendations: { conceptId: string; reason: string }[];
}

export interface StoredGame {
  id: string;
  source: GameSource;
  externalId?: string;
  pgn: string;
  headers: Record<string, string>;
  userColor: 'w' | 'b' | null;
  playedAt?: string;
  importedAt: string;
  analysis?: {
    depth: number;
    analysedAt: string;
    moves: MoveAnalysis[];
    report: GameReport;
  };
  /** Ids of exercises generated from this game. */
  exerciseIds?: string[];
}
