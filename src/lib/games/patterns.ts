import type { ErrorType, StoredGame } from './types';

/** Which concepts train each error type (used to update the training plan). */
export const ERROR_TYPE_CONCEPTS: Record<ErrorType, string[]> = {
  'hanging-piece': ['peces-indefenses', 'revisio-captures'],
  'missed-threat': ['deteccio-amenaces', 'revisio-escacs'],
  calculation: ['revisio-escacs', 'sacrifici'],
  opening: ['desenvolupament', 'punt-feble-f7', 'trampes-obertura'],
  positional: ['aire-al-rei', 'simplificar'],
  endgame: ['oposicio', 'rei-actiu', 'regla-quadrat'],
  rushed: ['revisio-captures', 'deteccio-amenaces'],
};

export const ERROR_TYPE_LABELS: Record<ErrorType, string> = {
  'hanging-piece': 'Peces penjades',
  'missed-threat': 'Amenaces no detectades',
  calculation: 'Errors de càlcul',
  opening: "Errors d'obertura",
  positional: 'Problemes posicionals',
  endgame: 'Mala gestió dels finals',
  rushed: 'Decisions precipitades',
};

export interface PatternSummary {
  gamesAnalysed: number;
  /** Errors (mistakes + blunders) by type across games, most frequent first. */
  recurring: { type: ErrorType; count: number; games: number; engineVerified: number }[];
  byPhase: { opening: number; middlegame: number; endgame: number };
}

/** Phase of a ply, by move number (simple, documented heuristic). */
export function phaseOf(moveNumber: number, endgame: boolean): 'opening' | 'middlegame' | 'endgame' {
  if (endgame) return 'endgame';
  return moveNumber <= 12 ? 'opening' : 'middlegame';
}

export function summarizePatterns(games: StoredGame[]): PatternSummary {
  const analysed = games.filter((g) => g.analysis && g.userColor);
  const counts = new Map<ErrorType, { count: number; games: Set<string>; engineVerified: number }>();
  const byPhase = { opening: 0, middlegame: 0, endgame: 0 };
  for (const g of analysed) {
    for (const m of g.analysis!.moves) {
      if (m.color !== g.userColor || (m.classification !== 'mistake' && m.classification !== 'blunder')) continue;
      if (m.errorType) {
        const c = counts.get(m.errorType) ?? { count: 0, games: new Set(), engineVerified: 0 };
        c.count++;
        c.games.add(g.id);
        if (m.errorConfidence === 'engine-verified') c.engineVerified++;
        counts.set(m.errorType, c);
      }
      byPhase[phaseOf(m.moveNumber, m.errorType === 'endgame')]++;
    }
  }
  const recurring = [...counts.entries()]
    .map(([type, c]) => ({ type, count: c.count, games: c.games.size, engineVerified: c.engineVerified }))
    .sort((a, b) => b.count - a.count);
  return { gamesAnalysed: analysed.length, recurring, byPhase };
}

/**
 * Concepts to reinforce from games. A pattern counts as recurring only when it
 * appears in at least two different games (one game is not enough evidence).
 */
export function gameWeakConcepts(games: StoredGame[]): string[] {
  const { recurring } = summarizePatterns(games);
  const out: string[] = [];
  for (const r of recurring.filter((x) => x.games >= 2)) for (const c of ERROR_TYPE_CONCEPTS[r.type]) if (!out.includes(c)) out.push(c);
  return out.slice(0, 4);
}
