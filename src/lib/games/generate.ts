import { Chess } from 'chess.js';
import type { EngineLine } from '@/lib/engine/uci';
import { formatScore, winPercent } from '@/lib/engine/uci';
import { uciLineToSan, formatSanLine } from '@/lib/chess/game';
import { sanToCatalan } from '../../../supabase/functions/_shared/coach-core.ts';
import type { Exercise } from '@/lib/exercises/types';
import { positionLegalityProblems } from '@/lib/exercises/validate';
import { ERROR_TYPE_CONCEPTS } from './patterns';
import { PIECE_NAME_CA, isEndgame } from './classify';
import type { MoveAnalysis, StoredGame } from './types';

export type MultiAnalyseFn = (fen: string, depth: number, multiPv: number) => Promise<EngineLine[]>;

const THEME_BY_ERROR: Record<string, string> = {
  'hanging-piece': 'hanging-piece',
  'missed-threat': 'threat-detection',
  calculation: 'combination',
  opening: 'development',
  positional: 'king-safety',
  endgame: 'opposition',
  rushed: 'threat-detection',
};

const HINT_BY_ERROR: Record<string, string> = {
  'hanging-piece': 'A la partida vas deixar una peça indefensa. Abans de moure, revisa quines peces queden sense protecció.',
  'missed-threat': 'Què amenaça el rival? Mira la seva darrera jugada abans de buscar la teva.',
  calculation: 'Revisa amb calma els escacs, les captures i les amenaces, i calcula fins al final cada variant forçada.',
  opening: 'Pensa en els principis: desenvolupament, centre i seguretat del rei.',
  positional: 'No hi ha una tàctica immediata: busca la jugada que millora la teva pitjor peça o la seguretat del rei.',
  endgame: 'Al final, l\'activitat del rei i els peons passats ho decideixen tot.',
  rushed: 'A la partida vas jugar molt de pressa. Pren-te el temps de revisar les jugades forçants.',
};

/** Minimum expected-score gap between the best and second-best move for a fair exercise. */
const MIN_GAP = 15;

/**
 * Turns a user's mistake into an exercise, only if Stockfish confirms that the
 * best move is clearly better than every alternative (unique solution).
 */
export async function exerciseFromMistake(game: StoredGame, m: MoveAnalysis, analyse: MultiAnalyseFn, depth = 16): Promise<Exercise | null> {
  if (positionLegalityProblems(m.fenBefore).length) return null;
  const lines = await analyse(m.fenBefore, depth, 2);
  const best = lines[0];
  if (!best?.pv[0]) return null;
  const second = lines[1];
  const bestWin = winPercent(best.score);
  const gap = second ? bestWin - winPercent(second.score) : 100;
  if (gap < MIN_GAP) return null;
  // The exercise must have a point: win something, or save a position that would otherwise be lost.
  if (bestWin < 60 && !(second && winPercent(second.score) < 25 && bestWin >= 40)) return null;

  const g = new Chess(m.fenBefore);
  const bestMove = g.moves({ verbose: true }).find((x) => x.lan === best.pv[0]);
  if (!bestMove) return null;
  const opponent = game.userColor === 'w' ? game.headers.Black : game.headers.White;
  const lineText = formatSanLine(m.fenBefore, uciLineToSan(m.fenBefore, best.pv, 6));
  const type = m.errorType ?? 'calculation';
  const category = isEndgame(g) ? 'endgame' : m.moveNumber <= 10 ? 'opening' : 'tactics';
  const loss = m.winBefore - m.winAfter;
  return {
    id: `game-${game.id}-${m.ply}`,
    kind: 'move',
    category,
    theme: THEME_BY_ERROR[type] ?? 'combination',
    title: `De la teva partida${opponent ? ` contra ${opponent}` : ''} (jugada ${m.moveNumber})`,
    fen: m.fenBefore,
    objective: bestWin >= 60 ? 'Troba la millor jugada.' : 'Troba l\'única jugada que salva la posició.',
    difficulty: (loss >= 45 ? 2 : loss >= 30 ? 3 : 4) as Exercise['difficulty'],
    solution: [best.pv[0]],
    hints: [
      HINT_BY_ERROR[type] ?? HINT_BY_ERROR.calculation,
      `La jugada correcta la fa el teu ${PIECE_NAME_CA[bestMove.piece]}.`,
      `Mou la peça de ${bestMove.from}.`,
    ],
    explanation: sanToCatalan(
      `A la partida vas jugar ${m.san}. Stockfish recomana ${bestMove.san}: ${lineText} (avaluació ${formatScore(best.score)}). ` +
        (m.facts?.length ? m.facts.join(' ') : ''),
    ).trim(),
    concepts: ERROR_TYPE_CONCEPTS[type] ?? [],
    tags: ['de-les-teves-partides', type],
    origin: { kind: 'game', gameId: game.id, ply: m.ply },
    inlineVerification: {
      engine: 'stockfish-19-lite',
      depth,
      bestScore: formatScore(best.score),
      secondScore: second ? formatScore(second.score) : null,
      verifiedAt: new Date().toISOString(),
    },
  };
}

/** Generates exercises from all the user's mistakes and blunders in a game. */
export async function exercisesFromGame(game: StoredGame, analyse: MultiAnalyseFn, max = 5): Promise<Exercise[]> {
  const moves = game.analysis?.moves ?? [];
  const candidates = moves
    .filter((m) => (!game.userColor || m.color === game.userColor) && (m.classification === 'blunder' || m.classification === 'mistake'))
    .sort((a, b) => b.winBefore - b.winAfter - (a.winBefore - a.winAfter));
  const out: Exercise[] = [];
  for (const m of candidates) {
    if (out.length >= max) break;
    const ex = await exerciseFromMistake(game, m, analyse);
    if (ex) out.push(ex);
  }
  return out;
}
