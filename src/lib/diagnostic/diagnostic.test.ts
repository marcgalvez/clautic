import { describe, expect, it } from 'vitest';
import { DIAGNOSTIC_ITEMS, scoreDiagnostic, shouldStop, weakCompetences, COMPETENCE_LABELS } from './diagnostic';
import { getExercise } from '@/lib/exercises/bank';
import type { DiagnosticItemResult } from '@/lib/storage/types';

const q = { knowsRules: true, playsRegularly: 'weekly' as const, goals: [] };
const res = (correct: boolean, difficulty = 1, competences: DiagnosticItemResult['competences'] = ['tactics']): DiagnosticItemResult => ({
  exerciseId: 'x', competences, difficulty, correct, timeMs: 10_000,
});

describe('diagnostic', () => {
  it('uses only verified exercises, in non-decreasing difficulty, covering every competence twice', () => {
    let prev = 0;
    const count: Record<string, number> = {};
    for (const item of DIAGNOSTIC_ITEMS) {
      const ex = getExercise(item.exerciseId);
      expect(ex, item.exerciseId).toBeDefined();
      expect(ex!.difficulty).toBeGreaterThanOrEqual(prev - 1);
      prev = Math.max(prev, ex!.difficulty);
      for (const c of item.competences) count[c] = (count[c] ?? 0) + 1;
      if (item.justify) count.justification = (count.justification ?? 0) + 1;
    }
    for (const c of Object.keys(COMPETENCE_LABELS)) expect(count[c], c).toBeGreaterThanOrEqual(2);
  });

  it('stops after consecutive misses', () => {
    expect(shouldStop([res(true), res(false), res(false), res(false)])).toBe(false);
    expect(shouldStop([res(false), res(false), res(false), res(false)])).toBe(true);
  });

  it('scores competences and derives a start difficulty', () => {
    const d = scoreDiagnostic(
      [res(true, 1), res(true, 1), res(true, 2, ['endgame']), res(true, 2, ['endgame']), res(false, 3, ['calculation']), res(false, 3, ['calculation'])],
      q,
      false,
    );
    expect(d.competences.tactics).toEqual({ score: 1, n: 2 });
    expect(d.startDifficulty).toBe(2);
    expect(d.provisional).toBe(true); // fewer than 8 items
    expect(weakCompetences(d)).toEqual(['calculation']);
  });

  it('does not overestimate someone who does not know the rules', () => {
    expect(scoreDiagnostic([res(true, 3), res(true, 3)], { ...q, knowsRules: false }, false).startDifficulty).toBe(1);
  });

  it('measures justification separately', () => {
    const d = scoreDiagnostic([{ ...res(true), reasonCorrect: false }, { ...res(true), reasonCorrect: true }], q, false);
    expect(d.competences.justification).toEqual({ score: 0.5, n: 2 });
  });
});
