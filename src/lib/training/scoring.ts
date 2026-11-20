import type { Attempt, AttemptOutcome } from '@/lib/storage/types';

/** Reference solving time per difficulty level (ms). */
export const EXPECTED_TIME_MS: Record<number, number> = { 1: 30_000, 2: 60_000, 3: 90_000, 4: 150_000, 5: 240_000 };

export function outcomeOf(r: { solved: boolean; revealed: boolean; hintsUsed: number; wrongMoves: number }): AttemptOutcome {
  if (r.revealed) return 'revealed';
  if (!r.solved) return 'abandoned';
  return r.hintsUsed > 0 || r.wrongMoves > 0 ? 'solved-with-help' : 'solved';
}

/**
 * Learning-quality score 0..1. A correct answer is not enough: hints, wrong
 * tries and slow solving reduce the score, so difficulty does not go up just
 * because the final move was right.
 */
export function attemptQuality(a: Pick<Attempt, 'outcome' | 'hintsUsed' | 'wrongMoves' | 'durationMs' | 'difficulty'>): number {
  if (a.outcome === 'abandoned') return 0;
  if (a.outcome === 'revealed') return 0.1;
  let q = 1;
  q -= Math.min(0.6, 0.2 * a.hintsUsed);
  q -= Math.min(0.45, 0.15 * a.wrongMoves);
  const expected = EXPECTED_TIME_MS[a.difficulty] ?? 90_000;
  if (a.durationMs > expected * 3) q -= 0.15;
  else if (a.durationMs > expected * 1.5) q -= 0.05;
  return Math.max(0.15, Math.min(1, Math.round(q * 100) / 100));
}
