export type BoardQuestion =
  | {
      kind: 'square';
      prompt: string;
      /** Accepted squares. */
      answer: string[];
      /**
       * Machine-checkable claim used by tests to guarantee the answer is true:
       * - hanging: piece on square is attacked by the side to move and not defended.
       * - pinned: piece on square is absolutely pinned to its king.
       * - knight-fork: a knight of the side to move placed on the square attacks all `targets`.
       */
      predicate: 'hanging' | 'pinned' | 'knight-fork';
      targets?: string[];
      correctFeedback: string;
      wrongFeedback: string;
    }
  | {
      kind: 'move';
      prompt: string;
      /** Accepted UCI moves. */
      answer: string[];
      /** mate: the move must give checkmate and be the only mating move. */
      predicate: 'mate';
      correctFeedback: string;
      wrongFeedback: string;
    };

export interface LessonExample {
  fen: string;
  caption: string;
  arrows?: [string, string][];
  highlights?: string[];
  question: BoardQuestion;
}

export interface RecallQuestion {
  id: string;
  prompt: string;
  options: string[];
  correct: number;
  explanation: string;
}

export interface Lesson {
  id: string;
  title: string;
  /** The principle, in one sentence (retrieved later in recall). */
  principle: string;
  conceptIds: string[];
  /** Exercise themes used in the Apply phase. */
  themes: string[];
  /** Suggested order for new users. */
  order: number;
  understand: {
    intro: string[];
    observe: string[];
    example: LessonExample;
  };
  recall: RecallQuestion[];
}
