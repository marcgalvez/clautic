import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';
import { parseUciMove } from '@/lib/engine/uci';
import type { Confidence, ErrorType, MoveClass } from './types';

export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const PIECE_NAME_CA: Record<PieceSymbol, string> = { p: 'peó', n: 'cavall', b: 'alfil', r: 'torre', q: 'dama', k: 'rei' };

/** Lichess-style classification by the drop in expected score (0-100) of the mover. */
export function classifyLoss(winBefore: number, winAfter: number): MoveClass {
  const loss = winBefore - winAfter;
  if (loss >= 30) return 'blunder';
  if (loss >= 20) return 'mistake';
  if (loss >= 10) return 'inaccuracy';
  if (loss <= 2) return 'best';
  return 'good';
}

/** Lichess accuracy formula from the average expected-score loss of a sequence of moves. */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  const loss = Math.max(0, winBefore - winAfter);
  const acc = 103.1668 * Math.exp(-0.04354 * loss) - 3.1669;
  return Math.max(0, Math.min(100, acc));
}

export function materialCount(game: Chess, color: Color): number {
  let n = 0;
  for (const row of game.board()) for (const p of row) if (p && p.color === color) n += PIECE_VALUE[p.type];
  return n;
}

/** Non-pawn material of both sides is low: treat as an endgame. */
export function isEndgame(game: Chess): boolean {
  let nonPawn = 0;
  let queens = 0;
  for (const row of game.board())
    for (const p of row) {
      if (!p || p.type === 'k' || p.type === 'p') continue;
      nonPawn += PIECE_VALUE[p.type];
      if (p.type === 'q') queens++;
    }
  return nonPawn <= 26 && (queens === 0 || nonPawn <= 18);
}

/** Pieces of `color` that are attacked and either undefended or attacked by a cheaper piece. */
export function loosePieces(game: Chess, color: Color): { square: Square; type: PieceSymbol }[] {
  const enemy: Color = color === 'w' ? 'b' : 'w';
  const out: { square: Square; type: PieceSymbol }[] = [];
  for (const row of game.board()) {
    for (const p of row) {
      if (!p || p.color !== color || p.type === 'k') continue;
      const attackers = game.attackers(p.square, enemy);
      if (!attackers.length) continue;
      const defended = game.attackers(p.square, color).length > 0;
      const cheapest = Math.min(...attackers.map((sq) => PIECE_VALUE[game.get(sq)!.type] || 100));
      if (!defended || cheapest < PIECE_VALUE[p.type]) out.push({ square: p.square, type: p.type });
    }
  }
  return out;
}

function withTurn(fen: string, turn: Color): string | null {
  const p = fen.split(' ');
  const f = [p[0], turn, p[2], '-', p[4] ?? '0', p[5] ?? '1'].join(' ');
  try {
    const g = new Chess(f);
    // The side that is NOT to move must not be in check for the position to be legal.
    const other = new Chess([p[0], turn === 'w' ? 'b' : 'w', p[2], '-', '0', '1'].join(' '));
    return other.isCheck() ? null : g.fen();
  } catch {
    return null;
  }
}

/**
 * What the opponent threatened before the move: a mate in one or a capture
 * that wins material, found by giving the opponent the move.
 */
export function opponentThreats(fenBefore: string): { uci: string; san: string; kind: 'mate' | 'material'; value: number }[] {
  const mover = fenBefore.split(' ')[1] as Color;
  const opp: Color = mover === 'w' ? 'b' : 'w';
  const f = withTurn(fenBefore, opp);
  if (!f) return [];
  const g = new Chess(f);
  const out: { uci: string; san: string; kind: 'mate' | 'material'; value: number }[] = [];
  for (const m of g.moves({ verbose: true })) {
    const probe = new Chess(f);
    probe.move(m);
    if (probe.isCheckmate()) {
      out.push({ uci: m.lan, san: m.san, kind: 'mate', value: 100 });
      continue;
    }
    if (m.captured) {
      const victim = PIECE_VALUE[m.captured];
      const defended = probe.attackers(m.to as Square, mover).length > 0;
      const gain = defended ? victim - PIECE_VALUE[m.piece] : victim;
      if (gain >= 2) out.push({ uci: m.lan, san: m.san, kind: 'material', value: gain });
    }
  }
  return out.sort((a, b) => b.value - a.value);
}

export interface Classification {
  errorType: ErrorType;
  confidence: Confidence;
  /** Plain-language facts in Catalan, each derived from board or engine data. */
  facts: string[];
}

export interface ClassifyInput {
  fenBefore: string;
  playedUci: string;
  /** Engine best move in the position before. */
  bestUci: string | null;
  /** Engine principal variation after the played move (opponent's best reply first). */
  refutation: string[];
  winBefore: number;
  winAfter: number;
  moveNumber: number;
  timeSpentSec?: number;
  /** Median seconds per move for this player in the game (to judge haste). */
  medianTimeSec?: number;
}

