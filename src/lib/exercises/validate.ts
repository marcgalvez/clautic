import { Chess, validateFen } from 'chess.js';
import type { Exercise } from './types';

/**
 * Structural + rules validation of an exercise (no engine).
 * Returns a list of human readable problems; empty means valid.
 */
export function validateExerciseRules(ex: Exercise): string[] {
  const problems: string[] = [];
  const required: (keyof Exercise)[] = ['id', 'category', 'theme', 'title', 'fen', 'objective', 'difficulty', 'solution', 'hints', 'explanation'];
  for (const key of required) {
    if (ex[key] === undefined || ex[key] === '') problems.push(`missing field ${String(key)}`);
  }
  if (problems.length) return problems;
  if (!Array.isArray(ex.hints) || ex.hints.length !== 3) problems.push('exactly 3 progressive hints are required');
  if (!(ex.difficulty >= 1 && ex.difficulty <= 5)) problems.push('difficulty must be 1-5');
  if (!Array.isArray(ex.solution) || ex.solution.length === 0 || ex.solution.length % 2 === 0) {
    problems.push('solution must have an odd number of plies (it ends with a solver move)');
  }

  const fenCheck = validateFen(ex.fen);
  if (!fenCheck.ok) {
    problems.push(`invalid FEN: ${fenCheck.error}`);
    return problems;
  }
  problems.push(...positionLegalityProblems(ex.fen));
  if (problems.length) return problems;

  const game = new Chess(ex.fen);
  for (let i = 0; i < ex.solution.length; i++) {
    const uci = ex.solution[i];
    try {
      game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    } catch {
      problems.push(`ply ${i}: illegal move ${uci}`);
      return problems;
    }
  }
  for (const [ply, moves] of Object.entries(ex.alternatives ?? {})) {
    const g = new Chess(ex.fen);
    for (let i = 0; i < Number(ply); i++) {
      const u = ex.solution[i];
      g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    }
    for (const alt of moves) {
      const probe = new Chess(g.fen());
      try {
        probe.move({ from: alt.slice(0, 2), to: alt.slice(2, 4), promotion: alt[4] });
      } catch {
        problems.push(`alternative ${alt} at ply ${ply} is illegal`);
      }
    }
  }
  return problems;
}

/** Checks that cannot be detected by FEN syntax alone. */
export function positionLegalityProblems(fen: string): string[] {
  const problems: string[] = [];
  const parts = fen.split(' ');
  // The side NOT to move must not be in check.
  const flipped = [parts[0], parts[1] === 'w' ? 'b' : 'w', parts[2], '-', parts[4] ?? '0', parts[5] ?? '1'].join(' ');
  try {
    const g = new Chess(flipped);
    if (g.isCheck()) problems.push('the side not to move is in check (impossible position)');
  } catch (e) {
    problems.push(`cannot evaluate position: ${(e as Error).message}`);
  }
  const g = new Chess(fen);
  if (g.isGameOver()) problems.push('position is already game over');
  return problems;
}
