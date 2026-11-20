import tactics from '@/data/exercises/tactics.json';
import verification from '@/data/exercises/verification.json';
import { exerciseFingerprint } from '@/lib/hash';
import type { Exercise, VerificationFile } from './types';

const ALL = tactics as Exercise[];
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

export function getExercise(id: string): Exercise | undefined {
  return byId.get(id);
}

export function exercisesByTheme(theme: string): Exercise[] {
  return EXERCISES.filter((e) => e.theme === theme);
}