/**
 * Classifies a mistake into the specification's categories. Order: objective,
 * engine-verifiable causes first; interpretations last, marked as such.
 */
export function classifyMistake(input: ClassifyInput): Classification {
  const { fenBefore, playedUci, refutation } = input;
  const mover = fenBefore.split(' ')[1] as Color;
  const before = new Chess(fenBefore);
  const after = new Chess(fenBefore);
  const played = after.move(parseUciMove(playedUci));
  const reply = refutation[0];
  const replyMove = reply
    ? (() => {
        try {
          return new Chess(after.fen()).move(parseUciMove(reply));
        } catch {
          return null;
        }
      })()
    : null;
  const facts: string[] = [];
  const replyText = replyMove ? replyMove.san : null;

  // 1. Hanging piece: the move itself leaves a piece loose (the moved piece, or one that was
  //    safe before) and the engine's reply takes it. A piece already loose before is a missed threat.
  const looseBefore = new Set(loosePieces(before, mover).map((l) => l.square));
  const loose = loosePieces(after, mover).filter((l) => l.square === played.to || !looseBefore.has(l.square));
  if (replyMove?.captured && loose.some((l) => l.square === replyMove.to)) {
    const lost = loose.find((l) => l.square === replyMove.to)!;
    facts.push(`Després de ${played.san}, el teu ${PIECE_NAME_CA[lost.type]} de ${lost.square} queda sense defensa suficient.`);
    facts.push(`El rival el captura amb ${replyText}.`);
    return { errorType: 'hanging-piece', confidence: 'engine-verified', facts };
  }

  // 2. Missed threat: the opponent's threat before the move is exactly the engine's reply.
  const threats = opponentThreats(fenBefore);
  const executed = threats.find((t) => t.uci === reply);
  if (!executed && replyMove?.captured && looseBefore.has(replyMove.to)) {
    facts.push(`La peça de ${replyMove.to} ja estava atacada abans de ${played.san} i no l'has protegida: el rival la captura amb ${replyText}.`);
    return { errorType: 'missed-threat', confidence: 'engine-verified', facts };
  }
  if (executed) {
    facts.push(
      executed.kind === 'mate'
        ? `El rival amenaçava ${executed.san} amb mat, i ${played.san} no ho impedeix.`
        : `El rival amenaçava ${executed.san}, que guanya material, i ${played.san} no ho impedeix.`,
    );
    return { errorType: 'missed-threat', confidence: 'engine-verified', facts };
  }

  // 3. Rushed decision (needs clock data): much faster than usual on a costly move.
  if (input.timeSpentSec !== undefined && input.medianTimeSec !== undefined && input.medianTimeSec > 0) {
    if (input.timeSpentSec <= Math.max(2, input.medianTimeSec * 0.3)) {
      facts.push(`Has jugat ${played.san} en ${Math.round(input.timeSpentSec)} s, molt per sota del teu temps habitual (${Math.round(input.medianTimeSec)} s).`);
      return { errorType: 'rushed', confidence: 'heuristic', facts };
    }
  }

  // 4. Calculation: a forcing move (capture/check) that the engine refutes.
  if (played.captured || played.san.includes('+')) {
    facts.push(`${played.san} és una jugada forçant, però la variant no funciona: el rival respon ${replyText ?? 'amb avantatge'}.`);
    return { errorType: 'calculation', confidence: 'heuristic', facts };
  }

  // 5. Phase-based interpretations.
  if (input.moveNumber <= 10 && !isEndgame(before)) {
    facts.push(`Error a l'obertura (jugada ${input.moveNumber}). La millor jugada era una altra; revisa desenvolupament, centre i seguretat del rei.`);
    return { errorType: 'opening', confidence: 'heuristic', facts };
  }
  if (isEndgame(before)) {
    facts.push('Error en un final: amb poc material, cada temps i l\'activitat del rei compten molt.');
    return { errorType: 'endgame', confidence: 'heuristic', facts };
  }

  // 6. No immediate material loss in the engine line: a positional/strategic problem.
  const probe = new Chess(after.fen());
  const matBefore = materialCount(probe, mover) - materialCount(probe, mover === 'w' ? 'b' : 'w');
  for (const u of refutation.slice(0, 4)) {
    try {
      probe.move(parseUciMove(u));
    } catch {
      break;
    }
  }
  const matAfter = materialCount(probe, mover) - materialCount(probe, mover === 'w' ? 'b' : 'w');
  if (matAfter >= matBefore) {
    facts.push('El motor no mostra pèrdua de material immediata: la posició empitjora per motius posicionals (activitat, estructura o seguretat del rei).');
    return { errorType: 'positional', confidence: 'needs-evidence', facts };
  }
  facts.push(`La variant del motor guanya material després de ${replyText ?? 'la resposta del rival'}: revisa el càlcul de la seqüència.`);
  return { errorType: 'calculation', confidence: 'heuristic', facts };
}
