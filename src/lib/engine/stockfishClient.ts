import { parseBestMove, parseInfoLine, type EngineLine } from './uci';

export interface AnalysisOptions {
  depth?: number;
  multiPv?: number;
  /** Optional hard time limit in ms (the search stops at whichever comes first). */
  movetimeMs?: number;
}

export interface AnalysisResult {
  fen: string;
  bestMove: string | null;
  lines: EngineLine[];
  depth: number;
}

export type EngineState = 'idle' | 'loading' | 'ready' | 'error';

interface Job {
  fen: string;
  opts: Required<Pick<AnalysisOptions, 'depth' | 'multiPv'>> & Pick<AnalysisOptions, 'movetimeMs'>;
  onUpdate?: (lines: EngineLine[], depth: number) => void;
  resolve: (r: AnalysisResult) => void;
  reject: (e: Error) => void;
  cancelled: boolean;
}

/**
 * Thin UCI client around the Stockfish WASM Web Worker.
 * - One search at a time; new requests cancel nothing implicitly — callers
 *   cancel with the returned `cancel()`.
 * - The UI thread never blocks: all computation happens in the worker.
 */
export class StockfishClient {
  private worker: Worker | null = null;
  private state: EngineState = 'idle';
  private readyPromise: Promise<void> | null = null;
  private queue: Job[] = [];
  private current: Job | null = null;
  private lines = new Map<number, EngineLine>();
  private lastDepth = 0;
  private lineHandlers: ((line: string) => void)[] = [];
  private stateListeners = new Set<(s: EngineState, error?: string) => void>();
  private engineUrl: string;
  error: string | undefined;

  constructor(engineUrl = `${import.meta.env.BASE_URL}engine/stockfish.js`) {
    this.engineUrl = engineUrl;
  }

  getState() {
    return this.state;
  }

  onStateChange(fn: (s: EngineState, error?: string) => void): () => void {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  private setState(s: EngineState, error?: string) {
    this.state = s;
    this.error = error;
    for (const fn of this.stateListeners) fn(s, error);
  }

  init(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    if (typeof Worker === 'undefined') {
      this.setState('error', 'Aquest navegador no admet Web Workers.');
      return Promise.reject(new Error(this.error));
    }
    this.setState('loading');
    this.readyPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        fail('El motor ha trigat massa a carregar-se.');
      }, 20000);
      const fail = (msg: string) => {
        clearTimeout(timeout);
        this.setState('error', msg);
        this.readyPromise = null;
        this.worker?.terminate();
        this.worker = null;
        reject(new Error(msg));
      };
      try {
        this.worker = new Worker(this.engineUrl);
      } catch (e) {
        fail(`No s'ha pogut iniciar el motor: ${(e as Error).message}`);
        return;
      }
      this.worker.onerror = (ev) => {
        ev.preventDefault?.();
        fail(`Error del motor: ${ev.message || 'no s\'ha pogut carregar stockfish.js'}`);
      };
      this.worker.onmessage = (ev: MessageEvent) => {
        if (typeof ev.data !== 'string') return;
        this.handleLine(ev.data);
      };
      const onLine = (line: string) => {
        if (line === 'uciok') {
          this.send('setoption name Hash value 32');
          this.send('isready');
        } else if (line === 'readyok') {
          clearTimeout(timeout);
          this.lineHandlers = this.lineHandlers.filter((h) => h !== onLine);
          this.setState('ready');
          resolve();
        }
      };
      this.lineHandlers.push(onLine);
      this.send('uci');
    });
    return this.readyPromise;
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  private handleLine(line: string) {
    for (const h of this.lineHandlers) h(line);
    const job = this.current;
    if (!job) return;
    if (line.startsWith('info')) {
      const info = parseInfoLine(line);
      if (!info || info.bound) return;
      if (info.multipv === 1 && info.depth !== this.lastDepth) {
        // new iteration: drop lines from shallower depth that weren't refreshed yet
        this.lastDepth = info.depth;
        for (const [k, v] of this.lines) if (v.depth < info.depth - 1) this.lines.delete(k);
      }
      this.lines.set(info.multipv, info);
      if (!job.cancelled && job.onUpdate) job.onUpdate(this.sortedLines(), this.lastDepth);
    } else if (line.startsWith('bestmove')) {
      const bm = parseBestMove(line);
      const result: AnalysisResult = { fen: job.fen, bestMove: bm?.best ?? null, lines: this.sortedLines(), depth: this.lastDepth };
      this.current = null;
      if (job.cancelled) job.reject(new CancelledError());
      else job.resolve(result);
      this.pump();
    }
  }

  private sortedLines() {
    return [...this.lines.values()].sort((a, b) => a.multipv - b.multipv);
  }

  private pump() {
    if (this.current) return;
    // drop cancelled jobs that never started
    while (this.queue.length && this.queue[0].cancelled) this.queue.shift()!.reject(new CancelledError());
    const job = this.queue.shift();
    if (!job) return;
    this.current = job;
    this.lines.clear();
    this.lastDepth = 0;
    this.send('stop');
    this.send(`setoption name MultiPV value ${job.opts.multiPv}`);
    this.send(`position fen ${job.fen}`);
    const limits = [`depth ${job.opts.depth}`];
    if (job.opts.movetimeMs) limits.push(`movetime ${job.opts.movetimeMs}`);
    this.send(`go ${limits.join(' ')}`);
  }

  /**
   * Queues an analysis. `cancel()` stops the search if running (the promise
   * then rejects with CancelledError).
   */
  analyze(
    fen: string,
    opts: AnalysisOptions = {},
    onUpdate?: (lines: EngineLine[], depth: number) => void,
  ): { promise: Promise<AnalysisResult>; cancel: () => void } {
    let job!: Job;
    const promise = new Promise<AnalysisResult>((resolve, reject) => {
      job = {
        fen,
        opts: { depth: opts.depth ?? 16, multiPv: opts.multiPv ?? 1, movetimeMs: opts.movetimeMs },
        onUpdate,
        resolve,
        reject,
        cancelled: false,
      };
    });
    this.init()
      .then(() => {
        this.queue.push(job);
        this.pump();
      })
      .catch((e: Error) => job.reject(e));
    const cancel = () => {
      if (job.cancelled) return;
      job.cancelled = true;
      if (this.current === job) this.send('stop');
    };
    return { promise, cancel };
  }

  terminate() {
    this.send('quit');
    this.worker?.terminate();
    this.worker = null;
    this.readyPromise = null;
    this.setState('idle');
  }
}

export class CancelledError extends Error {
  constructor() {
    super('cancelled');
    this.name = 'CancelledError';
  }
}

let shared: StockfishClient | null = null;
/** Lazily created singleton: the WASM is only downloaded when first needed. */
export function getEngine(): StockfishClient {
  if (!shared) shared = new StockfishClient();
  return shared;
}
