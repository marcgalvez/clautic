import { describe, expect, it } from 'vitest';
import { attemptQuality, outcomeOf } from './scoring';
import { applySessionToReviews, dueReviews, INTERVALS, scheduleReview } from './spacedRepetition';
import { budget, chooseLesson, pickExercises, planSession, targetDifficulty } from './sessionPlan';
import { strengthsAndWeaknesses, trainingLevel } from './stats';
import { EXERCISES } from '@/lib/exercises/bank';
import { LESSONS } from '@/data/lessons';
import type { Attempt, TrainingSession } from '@/lib/storage/types';

let n = 0;
function attempt(p: Partial<Attempt> = {}): Attempt {
  const base = { outcome: 'solved' as const, hintsUsed: 0, wrongMoves: 0, durationMs: 20_000, difficulty: 2 };
  const merged = { ...base, ...p };
  return {
    id: `a${n++}`,
    exerciseId: 'tac-fork-001',
    theme: 'fork',
    concepts: ['forquilla-cavall'],
    startedAt: new Date(Date.now() - n * 1000).toISOString(),
    firstTry: merged.outcome === 'solved',
    context: 'free',
    quality: attemptQuality(merged),
    ...merged,
  } as Attempt;
}

describe('attempt quality', () => {
  it('rewards clean, fast solutions', () => {
    expect(attemptQuality({ outcome: 'solved', hintsUsed: 0, wrongMoves: 0, durationMs: 10_000, difficulty: 1 })).toBe(1);
  });
  it('penalises hints, errors and slow solving — correct is not enough', () => {
    const clean = attemptQuality({ outcome: 'solved', hintsUsed: 0, wrongMoves: 0, durationMs: 20_000, difficulty: 2 });
    const hinted = attemptQuality({ outcome: 'solved-with-help', hintsUsed: 2, wrongMoves: 0, durationMs: 20_000, difficulty: 2 });
    const slow = attemptQuality({ outcome: 'solved', hintsUsed: 0, wrongMoves: 0, durationMs: 400_000, difficulty: 2 });
    expect(hinted).toBeLessThan(clean);
    expect(slow).toBeLessThan(clean);
    expect(attemptQuality({ outcome: 'revealed', hintsUsed: 3, wrongMoves: 3, durationMs: 1, difficulty: 2 })).toBe(0.1);
  });
  it('derives the outcome', () => {
    expect(outcomeOf({ solved: true, revealed: false, hintsUsed: 0, wrongMoves: 0 })).toBe('solved');
    expect(outcomeOf({ solved: true, revealed: false, hintsUsed: 1, wrongMoves: 0 })).toBe('solved-with-help');
    expect(outcomeOf({ solved: false, revealed: true, hintsUsed: 0, wrongMoves: 1 })).toBe('revealed');
  });
});

describe('spaced repetition', () => {
  const now = new Date('2026-01-01T10:00:00Z');
  it('uses the 1-3-7-14 ladder for good performance', () => {
    let r = scheduleReview(undefined, 'c', 0.6, now);
    expect(r.intervalDays).toBe(1);
    const days: number[] = [];
    for (let i = 0; i < 3; i++) {
      r = scheduleReview(r, 'c', 0.9, now);
      days.push(r.intervalDays);
    }
    expect(days).toEqual([3, 7, 14]);
    expect(INTERVALS.slice(0, 4)).toEqual([1, 3, 7, 14]);
  });
  it('repeats the interval on medium quality and resets on failure', () => {
    let r = scheduleReview(undefined, 'c', 0.9, now); // stage 1 (3 days)
    r = scheduleReview(r, 'c', 0.6, now);
    expect(r.intervalDays).toBe(3);
    r = scheduleReview(r, 'c', 0.2, now);
    expect(r.intervalDays).toBe(1);
  });
  it('lists due items', () => {
    const reviews = applySessionToReviews([], { a: 0.2, b: 0.95 }, now);
    expect(dueReviews(reviews, new Date('2026-01-02T11:00:00Z')).map((r) => r.conceptId)).toEqual(['a']);
  });
});

