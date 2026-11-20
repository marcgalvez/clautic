import { useEffect, useRef, useState } from 'react';
import { CancelledError, getEngine, type EngineState } from './stockfishClient';
import type { EngineLine } from './uci';

export function useEngineState(): { state: EngineState; error?: string } {
  const engine = getEngine();
  const [s, setS] = useState<{ state: EngineState; error?: string }>({ state: engine.getState(), error: engine.error });
  useEffect(() => engine.onStateChange((state, error) => setS({ state, error })), [engine]);
  return s;
}

export interface LiveAnalysis {
  lines: EngineLine[];
  depth: number;
  running: boolean;
  /** FEN the lines belong to (guards against stale results). */
  fen: string | null;
  error?: string;
}

/** Continuously analyses `fen` while `enabled`. Debounced; cancels on change. */
export function useLiveAnalysis(fen: string | null, enabled: boolean, depth = 18, multiPv = 3): LiveAnalysis {
  const [state, setState] = useState<LiveAnalysis>({ lines: [], depth: 0, running: false, fen: null });
  const reqRef = useRef(0);

  useEffect(() => {
    if (!enabled || !fen) {
      setState((s) => ({ ...s, running: false }));
      return;
    }
    const req = ++reqRef.current;
    let cancel: (() => void) | undefined;
    setState({ lines: [], depth: 0, running: true, fen });
    const timer = setTimeout(() => {
      const job = getEngine().analyze(fen, { depth, multiPv }, (lines, d) => {
        if (reqRef.current === req) setState({ lines, depth: d, running: true, fen });
      });
      cancel = job.cancel;
      job.promise
        .then((r) => {
          if (reqRef.current === req) setState({ lines: r.lines, depth: r.depth, running: false, fen });
        })
        .catch((e: Error) => {
          if (e instanceof CancelledError) return;
          if (reqRef.current === req) setState({ lines: [], depth: 0, running: false, fen, error: e.message });
        });
    }, 150);
    return () => {
      clearTimeout(timer);
      cancel?.();
    };
  }, [fen, enabled, depth, multiPv]);

  return state;
}
