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
  | 'combination';

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface Exercise {
  id: string;
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
