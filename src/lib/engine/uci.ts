/**
 * Pure UCI protocol helpers. No DOM / Worker dependencies so they can be
 * shared by the browser engine client, Node scripts and unit tests.
 */

export type EngineScore =
  | { type: 'cp'; value: number }
  | { type: 'mate'; value: number };

export interface EngineLine {
  multipv: number;
  depth: number;
  seldepth?: number;
  /** Score from the point of view of the side to move (UCI convention). */
  score: EngineScore;
  bound?: 'lower' | 'upper';
  nodes?: number;
  nps?: number;
  timeMs?: number;
  /** Principal variation in UCI long algebraic notation (e2e4, e7e8q...). */
  pv: string[];
}

/** Parses an `info ... pv ...` line. Returns null for lines without a score+pv. */
export function parseInfoLine(line: string): EngineLine | null {
  if (!line.startsWith('info ')) return null;
  const tokens = line.trim().split(/\s+/);
  let depth: number | undefined;
  let seldepth: number | undefined;
  let multipv = 1;
  let score: EngineScore | undefined;
  let bound: EngineLine['bound'];
  let nodes: number | undefined;
  let nps: number | undefined;
  let timeMs: number | undefined;
  let pv: string[] = [];

  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    switch (t) {
      case 'depth':
        depth = Number(tokens[++i]);
        break;
      case 'seldepth':
        seldepth = Number(tokens[++i]);
        break;
      case 'multipv':
        multipv = Number(tokens[++i]);
        break;
      case 'nodes':
        nodes = Number(tokens[++i]);
        break;
      case 'nps':
        nps = Number(tokens[++i]);
        break;
      case 'time':
        timeMs = Number(tokens[++i]);
        break;
      case 'score': {
        const kind = tokens[++i];
        const value = Number(tokens[++i]);
        if (kind === 'cp' || kind === 'mate') score = { type: kind, value };
        const next = tokens[i + 1];
        if (next === 'lowerbound' || next === 'upperbound') {
          bound = next === 'lowerbound' ? 'lower' : 'upper';
          i++;
        }
        break;
      }
      case 'pv':
        pv = tokens.slice(i + 1);
        i = tokens.length;
        break;
      case 'string':
        // free text until end of line
        i = tokens.length;
        break;
      default:
        break;
    }
  }
  if (depth === undefined || !score || pv.length === 0) return null;
  return { multipv, depth, seldepth, score, bound, nodes, nps, timeMs, pv };
}

export function parseBestMove(line: string): { best: string | null; ponder?: string } | null {
  if (!line.startsWith('bestmove')) return null;
  const [, best, , ponder] = line.trim().split(/\s+/);
  return { best: !best || best === '(none)' ? null : best, ponder };
}

/** Converts a side-to-move score into a white-relative score. */
export function toWhitePov(score: EngineScore, sideToMove: 'w' | 'b'): EngineScore {
  if (sideToMove === 'w') return score;
  return { type: score.type, value: -score.value };
}

/** Flips a score to the other side's point of view. */
export function negate(score: EngineScore): EngineScore {
  return { type: score.type, value: -score.value };
}

/**
 * Expected score (0-100) for the side whose POV the score is in.
 * Same logistic model Lichess uses for its accuracy metric.
 */
export function winPercent(score: EngineScore): number {
  if (score.type === 'mate') {
    if (score.value === 0) return 0; // side to move is mated
    return score.value > 0 ? 100 : 0;
  }
  const cp = Math.max(-1000, Math.min(1000, score.value));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Human readable score, e.g. "+1.25", "-0.40", "M3", "-M2". */
export function formatScore(score: EngineScore): string {
  if (score.type === 'mate') {
    if (score.value === 0) return '#';
    return score.value > 0 ? `M${score.value}` : `-M${Math.abs(score.value)}`;
  }
  const v = score.value / 100;
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}`;
}

/** Numeric value useful for sorting/eval bars (mate mapped to ±100000). */
export function scoreToNumber(score: EngineScore): number {
  if (score.type === 'mate') {
    if (score.value === 0) return -100000;
    return score.value > 0 ? 100000 - score.value : -100000 - score.value;
  }
  return score.value;
}

export interface UciMove {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

export function parseUciMove(uci: string): UciMove {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
    throw new Error(`Invalid UCI move: ${uci}`);
  }
  const promotion = uci[4] as UciMove['promotion'];
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), ...(promotion ? { promotion } : {}) };
}

export function toUci(move: { from: string; to: string; promotion?: string }): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}
