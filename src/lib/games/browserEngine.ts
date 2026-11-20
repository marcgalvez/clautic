import { getEngine } from '@/lib/engine/stockfishClient';
import type { AnalyseFn } from './analyze';
import type { MultiAnalyseFn } from './generate';

/** Game analysis adapter over the shared Web Worker engine. */
export const browserAnalyse: AnalyseFn = async (fen, depth, signal) => {
  const job = getEngine().analyze(fen, { depth, multiPv: 1 });
  const onAbort = () => job.cancel();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const r = await job.promise;
    return r.lines[0] ? { score: r.lines[0].score, pv: r.lines[0].pv } : null;
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
};

export const browserMulti: MultiAnalyseFn = async (fen, depth, multiPv) => (await getEngine().analyze(fen, { depth, multiPv }).promise).lines;
