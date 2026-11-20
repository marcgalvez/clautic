import { describe, expect, it } from 'vitest';
import { formatScore, parseBestMove, parseInfoLine, parseUciMove, scoreToNumber, toWhitePov, winPercent } from './uci';

describe('parseInfoLine', () => {
  it('parses a centipawn multipv line', () => {
    const l = parseInfoLine('info depth 14 seldepth 23 multipv 2 score cp 226 nodes 10414 nps 260350 hashfull 5 time 40 pv c4f7 e8e7 f7b3');
    expect(l).toMatchObject({ depth: 14, seldepth: 23, multipv: 2, score: { type: 'cp', value: 226 }, nodes: 10414, timeMs: 40, pv: ['c4f7', 'e8e7', 'f7b3'] });
  });
  it('parses mate scores and bounds', () => {
    expect(parseInfoLine('info depth 3 multipv 1 score mate -2 pv e1e2')?.score).toEqual({ type: 'mate', value: -2 });
    expect(parseInfoLine('info depth 9 score cp 10 lowerbound pv e2e4')?.bound).toBe('lower');
  });
  it('ignores lines without score or pv', () => {
    expect(parseInfoLine('info string NNUE evaluation enabled')).toBeNull();
    expect(parseInfoLine('info depth 1 currmove e2e4 currmovenumber 1')).toBeNull();
    expect(parseInfoLine('readyok')).toBeNull();
  });
});

describe('bestmove and moves', () => {
  it('parses bestmove', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toEqual({ best: 'e2e4', ponder: 'e7e5' });
    expect(parseBestMove('bestmove (none)')).toEqual({ best: null, ponder: undefined });
  });
  it('parses UCI moves including promotions', () => {
    expect(parseUciMove('e7e8q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' });
    expect(parseUciMove('g1f3')).toEqual({ from: 'g1', to: 'f3' });
    expect(() => parseUciMove('e9e4')).toThrow();
  });
});

describe('scores', () => {
  it('converts to white point of view', () => {
    expect(toWhitePov({ type: 'cp', value: 50 }, 'b')).toEqual({ type: 'cp', value: -50 });
    expect(toWhitePov({ type: 'mate', value: 3 }, 'w')).toEqual({ type: 'mate', value: 3 });
  });
  it('formats scores', () => {
    expect(formatScore({ type: 'cp', value: 125 })).toBe('+1.25');
    expect(formatScore({ type: 'cp', value: -40 })).toBe('-0.40');
    expect(formatScore({ type: 'mate', value: -2 })).toBe('-M2');
  });
  it('win percent is monotonic and bounded', () => {
    expect(winPercent({ type: 'cp', value: 0 })).toBeCloseTo(50);
    expect(winPercent({ type: 'cp', value: 300 })).toBeGreaterThan(winPercent({ type: 'cp', value: 100 }));
    expect(winPercent({ type: 'mate', value: 1 })).toBe(100);
    expect(winPercent({ type: 'mate', value: -1 })).toBe(0);
  });
  it('orders mates above any cp score, shorter mates first', () => {
    expect(scoreToNumber({ type: 'mate', value: 1 })).toBeGreaterThan(scoreToNumber({ type: 'mate', value: 3 }));
    expect(scoreToNumber({ type: 'mate', value: 5 })).toBeGreaterThan(scoreToNumber({ type: 'cp', value: 2000 }));
  });
});
