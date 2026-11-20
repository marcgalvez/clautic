import type { Exercise } from '@/lib/exercises/types';
import type { Lesson } from './lessonTypes';
import type { Attempt, ReviewItem, SessionMinutes, TrainingSession } from '@/lib/storage/types';
import { dueReviews } from './spacedRepetition';

export interface SessionBlock {
  kind: 'warmup' | 'understand' | 'recall' | 'apply' | 'weakness' | 'consolidate';
  minutes: number;
  exerciseIds?: string[];
  /** Concepts targeted by warm-up / weakness blocks. */
  conceptIds?: string[];
}

export interface SessionPlan {
  lessonId: string;
  minutes: SessionMinutes;
  blocks: SessionBlock[];
  targetDifficulty: number;
  /** Why this plan was chosen, in plain Catalan (shown to the user). */
  rationale: string[];
}

/** Average learning quality per concept, only counting concepts with ≥ minAttempts. */
export function conceptQuality(attempts: Attempt[], minAttempts = 1): Record<string, { avg: number; n: number; distinctExercises: number }> {
  const acc: Record<string, { sum: number; n: number; ex: Set<string> }> = {};
  for (const a of attempts) {
    for (const c of a.concepts) {
      acc[c] ??= { sum: 0, n: 0, ex: new Set() };
      acc[c].sum += a.quality;
      acc[c].n++;
      acc[c].ex.add(a.exerciseId);
    }
  }
  const out: Record<string, { avg: number; n: number; distinctExercises: number }> = {};
  for (const [c, v] of Object.entries(acc)) {
    if (v.n >= minAttempts) out[c] = { avg: v.sum / v.n, n: v.n, distinctExercises: v.ex.size };
  }
  return out;
}

/**
 * Difficulty target from recent attempts. It only goes up when the last
 * attempts at the current level were solved cleanly (quality, not just
 * correctness) and goes down after struggling.
 */
export function targetDifficulty(attempts: Attempt[], base = 1): number {
  const recent = [...attempts].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 8);
  if (recent.length < 3) return base;
  const level = Math.round(recent.reduce((s, a) => s + a.difficulty, 0) / recent.length);
  const q = recent.reduce((s, a) => s + a.quality, 0) / recent.length;
  if (q >= 0.8) return Math.min(5, level + 1);
  if (q < 0.5) return Math.max(1, level - 1);
  return Math.max(1, level);
}

/** Picks the lesson: first unseen lesson in order, then the weakest one. */
export function chooseLesson(lessons: Lesson[], sessions: TrainingSession[], attempts: Attempt[]): Lesson {
  const sorted = [...lessons].sort((a, b) => a.order - b.order);
  const done = new Set(sessions.filter((s) => s.completedAt).map((s) => s.lessonId));
  const unseen = sorted.find((l) => !done.has(l.id));
  if (unseen) return unseen;
  const cq = conceptQuality(attempts);
  const score = (l: Lesson) => {
    const vals = l.conceptIds.map((c) => cq[c]?.avg).filter((v): v is number => v !== undefined);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  };
  return [...sorted].sort((a, b) => score(a) - score(b))[0];
}

interface PickOptions {
  count: number;
  difficulty: number;
  exclude: Set<string>;
  attempts: Attempt[];
  /** Hard-exclude exercises attempted less than this many days ago. */
  avoidRecentDays?: number;
}

/**
 * Picks exercises, preferring (1) never attempted, (2) closest to the target
 * difficulty, (3) not attempted recently. Positions failed recently are
 * avoided so mistakes come back in *different* positions.
 */
