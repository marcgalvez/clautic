import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import verification from '@/data/exercises/verification.json';
import { exerciseFingerprint } from '@/lib/hash';
import { CATALOGUE, EXERCISES, UNVERIFIED_COUNT, isVerified } from './bank';
import { positionLegalityProblems, validateExerciseRules } from './validate';
import type { Exercise } from './types';

const all = CATALOGUE;

describe('exercise bank', () => {
  it('has unique ids', () => {
    expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
  });

  it.each(all.map((e) => [e.id, e] as const))('%s passes structural and rules validation', (_id, ex) => {
    expect(validateExerciseRules(ex)).toEqual([]);
  });

  it.each(all.map((e) => [e.id, e] as const))('%s has a passing Stockfish verification for its exact content', (_id, ex) => {
    const entry = (verification as { entries: Record<string, { status: string; fingerprint: string }> }).entries[ex.id];
    expect(entry, 'run `npm run verify:exercises`').toBeDefined();
    expect(entry.status).toBe('passed');
    expect(entry.fingerprint, 'content changed since verification: run `npm run verify:exercises`').toBe(exerciseFingerprint(ex));
    expect(isVerified(ex)).toBe(true);
  });

  it('mate objectives end in checkmate', () => {
    for (const ex of all.filter((e) => (e.kind ?? 'move') === 'move' && /\bmat en \d/i.test(e.objective))) {
      const g = new Chess(ex.fen);
      for (const u of ex.solution) g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      expect(g.isCheckmate(), ex.id).toBe(true);
      const n = Number(ex.objective.match(/mat en (\d)/i)![1]);
      expect(Math.ceil(ex.solution.length / 2), ex.id).toBe(n);
    }
  });

  it('only exposes verified exercises to the UI', () => {
    expect(UNVERIFIED_COUNT).toBe(0);
    expect(EXERCISES).toHaveLength(all.length);
  });

  it('covers every category of the curriculum', () => {
    const cats = new Set(all.map((e) => e.category));
    for (const c of ['tactics', 'strategy', 'endgame', 'opening']) expect(cats).toContain(c);
  });

  it('covers the planned tactical themes', () => {
    const themes = new Set(all.map((e) => e.theme));
    for (const t of ['fork', 'pin', 'discovered-attack', 'double-attack', 'deflection', 'attraction', 'mate', 'combination']) expect(themes).toContain(t);
  });
});

describe('validator catches bad content', () => {
  const base: Exercise = { ...(all[0] as Exercise) };
  it('rejects illegal solutions', () => {
    expect(validateExerciseRules({ ...base, solution: ['d1d8'] })[0]).toMatch(/illegal/);
  });
  it('rejects invalid FEN', () => {
    expect(validateExerciseRules({ ...base, fen: 'not a fen' })[0]).toMatch(/invalid FEN/);
  });
  it('rejects positions where the side not to move is in check', () => {
    expect(positionLegalityProblems('4k3/8/8/8/8/8/8/4RK2 w - - 0 1')).toContain('the side not to move is in check (impossible position)');
  });
  it('requires three progressive hints and an odd-length line', () => {
    expect(validateExerciseRules({ ...base, hints: ['a', 'b'] as unknown as Exercise['hints'] })).toContain('exactly 3 progressive hints are required');
    expect(validateExerciseRules({ ...base, solution: ['d1g4', 'b8c6'] }).join()).toMatch(/odd number/);
  });
});
