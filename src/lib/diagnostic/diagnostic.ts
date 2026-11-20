import type { Competence, DiagnosticItemResult, DiagnosticResult } from '@/lib/storage/types';
import { getExercise } from '@/lib/exercises/bank';

export interface DiagnosticItem {
  exerciseId: string;
  competences: Competence[];
  /** Ask "why?" after answering, to assess the ability to justify a move. */
  justify?: { question: string; options: string[]; correct: number };
}

/** Ordered by increasing difficulty; every competence is measured at least twice. */
export const DIAGNOSTIC_ITEMS: DiagnosticItem[] = [
  { exerciseId: 'tac-hanging-001', competences: ['tactics'] },
  { exerciseId: 'thr-001', competences: ['threats'] },
  { exerciseId: 'op-f7-001', competences: ['opening', 'threats'] },
  { exerciseId: 'tac-fork-001', competences: ['tactics'] },
  {
    exerciseId: 'end-kp-001',
    competences: ['endgame'],
    justify: {
      question: 'Per què és aquesta la jugada correcta?',
      options: ['Perquè el rei ha de quedar-se davant del peó i mantenir l\'oposició', 'Perquè el rei ha d\'atacar el rei rival', 'Perquè els peons s\'han d\'avançar com més aviat millor'],
      correct: 0,
    },
  },
  {
    exerciseId: 'str-luft-001',
    competences: ['positional'],
    justify: {
      question: 'Quin és el motiu principal de la jugada?',
      options: ['Activar la torre a la setena fila', 'Evitar el mat a la fila del darrere donant aire al rei', 'Guanyar espai al flanc de rei'],
      correct: 1,
    },
  },
  { exerciseId: 'thr-002', competences: ['threats'] },
  { exerciseId: 'tac-mate-004', competences: ['calculation', 'tactics'] },
  { exerciseId: 'end-square-001', competences: ['endgame', 'calculation'] },
  { exerciseId: 'op-legal-001', competences: ['opening', 'calculation'] },
  {
    exerciseId: 'str-simplify-001',
    competences: ['positional', 'endgame'],
    justify: {
      question: 'Per què és la millor opció?',
      options: ['Perquè les torres sempre s\'han de canviar', 'Perquè el final de peons resultant està guanyat i elimina el contrajoc', 'Perquè el rei blanc queda més segur'],
      correct: 1,
    },
  },
  { exerciseId: 'tac-disc-002', competences: ['calculation', 'tactics'] },
  { exerciseId: 'tac-mate-005', competences: ['calculation'] },
];

/** Stop after this many consecutive misses: the remaining items would only frustrate. */
export const STOP_AFTER_CONSECUTIVE_MISSES = 4;

export const COMPETENCE_LABELS: Record<Competence, string> = {
  tactics: 'Visió tàctica',
  calculation: 'Càlcul de variants',
  opening: "Principis d'obertura",
  positional: 'Comprensió posicional',
  endgame: 'Finals',
  threats: "Detecció d'amenaces",
  justification: 'Justificar les jugades',
};

/** Concepts trained when a competence is weak (used by the session planner). */
export const COMPETENCE_CONCEPTS: Record<Competence, string[]> = {
  tactics: ['peces-indefenses', 'forquilla-cavall', 'clavada-absoluta'],
  calculation: ['revisio-escacs', 'sacrifici', 'calcul-curses'],
  opening: ['punt-feble-f7', 'trampes-obertura', 'desenvolupament'],
  positional: ['aire-al-rei', 'simplificar'],
  endgame: ['oposicio', 'caselles-clau', 'regla-quadrat'],
  threats: ['deteccio-amenaces', 'peces-indefenses'],
  justification: [],
};

export function shouldStop(results: DiagnosticItemResult[]): boolean {
  if (results.length < STOP_AFTER_CONSECUTIVE_MISSES) return false;
  return results.slice(-STOP_AFTER_CONSECUTIVE_MISSES).every((r) => !r.correct);
}

/** Time factor: a correct but very slow answer counts a bit less. */
function itemScore(r: DiagnosticItemResult): number {
  if (!r.correct) return 0;
  const reference = 30_000 * r.difficulty;
  return r.timeMs > reference * 3 ? 0.75 : 1;
}

export function scoreDiagnostic(
  results: DiagnosticItemResult[],
  questionnaire: DiagnosticResult['questionnaire'],
  stoppedEarly: boolean,
  now = new Date(),
): DiagnosticResult {
  const acc: Partial<Record<Competence, { sum: number; n: number }>> = {};
  for (const r of results) {
    for (const c of r.competences) {
      acc[c] ??= { sum: 0, n: 0 };
      acc[c]!.sum += itemScore(r);
      acc[c]!.n++;
    }
    if (r.reasonCorrect !== undefined) {
      acc.justification ??= { sum: 0, n: 0 };
      acc.justification.sum += r.reasonCorrect ? 1 : 0;
      acc.justification.n++;
    }
  }
  const competences: DiagnosticResult['competences'] = {};
  for (const [c, v] of Object.entries(acc)) competences[c as Competence] = { score: v!.sum / v!.n, n: v!.n };

  // Start difficulty: highest level where at least 60% of items were solved (min 1).
  let startDifficulty = 1;
  for (let d = 1; d <= 5; d++) {
    const at = results.filter((r) => r.difficulty === d);
    if (at.length && at.filter((r) => r.correct).length / at.length >= 0.6) startDifficulty = d;
  }
  if (!questionnaire.knowsRules) startDifficulty = 1;

  return {
    id: `diag_${now.getTime()}`,
    completedAt: now.toISOString(),
    questionnaire,
    items: results,
    competences,
    startDifficulty,
    provisional: results.length < 8 || stoppedEarly,
    stoppedEarly,
  };
}

/** Weak competences (score < 0.5 with at least 2 items). */
export function weakCompetences(d: DiagnosticResult | undefined): Competence[] {
  if (!d) return [];
  return (Object.entries(d.competences) as [Competence, { score: number; n: number }][])
    .filter(([, v]) => v.n >= 2 && v.score < 0.5)
    .sort((a, b) => a[1].score - b[1].score)
    .map(([c]) => c);
}

export function diagnosticItemExercise(item: DiagnosticItem) {
  return getExercise(item.exerciseId);
}
