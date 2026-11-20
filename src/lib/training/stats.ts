import type { Attempt } from '@/lib/storage/types';
import { conceptQuality, targetDifficulty } from './sessionPlan';

export interface Summary {
  total: number;
  solvedClean: number;
  solvedWithHelp: number;
  revealed: number;
  /** Solved (with or without help) / total. */
  successRate: number;
  /** Solved first try, no hints / total. */
  cleanRate: number;
  avgTimeMs: number;
  avgHints: number;
  avgQuality: number;
}

export function summarize(attempts: Attempt[]): Summary {
  const total = attempts.length;
  const solvedClean = attempts.filter((a) => a.outcome === 'solved').length;
  const solvedWithHelp = attempts.filter((a) => a.outcome === 'solved-with-help').length;
  const revealed = attempts.filter((a) => a.outcome === 'revealed').length;
  const avg = (f: (a: Attempt) => number) => (total ? attempts.reduce((s, a) => s + f(a), 0) / total : 0);
  return {
    total,
    solvedClean,
    solvedWithHelp,
    revealed,
    successRate: total ? (solvedClean + solvedWithHelp) / total : 0,
    cleanRate: total ? solvedClean / total : 0,
    avgTimeMs: avg((a) => a.durationMs),
    avgHints: avg((a) => a.hintsUsed),
    avgQuality: avg((a) => a.quality),
  };
}

export function byKey(attempts: Attempt[], key: (a: Attempt) => string): Record<string, Summary> {
  const groups: Record<string, Attempt[]> = {};
  for (const a of attempts) (groups[key(a)] ??= []).push(a);
  return Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, summarize(v)]));
}

/**
 * Strengths need evidence from at least two *different* exercises, so that
 * repeating a memorised answer is not mistaken for mastery.
 */
export function strengthsAndWeaknesses(attempts: Attempt[]) {
  const cq = conceptQuality(attempts, 2);
  const strengths = Object.entries(cq)
    .filter(([, v]) => v.avg >= 0.8 && v.distinctExercises >= 2)
    .sort((a, b) => b[1].avg - a[1].avg)
    .map(([c, v]) => ({ conceptId: c, ...v }));
  const weaknesses = Object.entries(cq)
    .filter(([, v]) => v.avg < 0.6)
    .sort((a, b) => a[1].avg - b[1].avg)
    .map(([c, v]) => ({ conceptId: c, ...v }));
  return { strengths, weaknesses };
}

export const MIN_ATTEMPTS_FOR_LEVEL = 10;

/** Internal training level (1-5). Not an ELO and never presented as one. */
export function trainingLevel(attempts: Attempt[]): { level: number; provisional: boolean; basedOn: number } {
  return {
    level: targetDifficulty(attempts),
    provisional: attempts.length < MIN_ATTEMPTS_FOR_LEVEL,
    basedOn: attempts.length,
  };
}

/** Daily average quality (for the evolution chart). */
export function dailyQuality(attempts: Attempt[]): { day: string; avgQuality: number; n: number }[] {
  const days: Record<string, { sum: number; n: number }> = {};
  for (const a of attempts) {
    const d = a.startedAt.slice(0, 10);
    days[d] ??= { sum: 0, n: 0 };
    days[d].sum += a.quality;
    days[d].n++;
  }
  return Object.entries(days)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({ day, avgQuality: v.sum / v.n, n: v.n }));
}
