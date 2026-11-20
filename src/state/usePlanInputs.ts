import { useMemo } from 'react';
import { useData } from './DataProvider';
import { COMPETENCE_CONCEPTS, weakCompetences } from '@/lib/diagnostic/diagnostic';
import { gameWeakConcepts } from '@/lib/games/patterns';

/** Inputs for the session planner derived from the diagnostic and analysed games. */
export function usePlanInputs() {
  const { data } = useData();
  return useMemo(() => {
    const diagnostic = data.diagnostics.at(-1);
    const external: { conceptId: string; source: 'diagnostic' | 'games' }[] = [];
    for (const c of gameWeakConcepts(data.games)) external.push({ conceptId: c, source: 'games' });
    for (const comp of weakCompetences(diagnostic))
      for (const c of COMPETENCE_CONCEPTS[comp]) if (!external.some((e) => e.conceptId === c)) external.push({ conceptId: c, source: 'diagnostic' });
    return { diagnostic, baseDifficulty: diagnostic?.startDifficulty ?? 1, externalWeakConcepts: external };
  }, [data.diagnostics, data.games]);
}