export function pickExercises(pool: Exercise[], { count, difficulty, exclude, attempts, avoidRecentDays }: PickOptions): Exercise[] {
  const last = new Map<string, Attempt>();
  for (const a of attempts) {
    const prev = last.get(a.exerciseId);
    if (!prev || prev.startedAt < a.startedAt) last.set(a.exerciseId, a);
  }
  const recentCutoff = avoidRecentDays ? Date.now() - avoidRecentDays * 86_400_000 : null;
  const candidates = pool.filter((e) => {
    if (exclude.has(e.id) || count <= 0) return false;
    const prev = last.get(e.id);
    return !(recentCutoff && prev && new Date(prev.startedAt).getTime() > recentCutoff);
  });
  const score = (e: Exercise) => {
    const prev = last.get(e.id);
    let s = Math.abs(e.difficulty - difficulty) * 10;
    if (prev) {
      s += 30;
      const ageDays = (Date.now() - new Date(prev.startedAt).getTime()) / 86_400_000;
      s += Math.max(0, 20 - ageDays * 4); // recently seen → less attractive
    }
    return s;
  };
  return candidates
    .map((e) => ({ e, s: score(e) }))
    .sort((a, b) => a.s - b.s || a.e.id.localeCompare(b.e.id))
    .slice(0, count)
    .map((x) => x.e);
}

/** Time budget split. Follows the 20' example: 3' recall, 10' tactics, 5' weakness, 2' reflection. */
export function budget(minutes: SessionMinutes, hasWarmup: boolean, hasWeakness: boolean) {
  const consolidate = Math.max(1, Math.round(minutes * 0.1));
  const warmup = hasWarmup ? Math.max(1, Math.round(minutes * 0.1)) : 0;
  const learn = Math.max(2, Math.round(minutes * 0.15)); // understand + recall
  const weakness = hasWeakness ? Math.round(minutes * 0.25) : 0;
  const apply = Math.max(2, minutes - consolidate - warmup - learn - weakness);
  return { warmup, learn, apply, weakness, consolidate };
}

/** ~2 minutes per exercise on average (shorter for easy ones). */
export function exercisesForMinutes(minutes: number, difficulty: number): number {
  const perExercise = difficulty <= 2 ? 1.5 : difficulty <= 3 ? 2 : 3;
  return Math.max(1, Math.round(minutes / perExercise));
}