describe('adaptive difficulty', () => {
  it('stays put with little data', () => {
    expect(targetDifficulty([attempt(), attempt()])).toBe(1);
  });
  it('goes up only on high-quality solving, not just correct answers', () => {
    const clean = Array.from({ length: 5 }, () => attempt({ difficulty: 2 }));
    expect(targetDifficulty(clean)).toBe(3);
    const helped = Array.from({ length: 5 }, () => attempt({ difficulty: 2, outcome: 'solved-with-help', hintsUsed: 2 }));
    expect(targetDifficulty(helped)).toBe(2);
    const failing = Array.from({ length: 5 }, () => attempt({ difficulty: 3, outcome: 'revealed', wrongMoves: 3 }));
    expect(targetDifficulty(failing)).toBe(2);
  });
});

describe('session planning', () => {
  it('splits a 20-minute session as in the specification', () => {
    expect(budget(20, true, true)).toEqual({ warmup: 2, learn: 3, apply: 8, weakness: 5, consolidate: 2 });
  });
  it('starts with the first lesson for a new user and plans all four phases', () => {
    const plan = planSession({ minutes: 20, lessons: LESSONS, exercises: EXERCISES, attempts: [], sessions: [], reviews: [] });
    expect(plan.lessonId).toBe('loose-pieces');
    expect(plan.blocks.map((b) => b.kind)).toEqual(['understand', 'recall', 'apply', 'consolidate']);
    const apply = plan.blocks.find((b) => b.kind === 'apply')!;
    expect(apply.exerciseIds!.length).toBeGreaterThanOrEqual(3);
    expect(new Set(apply.exerciseIds).size).toBe(apply.exerciseIds!.length);
  });
  it('more minutes means more exercises', () => {
    const count = (m: 10 | 45) =>
      planSession({ minutes: m, lessons: LESSONS, exercises: EXERCISES, attempts: [], sessions: [], reviews: [] }).blocks.find((b) => b.kind === 'apply')!.exerciseIds!.length;
    expect(count(45)).toBeGreaterThan(count(10));
  });
  it('adds warm-up for due reviews and a weakness block for weak concepts', () => {
    const past = new Date(Date.now() - 5 * 86_400_000);
    const reviews = applySessionToReviews([], { 'clavada-absoluta': 0.3 }, past);
    const weak = [
      attempt({ exerciseId: 'tac-mate-001', theme: 'back-rank', concepts: ['mat-fila-darrere'], outcome: 'revealed' }),
      attempt({ exerciseId: 'tac-mate-004', theme: 'back-rank', concepts: ['mat-fila-darrere'], outcome: 'revealed' }),
    ];
    const plan = planSession({ minutes: 20, lessons: LESSONS, exercises: EXERCISES, attempts: weak, sessions: [], reviews });
    expect(plan.blocks[0]).toMatchObject({ kind: 'warmup', conceptIds: ['clavada-absoluta'] });
    const weakness = plan.blocks.find((b) => b.kind === 'weakness')!;
    expect(weakness.conceptIds).toContain('mat-fila-darrere');
    // mistakes come back in *different* positions when available
    expect(weakness.exerciseIds).not.toContain('tac-mate-001');
  });
  it('moves on to the next lesson after completing one', () => {
    const s: TrainingSession = { id: 's', lessonId: 'loose-pieces', plannedMinutes: 10, startedAt: '', completedAt: 'x', exerciseIds: [], attemptIds: [], recall: [] };
    expect(chooseLesson(LESSONS, [s], []).id).toBe('double-attacks');
  });
  it('prefers unseen exercises', () => {
    const seen = attempt({ exerciseId: 'tac-fork-001' });
    const pool = EXERCISES.filter((e) => e.theme === 'fork');
    const picked = pickExercises(pool, { count: 1, difficulty: 1, exclude: new Set(), attempts: [seen] });
    expect(picked[0].id).not.toBe('tac-fork-001');
  });
});

describe('strengths need varied evidence', () => {
  it('does not count repeating the same exercise as mastery', () => {
    const same = [attempt({ exerciseId: 'x' }), attempt({ exerciseId: 'x' }), attempt({ exerciseId: 'x' })];
    expect(strengthsAndWeaknesses(same).strengths).toHaveLength(0);
    const varied = [attempt({ exerciseId: 'x' }), attempt({ exerciseId: 'y' })];
    expect(strengthsAndWeaknesses(varied).strengths.map((s) => s.conceptId)).toEqual(['forquilla-cavall']);
  });
  it('marks the level as provisional with little data', () => {
    expect(trainingLevel([attempt()]).provisional).toBe(true);
  });
});
