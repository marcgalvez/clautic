import { Chess, type Color } from 'chess.js';
import type { CoachFacts } from '../../../supabase/functions/_shared/coach-core.ts';
import { formatScore, negate, type EngineLine, type EngineScore } from '@/lib/engine/uci';
import { uciLineToSan } from '@/lib/chess/game';
import { loosePieces, opponentThreats, PIECE_NAME_CA } from '@/lib/games/classify';
import { getEngine } from '@/lib/engine/stockfishClient';

export interface FactsInput {
  fen: string;
  studentColor: Color;
  level: number;
  objective?: string;
  /** Engine lines for `fen` (scores from the side to move, UCI convention). */
  engineLines?: EngineLine[];
  solution?: string[]; // UCI
  solutionRevealed?: boolean;
  explanation?: string;
  wrongAttempts?: { uci: string; refutation: string[]; scoreForOpponent?: EngineScore }[];
  notes?: string[];
}

/** Builds the verified facts the coach may use. Nothing here comes from the LLM. */
export function buildFacts(input: FactsInput): CoachFacts {
  const g = new Chess(input.fen);
  const studentToMove = g.turn() === input.studentColor;
  const moves = g.moves({ verbose: true });
  const opp: Color = input.studentColor === 'w' ? 'b' : 'w';
  const describe = (l: { square: string; type: keyof typeof PIECE_NAME_CA }) => `${PIECE_NAME_CA[l.type]} a ${l.square}`;
  const scoreForStudent = (s: EngineScore) => (studentToMove ? s : negate(s));
  return {
    fen: input.fen,
    studentSide: input.studentColor === 'w' ? 'blanques' : 'negres',
    level: input.level,
    objective: input.objective,
    legalMoves: moves.map((m) => m.san),
    checks: studentToMove ? moves.filter((m) => m.san.includes('+') || m.san.includes('#')).map((m) => m.san) : [],
    captures: studentToMove ? moves.filter((m) => m.captured).map((m) => m.san) : [],
    loosePieces: loosePieces(g, input.studentColor).map(describe),
    targets: loosePieces(g, opp).map(describe),
    opponentThreats: studentToMove ? opponentThreats(input.fen).slice(0, 4).map((t) => `${t.san}${t.kind === 'mate' ? ' (mat)' : ''}`) : [],
    engineLines: (input.engineLines ?? []).map((l) => ({ san: uciLineToSan(input.fen, l.pv, 10), evaluation: formatScore(scoreForStudent(l.score)) })),
    solution: input.solution ? uciLineToSan(input.fen, input.solution) : undefined,
    solutionRevealed: input.solutionRevealed,
    explanation: input.explanation,
    wrongAttempts: (input.wrongAttempts ?? []).map((w) => {
      const after = new Chess(input.fen);
      let san = w.uci;
      try {
        san = after.move({ from: w.uci.slice(0, 2), to: w.uci.slice(2, 4), promotion: w.uci[4] }).san;
      } catch {
        /* keep uci */
      }
      return {
        san,
        refutation: uciLineToSan(after.fen(), w.refutation, 6),
        evaluation: w.scoreForOpponent ? formatScore(negate(w.scoreForOpponent)) : '?',
      };
    }),
    notes: input.notes,
  };
}

/** Quick engine analysis for coach facts; resolves to [] if the engine is unavailable. */
export async function quickLines(fen: string, depth = 14, multiPv = 2): Promise<EngineLine[]> {
  try {
    const r = await getEngine().analyze(fen, { depth, multiPv }).promise;
    return r.lines;
  } catch {
    return [];
  }
}
