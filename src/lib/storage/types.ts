export type SessionMinutes = 10 | 15 | 20 | 30 | 45;
export const SESSION_MINUTES: SessionMinutes[] = [10, 15, 20, 30, 45];

export type Locale = 'ca' | 'es' | 'en';

export interface UserProfile {
  id: string;
  displayName: string;
  createdAt: string;
  sessionMinutes: SessionMinutes;
  locale: Locale;
  /** Lichess username for imports (public data only). */
  lichessUsername?: string;
  chesscomUsername?: string;
}

export type AttemptOutcome = 'solved' | 'solved-with-help' | 'revealed' | 'abandoned';

export interface Attempt {
  id: string;
  exerciseId: string;
  theme: string;
  concepts: string[];
  difficulty: number;
  startedAt: string;
  durationMs: number;
  outcome: AttemptOutcome;
  /** Moves played by the user that were not accepted. */
  wrongMoves: number;
  hintsUsed: number;
  /** Solved with no wrong move and no hint. */
  firstTry: boolean;
  /** Optional free-text justification written by the user. */
  reasoning?: string;
  /** 0..1 learning-quality score derived from the attempt (see scoring.ts). */
  quality: number;
  context: 'session' | 'free' | 'diagnostic';
  sessionId?: string;
}

export interface RecallAnswer {
  questionId: string;
  correct: boolean;
  answer: string;
}

export interface TrainingSession {
  id: string;
  lessonId: string;
  plannedMinutes: SessionMinutes;
  startedAt: string;
  completedAt?: string;
  exerciseIds: string[];
  attemptIds: string[];
  recall: RecallAnswer[];
  reflection?: { learned: string; confidence: 1 | 2 | 3 | 4 | 5 };
}

/** Spaced-repetition state of a concept (not of a single position). */
export interface ReviewItem {
  conceptId: string;
  /** Index into the interval ladder (0 => 1 day). */
  stage: number;
  intervalDays: number;
  dueAt: string;
  lastReviewedAt: string;
  lastQuality: number;
  reviews: number;
}

/** Competences assessed by the diagnostic and tracked over time. */
export type Competence = 'tactics' | 'calculation' | 'opening' | 'positional' | 'endgame' | 'threats' | 'justification';

export type RatingPlatform = 'lichess' | 'chesscom' | 'fide';
export type TimeControl = 'bullet' | 'blitz' | 'rapid' | 'classical' | 'correspondence' | 'standard';

/** A rating from an external platform. Never converted or mixed across platforms/time controls. */
export interface ExternalRating {
  id: string;
  platform: RatingPlatform;
  timeControl: TimeControl;
  rating: number;
  /** Lichess/Chess.com provisional flag when known. */
  provisional?: boolean;
  source: 'self-reported' | 'api';
  username?: string;
  recordedAt: string;
}

export interface DiagnosticItemResult {
  exerciseId: string;
  competences: Competence[];
  difficulty: number;
  correct: boolean;
  timeMs: number;
  /** Justification multiple choice result, when the item asked for it. */
  reasonCorrect?: boolean;
  reasoning?: string;
}

export interface DiagnosticResult {
  id: string;
  completedAt: string;
  questionnaire: {
    knowsRules: boolean;
    playsRegularly: 'no' | 'occasionally' | 'weekly' | 'daily';
    goals: string[];
  };
  items: DiagnosticItemResult[];
  /** 0..1 per competence; `n` = items that measured it. */
  competences: Partial<Record<Competence, { score: number; n: number }>>;
  /** Initial training difficulty (1-5) suggested by the results. */
  startDifficulty: number;
  /** True when too few items were answered for a reliable estimate. */
  provisional: boolean;
  stoppedEarly: boolean;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  engineDepth: number;
  showCoordinates: boolean;
  /** Evaluation shown from White's view or from the player's side. */
  evalPerspective: 'white' | 'player';
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  engineDepth: 18,
  showCoordinates: true,
  evalPerspective: 'white',
};

export interface AppData {
  version: 1;
  profile: UserProfile | null;
  attempts: Attempt[];
  sessions: TrainingSession[];
  reviews: ReviewItem[];
  settings: AppSettings;
  diagnostics: DiagnosticResult[];
  externalRatings: ExternalRating[];
  games: import('@/lib/games/types').StoredGame[];
  customExercises: import('@/lib/exercises/types').Exercise[];
  coachConversations: import('@/lib/coach/types').CoachConversation[];
}

export const EMPTY_DATA: AppData = {
  version: 1,
  profile: null,
  attempts: [],
  sessions: [],
  reviews: [],
  settings: DEFAULT_SETTINGS,
  diagnostics: [],
  externalRatings: [],
  games: [],
  customExercises: [],
  coachConversations: [],
};
