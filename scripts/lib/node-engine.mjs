// Minimal UCI client for Node scripts (spawns the Stockfish WASM build as a child process).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { parseInfoLine, parseBestMove } from '../../src/lib/engine/uci.ts';

const require = createRequire(import.meta.url);

export function createEngine(flavor = 'lite-single') {
  const enginePath = require('stockfish').findEngine(flavor);
  const child = spawn(process.execPath, [enginePath], { stdio: 'pipe' });
  let buffer = '';
  let listeners = [];
  child.stdout.on('data', (d) => {
    buffer += d;
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const l of lines) for (const fn of listeners) fn(l.trim());
  });
  const send = (cmd) => child.stdin.write(cmd + '\n');

  const waitFor = (pred) =>
    new Promise((resolve) => {
      const fn = (l) => {
        if (pred(l)) {
          listeners = listeners.filter((x) => x !== fn);
          resolve(l);
        }
      };
      listeners.push(fn);
    });

  async function init() {
    send('uci');
    await waitFor((l) => l === 'uciok');
    send('isready');
    await waitFor((l) => l === 'readyok');
  }

  /** Returns the final line for each multipv at the requested depth. */
  async function analyse(fen, { depth = 18, multipv = 3, searchmoves = null } = {}) {
    const lines = new Map();
    const collect = (l) => {
      const info = parseInfoLine(l);
      if (info && !info.bound) lines.set(info.multipv, info);
    };
    listeners.push(collect);
    send('ucinewgame');
    send(`setoption name MultiPV value ${multipv}`);
    send(`position fen ${fen}`);
    send('isready');
    await waitFor((l) => l === 'readyok');
    send(`go depth ${depth}${searchmoves ? ' searchmoves ' + searchmoves.join(' ') : ''}`);
    const bm = parseBestMove(await waitFor((l) => l.startsWith('bestmove')));
    listeners = listeners.filter((x) => x !== collect);
    return { bestmove: bm?.best ?? null, lines: [...lines.values()].sort((a, b) => a.multipv - b.multipv) };
  }

  return { init, analyse, quit: () => { send('quit'); child.kill(); } };
}
