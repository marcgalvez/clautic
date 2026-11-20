import { Chess } from 'chess.js';
import { parsePgnGame } from '@/lib/chess/pgn';
import { mainlineFrom } from '@/lib/chess/moveTree';
import { formatScore, negate, winPercent, type EngineScore } from '@/lib/engine/uci';
import { formatSanLine, uciLineToSan } from '@/lib/chess/game';
import { classifyLoss, classifyMistake, moveAccuracy } from './classify';
import { ERROR_TYPE_CONCEPTS, ERROR_TYPE_LABELS } from './patterns';
import type { ErrorType, GameReport, MoveAnalysis, MoveClass } from './types';

/** Engine abstraction: score is from the side to move (UCI convention). */
export type AnalyseFn = (fen: string, depth: number, signal?: AbortSignal) => Promise<{ score: EngineScore; pv: string[] } | null>;

export interface AnalyseOptions {
  depth?: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

/** Parses "[%clk 0:04:58]" comments into seconds. */
export function clockFromComment(comment?: string): number | undefined {
  const m = comment?.match(/\[%clk\s+(\d+):(\d{2}):(\d{2}(?:\.\d+)?)\]/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : undefined;
}

function incrementFrom(headers: Record<string, string>): number {
  const m = headers.TimeControl?.match(/^\d+\+(\d+)$/);
  return m ? Number(m[1]) : 0;
}

function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Score of `color` given a side-to-move score in a position where `stm` moves. */
function scoreFor(color: 'w' | 'b', stm: 'w' | 'b', s: EngineScore): EngineScore {
  return color === stm ? s : negate(s);
}

/**
 * Analyses the mainline of a PGN game with the engine. Each position is
 * evaluated once; a move's quality is the drop in expected score of the mover.
 */
export async function analyseGame(pgn: string, userColor: 'w' | 'b' | null, analyse: AnalyseFn, opts: AnalyseOptions = {}): Promise<{ moves: MoveAnalysis[]; report: GameReport; depth: number }> {
  const depth = opts.depth ?? 12;
  const parsed = parsePgnGame(pgn);
  const tree = parsed.tree;
  const ids = mainlineFrom(tree);
  if (ids.length === 0) throw new Error('La partida no té jugades');
  const fens = [tree.nodes.root.fen, ...ids.map((id) => tree.nodes[id].fen)];

  // 1. Evaluate every position (terminal positions are scored without the engine).
  const evals: { score: EngineScore; pv: string[] }[] = [];
  for (let i = 0; i < fens.length; i++) {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const g = new Chess(fens[i]);
    // Mated side to move: encoded as "mated in 1" so that negating it gives the winner +M1 (−0 would equal 0).
    if (g.isCheckmate()) evals.push({ score: { type: 'mate', value: -1 }, pv: [] });
    else if (g.isDraw() || g.isStalemate()) evals.push({ score: { type: 'cp', value: 0 }, pv: [] });
    else {
      const r = await analyse(fens[i], depth, opts.signal);
      evals.push(r ?? { score: { type: 'cp', value: 0 }, pv: [] });
    }
    opts.onProgress?.(i + 1, fens.length);
  }

  // 2. Per-move analysis.
  const increment = incrementFrom(parsed.headers);
  const lastClock: Partial<Record<'w' | 'b', number>> = {};
  const startClock = parsed.headers.TimeControl?.match(/^(\d+)\+/)?.[1];
  if (startClock) lastClock.w = lastClock.b = Number(startClock);
  const spent: Record<'w' | 'b', number[]> = { w: [], b: [] };
  const moves: MoveAnalysis[] = ids.map((id, i) => {
    const node = tree.nodes[id];
    const fenBefore = fens[i];
    const stm = fenBefore.split(' ')[1] as 'w' | 'b';
    const moveNumber = Number(fenBefore.split(' ')[5]);
    const before = scoreFor(stm, stm, evals[i].score);
    const afterStm = fens[i + 1].split(' ')[1] as 'w' | 'b';
    const after = scoreFor(stm, afterStm, evals[i + 1].score);
    const winBefore = winPercent(before);
    const winAfter = winPercent(after);
    const bestUci = evals[i].pv[0] ?? null;
    let classification: MoveClass = classifyLoss(winBefore, winAfter);
    if (bestUci === node.uci) classification = 'best';
    const clock = clockFromComment(node.comment);
    let timeSpentSec: number | undefined;
    if (clock !== undefined && lastClock[stm] !== undefined) {
      timeSpentSec = Math.max(0, lastClock[stm]! - clock + increment);
      spent[stm].push(timeSpentSec);
    }
    if (clock !== undefined) lastClock[stm] = clock;
    const whiteAfter = scoreFor('w', afterStm, evals[i + 1].score);
    return {
      ply: i + 1,
      moveNumber,
      color: stm,
      san: node.san,
      uci: node.uci,
      fenBefore,
      bestUci,
      bestSan: bestUci ? uciLineToSan(fenBefore, [bestUci])[0] ?? null : null,
      winBefore,
      winAfter,
      evalAfterCp: whiteAfter.type === 'mate' ? (whiteAfter.value > 0 ? 10000 : -10000) : whiteAfter.value,
      classification,
      timeSpentSec,
      bestLine: evals[i].pv.slice(0, 8),
    };
  });

  // 3. Classify the errors of the user (or of both sides if the color is unknown).
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    if (userColor && m.color !== userColor) continue;
    if (m.classification !== 'mistake' && m.classification !== 'blunder') continue;
    const c = classifyMistake({
      fenBefore: m.fenBefore,
      playedUci: m.uci,
      bestUci: m.bestUci,
      refutation: evals[i + 1].pv,
      winBefore: m.winBefore,
      winAfter: m.winAfter,
      moveNumber: m.moveNumber,
      timeSpentSec: m.timeSpentSec,
      medianTimeSec: median(spent[m.color]),
    });
    m.errorType = c.errorType;
    m.errorConfidence = c.confidence;
    m.facts = c.facts;
  }

  return { moves, report: buildReport(moves, userColor, parsed.headers.Result ?? parsed.result ?? '*'), depth };
}

export function buildReport(moves: MoveAnalysis[], userColor: 'w' | 'b' | null, result: string): GameReport {
  const color = userColor ?? 'w';
  const mine = moves.filter((m) => m.color === color);
  const counts: Record<MoveClass, number> = { best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
  for (const m of mine) counts[m.classification]++;
  const accuracy = mine.length ? mine.reduce((s, m) => s + moveAccuracy(m.winBefore, m.winAfter), 0) / mine.length : 0;
  const errorTypes: Partial<Record<ErrorType, number>> = {};
  for (const m of mine) if (m.errorType) errorTypes[m.errorType] = (errorTypes[m.errorType] ?? 0) + 1;
  const losses = mine.map((m) => ({ ply: m.ply, loss: m.winBefore - m.winAfter })).filter((x) => x.loss >= 10);
  const criticalPlies = losses.sort((a, b) => b.loss - a.loss).slice(0, 3).map((x) => x.ply);

  // Decisive moment: first own move that turns a playable game (≥ 40%) into a lost one (< 25%) for good.
  let decisivePly: number | null = null;
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    if (m.color !== color || m.winBefore < 40 || m.winAfter >= 25) continue;
    const later = moves.slice(i + 1).filter((x) => x.color === color);
    if (later.every((x) => x.winBefore < 40)) {
      decisivePly = m.ply;
      break;
    }
  }

  const userWon = (result === '1-0' && color === 'w') || (result === '0-1' && color === 'b');
  const userLost = (result === '1-0' && color === 'b') || (result === '0-1' && color === 'w');
  const verdict: string[] = [];
  const label = (m: MoveAnalysis) => `${m.moveNumber}${m.color === 'w' ? '.' : '...'} ${m.san}`;
  if (!userColor) verdict.push('No sabem amb quin color jugaves: l\'informe mostra les blanques.');
  if (decisivePly) {
    const m = moves[decisivePly - 1];
    verdict.push(
      `${userLost ? 'La partida es va decidir' : 'El moment més delicat va ser'} a ${label(m)}: la teva expectativa va baixar del ${Math.round(m.winBefore)}% al ${Math.round(m.winAfter)}%.` +
        (m.bestSan ? ` Stockfish preferia ${m.bestSan}.` : ''),
    );
    if (m.errorType) verdict.push(`Tipus d'error: ${ERROR_TYPE_LABELS[m.errorType].toLowerCase()} (${m.errorConfidence === 'engine-verified' ? 'verificat pel motor' : m.errorConfidence === 'heuristic' ? 'interpretació probable' : 'cal més evidència'}).`);
  } else if (userLost) {
    verdict.push('No hi ha un únic error decisiu: la posició es va anar deteriorant de mica en mica.');
  } else if (userWon) {
    verdict.push('Has guanyat. Revisa igualment els moments on vas deixar escapar avantatge.');
  }
  verdict.push(`Errors greus: ${counts.blunder}. Errors: ${counts.mistake}. Imprecisions: ${counts.inaccuracy}. Precisió aproximada: ${Math.round(accuracy)}%.`);

  const sortedTypes = (Object.entries(errorTypes) as [ErrorType, number][]).sort((a, b) => b[1] - a[1]);
  const recommendations: GameReport['recommendations'] = [];
  for (const [type, n] of sortedTypes) {
    const verified = mine.some((m) => m.errorType === type && m.errorConfidence === 'engine-verified');
    // Interpretations need repetition before they become a training priority.
    if (!verified && n < 2) continue;
    const concept = ERROR_TYPE_CONCEPTS[type][0];
    if (!recommendations.some((r) => r.conceptId === concept)) {
      recommendations.push({ conceptId: concept, reason: `${ERROR_TYPE_LABELS[type]}: ${n} ${n === 1 ? 'vegada' : 'vegades'} en aquesta partida${verified ? '' : ' (interpretació)'}.` });
    }
  }
  return { userColor: color, result, accuracy, counts, errorTypes, criticalPlies, decisivePly, verdict, recommendations };
}

/** Describes a move's engine line for explanations. */
export function describeLine(fen: string, uci: string[], score?: EngineScore): string {
  const sans = uciLineToSan(fen, uci, 6);
  return `${formatSanLine(fen, sans)}${score ? ` (${formatScore(score)})` : ''}`;
}
