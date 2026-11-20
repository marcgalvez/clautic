import tactics from '@/data/exercises/tactics.json';
import threats from '@/data/exercises/threats.json';
import endgame from '@/data/exercises/endgame.json';
import strategy from '@/data/exercises/strategy.json';
import opening from '@/data/exercises/opening.json';
import verification from '@/data/exercises/verification.json';
import { exerciseFingerprint } from '@/lib/hash';
import type { Exercise, VerificationFile } from './types';

/** Built-in catalogue (all categories). */
export const CATALOGUE = [...tactics, ...threats, ...endgame, ...strategy, ...opening] as Exercise[];
const ALL = CATALOGUE;
const VERIFY = verification as unknown as VerificationFile;

/** True only if the engine verification matches the current content exactly. */
export function isVerified(ex: Exercise): boolean {
  const entry = VERIFY.entries[ex.id];
  return !!entry && entry.status === 'passed' && entry.fingerprint === exerciseFingerprint(ex);
}

/**
 * Exercises available to the user: only those whose position and solution were
 * verified (chess.js + Stockfish). Unverified content never reaches the UI.
 */
export const EXERCISES: Exercise[] = ALL.filter(isVerified);

export const UNVERIFIED_COUNT = ALL.length - EXERCISES.length;

export const VERIFICATION_META = { engine: VERIFY.engine, depth: VERIFY.depth, generatedAt: VERIFY.generatedAt };

const byId = new Map(EXERCISES.map((e) => [e.id, e]));

/** Exercises generated from the user's own games (verified in the browser when created). */
let custom: Exercise[] = [];
const customById = new Map<string, Exercise>();

export function registerCustomExercises(list: Exercise[]) {
  custom = list.filter((e) => !!e.inlineVerification);
  customById.clear();
  for (const e of custom) customById.set(e.id, e);
}

/** Built-in verified exercises plus the user's verified custom ones. */
export function allExercises(): Exercise[] {
  return custom.length ? [...EXERCISES, ...custom] : EXERCISES;
}

export function getExercise(id: string): Exercise | undefined {
  return byId.get(id) ?? customById.get(id);
}

export function exercisesByTheme(theme: string): Exercise[] {
  return EXERCISES.filter((e) => e.theme === theme);
}

export function exercisesByCategory(category: string): Exercise[] {
  return EXERCISES.filter((e) => e.category === category);
}
