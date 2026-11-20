// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error - plain JS helper shared with the verification script
import { createEngine } from '../../../scripts/lib/node-engine.mjs';
import { analyseGame } from './analyze';
import { exercisesFromGame } from './generate';
import { summarizePatterns, gameWeakConcepts } from './patterns';
import type { StoredGame } from './types';
import type { EngineLine } from '@/lib/engine/uci';

const PGN = `[White "Usuari"]
[Black "Rival"]
[Result "0-1"]
[TimeControl "300+0"]

1. e4 { [%clk 0:05:00] } e5 { [%clk 0:05:00] } 2. Nf3 { [%clk 0:04:55] } Nc6 { [%clk 0:04:58] } 3. Bc4 { [%clk 0:04:50] } Nd4 { [%clk 0:04:55] }
4. Nxe5 { [%clk 0:04:45] } Qg5 { [%clk 0:04:50] } 5. Nxf7 { [%clk 0:04:44] } Qxg2 { [%clk 0:04:45] } 6. Rf1 { [%clk 0:04:30] } Qxe4+ { [%clk 0:04:40] }
7. Be2 { [%clk 0:04:20] } Nf3# 0-1`;

type Engine = { init(): Promise<void>; analyse(fen: string, o: { depth: number; multipv: number }): Promise<{ lines: EngineLine[] }>; quit(): void };
let engine: Engine;
beforeAll(async () => {
  engine = createEngine();
  await engine.init();
}, 30_000);
afterAll(() => engine?.quit());

describe('game analysis with Stockfish', () => {
  it('explains why the user lost and generates a verified exercise', async () => {
    const analyse = async (fen: string, depth: number) => {
      const r = await engine.analyse(fen, { depth, multipv: 1 });
      return r.lines[0] ? { score: r.lines[0].score, pv: r.lines[0].pv } : null;
    };
    const { moves, report } = await analyseGame(PGN, 'w', analyse, { depth: 12 });
    expect(moves).toHaveLength(14);
    const nxf7 = moves.find((m) => m.san === 'Nxf7')!;
    expect(nxf7.classification).toBe('blunder');
    // ...Qg5 threatened Qxg2 (winning material / opening the king): the reply executes the threat.
    expect(['missed-threat', 'hanging-piece', 'calculation']).toContain(nxf7.errorType);
    expect(nxf7.timeSpentSec).toBe(1); // played in 1 second (clock data)
    expect(report.decisivePly).not.toBeNull();
    expect(report.counts.blunder).toBeGreaterThanOrEqual(1);
    expect(report.verdict.join(' ')).toMatch(/es va decidir/);
    expect(report.recommendations.length).toBeGreaterThan(0);
    // the mated side gets 0%, the mating side 100%
    expect(moves.at(-1)!.winAfter).toBe(100);

    const game: StoredGame = { id: 'g1', source: 'pgn', pgn: PGN, headers: { White: 'Usuari', Black: 'Rival' }, userColor: 'w', importedAt: '', analysis: { depth: 12, analysedAt: '', moves, report } };
    const multi = async (fen: string, depth: number, multipv: number) => (await engine.analyse(fen, { depth, multipv })).lines;
    // In this game the alternatives to each mistake are close: no fair (unique) exercise exists.
    expect(await exercisesFromGame(game, multi, 3)).toEqual([]);

    // Second game: the user ignores a hanging queen (2...Qh4?? 3.d3?), which has a unique answer.
    const PGN2 = '[White "Usuari"]\n[Black "Rival"]\n[Result "*"]\n\n1. e4 e5 2. Nf3 Qh4 3. d3 Qf6 4. Nc3 *';
    const a2 = await analyseGame(PGN2, 'w', analyse, { depth: 12 });
    const game2: StoredGame = { ...game, id: 'g2', pgn: PGN2, analysis: { depth: 12, analysedAt: '', moves: a2.moves, report: a2.report } };
    const exercises = await exercisesFromGame(game2, multi, 3);
    expect(exercises).toHaveLength(1);
    expect(exercises[0].solution).toEqual(['f3h4']);
    expect(exercises[0].hints).toHaveLength(3);
    expect(exercises[0].inlineVerification).toBeDefined();
    expect(exercises[0].explanation).toContain('Cxh4');

    const patterns = summarizePatterns([game, { ...game, id: 'g2' }]);
    expect(patterns.gamesAnalysed).toBe(2);
    expect(gameWeakConcepts([game])).toEqual([]); // one game is not enough evidence
    expect(gameWeakConcepts([game, { ...game, id: 'g2' }]).length).toBeGreaterThan(0);
  }, 120_000);
});