export function planSession(args: {
  minutes: SessionMinutes;
  lessons: Lesson[];
  exercises: Exercise[];
  attempts: Attempt[];
  sessions: TrainingSession[];
  reviews: ReviewItem[];
  now?: Date;
  lessonId?: string;
  /** Start level from the initial diagnostic (used until there are enough attempts). */
  baseDifficulty?: number;
  /** Concepts flagged as weak outside training (diagnostic, analysed games). */
  externalWeakConcepts?: { conceptId: string; source: 'diagnostic' | 'games' }[];
}): SessionPlan {
  const { minutes, lessons, exercises, attempts, sessions, reviews } = args;
  const now = args.now ?? new Date();
  const lesson = (args.lessonId && lessons.find((l) => l.id === args.lessonId)) || chooseLesson(lessons, sessions, attempts);
  const rationale: string[] = [];
  const difficulty = targetDifficulty(attempts, args.baseDifficulty ?? 1);

  const due = dueReviews(reviews, now).filter((r) => !lesson.conceptIds.includes(r.conceptId));
  const warmupConcepts = due.slice(0, 3).map((r) => r.conceptId);

  const cq = conceptQuality(attempts, 2);
  const weakConcepts = Object.entries(cq)
    .filter(([c, v]) => v.avg < 0.6 && !lesson.conceptIds.includes(c))
    .sort((a, b) => a[1].avg - b[1].avg)
    .map(([c]) => c)
    .slice(0, 2);
  // Concepts flagged by the diagnostic or by game analysis, while practice has not confirmed them yet.
  const external = (args.externalWeakConcepts ?? []).filter(
    (w) => !lesson.conceptIds.includes(w.conceptId) && !weakConcepts.includes(w.conceptId) && (cq[w.conceptId]?.avg ?? 0) < 0.8,
  );
  for (const w of external) if (weakConcepts.length < 2) weakConcepts.push(w.conceptId);
  const externalSources = new Set(external.filter((w) => weakConcepts.includes(w.conceptId)).map((w) => w.source));

  const b = budget(minutes, warmupConcepts.length > 0, weakConcepts.length > 0);
  const used = new Set<string>();

  const lessonPool = exercises.filter((e) => lesson.themes.includes(e.theme) || e.concepts.some((c) => lesson.conceptIds.includes(c)));
  const applyCount = exercisesForMinutes(b.apply, difficulty);
  // ~75% from the lesson, the rest interleaved from other themes (interleaving improves transfer).
  const mainCount = Math.max(1, Math.ceil(applyCount * 0.75));
  const main = pickExercises(lessonPool, { count: mainCount, difficulty, exclude: used, attempts });
  main.forEach((e) => used.add(e.id));
  const others = exercises.filter((e) => !lessonPool.includes(e));
  const mixed = pickExercises(others, { count: applyCount - main.length, difficulty, exclude: used, attempts });
  mixed.forEach((e) => used.add(e.id));
  // top up from the lesson pool if not enough interleaved exercises exist
  const topUp = pickExercises(lessonPool, { count: applyCount - main.length - mixed.length, difficulty, exclude: used, attempts });
  topUp.forEach((e) => used.add(e.id));
  const applyIds = interleave([...main, ...topUp].map((e) => e.id), mixed.map((e) => e.id));

  let weaknessIds: string[] = [];
  if (weakConcepts.length) {
    const pool = exercises.filter((e) => e.concepts.some((c) => weakConcepts.includes(c)));
    // Mistakes must come back in *different* positions: recent attempts are excluded.
    weaknessIds = pickExercises(pool, { count: exercisesForMinutes(b.weakness, difficulty), difficulty, exclude: used, attempts, avoidRecentDays: 1 }).map((e) => e.id);
    weaknessIds.forEach((id) => used.add(id));
  }

  const blocks: SessionBlock[] = [];
  if (warmupConcepts.length) {
    blocks.push({ kind: 'warmup', minutes: b.warmup, conceptIds: warmupConcepts });
    rationale.push(`Tens ${due.length} repàs${due.length === 1 ? '' : 'sos'} pendent${due.length === 1 ? '' : 's'}: començarem recuperant-ne els conceptes.`);
  }
  blocks.push({ kind: 'understand', minutes: Math.ceil(b.learn / 2) });
  blocks.push({ kind: 'recall', minutes: Math.floor(b.learn / 2) || 1 });
  blocks.push({ kind: 'apply', minutes: b.apply, exerciseIds: applyIds });
  if (weaknessIds.length) {
    blocks.push({ kind: 'weakness', minutes: b.weakness, exerciseIds: weaknessIds, conceptIds: weakConcepts });
    rationale.push(
      externalSources.has('games')
        ? 'Les teves partides mostren errors recurrents: els treballarem amb posicions noves.'
        : externalSources.has('diagnostic')
          ? 'El diagnòstic va detectar un punt feble: el treballarem amb posicions noves.'
          : 'Hi ha conceptes amb un rendiment baix: els treballarem amb posicions noves.',
    );
  }
  blocks.push({ kind: 'consolidate', minutes: b.consolidate });

  const doneBefore = sessions.some((s) => s.lessonId === lesson.id && s.completedAt);
  rationale.unshift(doneBefore ? `Repassem «${lesson.title}», on encara hi ha marge de millora.` : `Tema nou: «${lesson.title}».`);
  if (attempts.length < 3) rationale.push('Encara hi ha poques dades: la dificultat és provisional i s\'ajustarà amb els teus resultats.');

  return { lessonId: lesson.id, minutes, blocks, targetDifficulty: difficulty, rationale };
}

function interleave(a: string[], b: string[]): string[] {
  const out: string[] = [];
  const step = b.length ? Math.max(1, Math.floor(a.length / (b.length + 1))) : a.length;
  let bi = 0;
  a.forEach((id, i) => {
    out.push(id);
    if ((i + 1) % step === 0 && bi < b.length && i < a.length - 1) out.push(b[bi++]);
  });
  while (bi < b.length) out.push(b[bi++]);
  return out;
}
