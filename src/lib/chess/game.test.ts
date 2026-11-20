import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { formatSanLine, gameStatus, isPromotionMove, tryUciMove, uciLineToSan } from './game';

describe('chess rules (validated by chess.js, never by the AI)', () => {
  it('allows castling on both sides when legal', () => {
    const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
    expect(tryUciMove(fen, 'e1g1')?.move.san).toBe('O-O');
    expect(tryUciMove(fen, 'e1c1')?.move.san).toBe('O-O-O');
  });
  it('forbids castling through check', () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    const attacked = '4kr2/8/8/8/8/8/8/R3K2R w KQ - 0 1'; // f1 is attacked by the rook on f8
    expect(tryUciMove(fen, 'e1g1')).not.toBeNull();
    expect(tryUciMove(attacked, 'e1g1')).toBeNull();
  });
  it('supports en passant', () => {
    const g = new Chess('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2');
    const m = g.move('exd6');
    expect(m.isEnPassant()).toBe(true);
    expect(g.get('d5')).toBeUndefined();
  });
  it('detects promotion moves and promotes to any piece', () => {
    const g = new Chess('8/4P3/8/8/8/8/k7/4K3 w - - 0 1');
    expect(isPromotionMove(g, 'e7', 'e8')).toBe(true);
    expect(tryUciMove(g.fen(), 'e7e8n')?.move.san).toBe('e8=N');
    expect(tryUciMove(g.fen(), 'e7e8q')?.move.san).toBe('e8=Q');
  });
  it('rejects illegal moves', () => {
    expect(tryUciMove(new Chess().fen(), 'e2e5')).toBeNull();
    // pinned piece cannot move
    expect(tryUciMove('4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1', 'e2d3')).toBeNull();
  });
});

describe('gameStatus', () => {
  it('detects checkmate', () => {
    const g = new Chess();
    for (const m of ['f3', 'e5', 'g4', 'Qh4#']) g.move(m);
    expect(gameStatus(g)).toEqual({ kind: 'checkmate', winner: 'b' });
  });
  it('detects stalemate', () => {
    expect(gameStatus(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'))).toEqual({ kind: 'stalemate' });
  });
  it('detects insufficient material', () => {
    expect(gameStatus(new Chess('8/8/4k3/8/8/3NK3/8/8 w - - 0 1'))).toEqual({ kind: 'draw', reason: 'insufficient-material' });
  });
  it('detects threefold repetition', () => {
    const g = new Chess();
    for (let i = 0; i < 2; i++) for (const m of ['Nf3', 'Nf6', 'Ng1', 'Ng8']) g.move(m);
    expect(gameStatus(g)).toEqual({ kind: 'draw', reason: 'threefold-repetition' });
  });
  it('detects the fifty-move rule', () => {
    expect(gameStatus(new Chess('8/8/4k3/8/8/4K3/4R3/8 w - - 100 80'))).toEqual({ kind: 'draw', reason: 'fifty-moves' });
  });
  it('reports check while playing', () => {
    expect(gameStatus(new Chess('4k3/8/8/8/8/8/8/4RK2 b - - 0 1'))).toEqual({ kind: 'playing', check: true });
  });
});

describe('SAN helpers', () => {
  it('converts a UCI line to SAN and numbers it', () => {
    const start = new Chess().fen();
    const sans = uciLineToSan(start, ['e2e4', 'e7e5', 'g1f3', 'zz']);
    expect(sans).toEqual(['e4', 'e5', 'Nf3']);
    expect(formatSanLine(start, sans)).toBe('1. e4 e5 2. Nf3');
    expect(formatSanLine('4k3/8/8/8/8/8/8/4K3 b - - 0 12', ['Kd7', 'Kd2'])).toBe('12... Kd7 13. Kd2');
  });
});
