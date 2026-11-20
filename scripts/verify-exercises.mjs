#!/usr/bin/env node
/**
 * Verifies every exercise in src/data/exercises/*.json with chess.js (legality)
 * and Stockfish (best move + uniqueness), then writes verification.json.
 *
 * Usage: npm run verify:exercises [-- --depth 20]
 * Exit code 1 if any exercise fails.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { createEngine } from './lib/node-engine.mjs';
import { winPercent, negate } from '../src/lib/engine/uci.ts';
import { exerciseFingerprint } from '../src/lib/hash.ts';
import { validateExerciseRules, flipTurn, exerciseGoal } from '../src/lib/exercises/validate.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'src/data/exercises');
const depthArg = process.argv.indexOf('--depth');
const DEPTH = depthArg > 0 ? Number(process.argv[depthArg + 1]) : 20;
/** Minimum expected-score gap (0-100) between the solution and any non-accepted move. */
const MIN_GAP = 15;
/** Choice/threat options are hand-picked candidates: a smaller but clear gap is required. */
const MIN_GAP_CHOICE = 8;

async function verifyChoice(ex, problems, plies) {
  const fen = ex.kind === 'threat' ? flipTurn(ex.fen) : ex.fen;
  const scored = [];
  for (const opt of ex.options) {
    const { lines } = await engine.analyse(fen, { depth: DEPTH, multipv: 1, searchmoves: [opt] });
    if (!lines[0]) { problems.push(`option ${opt}: no engine line`); return; }
    scored.push({ move: opt, score: lines[0].score, win: winPercent(lines[0].score) });
  }
  plies.push({ options: scored.map(({ move, score }) => ({ move, score })) });
  const sol = scored.find((o) => o.move === ex.solution[0]);
  for (const o of scored) {
    if (o === sol) continue;
    const gap = sol.win - o.win;
    const mateTie = sol.score.type === 'mate' && o.score.type === 'mate' && o.score.value > 0 && o.score.value <= sol.score.value;
    if (gap < MIN_GAP_CHOICE || mateTie) problems.push(`option ${o.move} is not clearly worse than ${sol.move} (${JSON.stringify(o.score)} vs ${JSON.stringify(sol.score)})`);
  }
  const goal = exerciseGoal(ex);
  if (ex.kind === 'choice' && ex.goal === 'win' && sol.win < 75) problems.push(`solution is not clearly winning (${JSON.stringify(sol.score)})`);
  if (ex.kind === 'choice' && goal === 'draw' && Math.abs(sol.win - 50) > 15) problems.push(`solution does not hold the draw (${JSON.stringify(sol.score)})`);
}

const files = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'verification.json');
const exercises = files.flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));

const engine = createEngine();
await engine.init();

const entries = {};
let failures = 0;

for (const ex of exercises) {
  const problems = validateExerciseRules(ex);
  const plies = [];
  if (problems.length === 0 && (ex.kind === 'choice' || ex.kind === 'threat')) {
    await verifyChoice(ex, problems, plies);
  } else if (problems.length === 0) {
    const game = new Chess(ex.fen);
    const isMateObjective = exerciseGoal(ex) === 'mate';
    for (let i = 0; i < ex.solution.length; i++) {
      const uci = ex.solution[i];
      const fen = game.fen();
      const userPly = i % 2 === 0;
      const { lines } = await engine.analyse(fen, { depth: DEPTH, multipv: userPly ? 4 : 2 });
      const accepted = new Set([uci, ...((ex.alternatives ?? {})[String(i)] ?? [])]);
      const best = lines[0];
      const record = { ply: i, move: uci, engineBest: best?.pv[0] ?? null, score: best?.score ?? null };
      if (!best) {
        problems.push(`ply ${i}: engine returned no line`);
      } else if (userPly) {
        if (!accepted.has(best.pv[0])) {
          problems.push(`ply ${i}: engine prefers ${best.pv[0]} over solution ${uci} (${JSON.stringify(best.score)})`);
        }
        for (const l of lines.slice(1)) {
          if (accepted.has(l.pv[0])) continue;
          const gap = winPercent(best.score) - winPercent(l.score);
          const bothMate = best.score.type === 'mate' && l.score.type === 'mate' && l.score.value > 0;
          const ambiguousMate = isMateObjective && bothMate && l.score.value <= best.score.value;
          const ambiguous = isMateObjective && best.score.type === 'mate' ? ambiguousMate : gap < MIN_GAP;
          if (ambiguous) problems.push(`ply ${i}: alternative ${l.pv[0]} is as good (${JSON.stringify(l.score)})`);
        }
        record.secondBest = lines[1] ? { move: lines[1].pv[0], score: lines[1].score } : null;
      } else if (best.pv[0] !== uci) {
        // Opponent reply that is not the engine's top choice is only a warning
        // unless it is clearly worse for the defender.
        const replyLine = lines.find((l) => l.pv[0] === uci);
        if (!replyLine || winPercent(best.score) - winPercent(replyLine.score) > 10) {
          record.warning = `defender's best reply is ${best.pv[0]}, solution uses ${uci}`;
        }
      }
      plies.push(record);
      game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    }
    // Final position must be decisive for the solver.
    if (problems.length === 0) {
      const solverToMove = ex.solution.length % 2 === 0;
      if (isMateObjective) {
        if (!game.isCheckmate()) problems.push('mate objective but final position is not checkmate');
      } else {
        const { lines } = await engine.analyse(game.fen(), { depth: DEPTH, multipv: 1 });
        const s = solverToMove ? lines[0].score : negate(lines[0].score);
        const goal = exerciseGoal(ex);
        if (goal === 'win' && winPercent(s) < 75) problems.push(`final position not clearly winning for solver (${JSON.stringify(s)})`);
        if (goal === 'draw' && Math.abs(winPercent(s) - 50) > 15) problems.push(`final position does not hold the draw (${JSON.stringify(s)})`);
        plies.push({ final: true, scoreForSolver: s });
      }
    }
  }
  const status = problems.length ? 'failed' : 'passed';
  if (problems.length) failures++;
  entries[ex.id] = { fingerprint: exerciseFingerprint(ex), status, problems, plies };
  console.log(`${status === 'passed' ? '✔' : '✘'} ${ex.id}${problems.length ? '\n    ' + problems.join('\n    ') : ''}`);
  for (const p of plies) if (p.warning) console.log(`    ⚠ ${p.warning}`);
}
engine.quit();

writeFileSync(
  join(dir, 'verification.json'),
  JSON.stringify({ engine: 'stockfish-19-lite-single', depth: DEPTH, minGap: MIN_GAP, generatedAt: new Date().toISOString(), entries }, null, 2) + '\n',
);
console.log(`\n${exercises.length - failures}/${exercises.length} exercises verified at depth ${DEPTH}.`);
process.exit(failures ? 1 : 0);
