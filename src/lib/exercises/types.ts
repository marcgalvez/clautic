export type ExerciseCategory = 'tactics' | 'strategy' | 'endgame' | 'opening';

export type TacticalTheme =
  | 'hanging-piece'
  | 'fork'
  | 'pin'
  | 'skewer'
  | 'discovered-attack'
  | 'double-attack'
  | 'deflection'
  | 'attraction'
  | 'mate'
  | 'back-rank'
  | 'smothered-mate'
  | 'combination'
  | 'threat-detection';

export type Difficulty = 1 | 2 | 3 | 4 | 5;

/**
 * - move: play the solution on the board (default).
 * - choice: pick the best of several candidate moves (engine-verified gap).
 * - threat: identify what the OPPONENT threatens (verified by passing the move to them).
 */
export type ExerciseKind = 'move' | 'choice' | 'threat';

export interface Exercise {
  id: string;
  kind?: ExerciseKind;
  /** Candidate moves (UCI) for choice/threat exercises. For threat, they are opponent moves. */
  options?: string[];
  /** Question shown for choice/threat exercises. */
  question?: string;
  /** Overrides the goal inferred from the objective text. */
  goal?: 'win' | 'draw' | 'mate';
  category: ExerciseCategory;
  theme: TacticalTheme | string;
  title: string;
  fen: string;
  /** What the solver must achieve, e.g. "Fes mat en 2." */
  objective: string;
  difficulty: Difficulty;
  /**
   * Main line in UCI notation. Even indexes are the solver's moves, odd indexes
   * are the opponent's replies (played automatically by the app).
   */
  solution: string[];
  /** Extra accepted solver moves per ply index (only when equally good). */
  alternatives?: Record<string, string[]>;
  /** Progressive hints: general question → concrete area → near-solution. */
  hints: [string, string, string];
  explanation: string;
  /** Pedagogical concept ids trained by the exercise. */
  concepts: string[];
  tags: string[];
  /** Exercises generated from the user's games. */
  origin?: { kind: 'game'; gameId: string; ply: number };
  /** In-app verification record for generated exercises (built-in ones use verification.json). */
  inlineVerification?: { engine: string; depth: number; bestScore: string; secondScore: string | null; verifiedAt: string };
}

export interface VerificationEntry {
  fingerprint: string;
  status: 'passed' | 'failed';
  problems: string[];
}

export interface VerificationFile {
  engine: string;
  depth: number;
  generatedAt: string;
  entries: Record<string, VerificationEntry>;
}
