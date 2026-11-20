import { describe, expect, it, vi } from 'vitest';
import { classifyLoss, classifyMistake, loosePieces, moveAccuracy, opponentThreats, isEndgame } from './classify';
import { clockFromComment } from './analyze';
import { LichessClient, SourceError, validateUsername } from './sources';
import { Chess } from 'chess.js';

describe('move classification', () => {
  it('uses expected-score loss thresholds', () => {
    expect(classifyLoss(60, 59)).toBe('best');
    expect(classifyLoss(60, 52)).toBe('good');
    expect(classifyLoss(60, 48)).toBe('inaccuracy');
    expect(classifyLoss(60, 38)).toBe('mistake');
    expect(classifyLoss(60, 20)).toBe('blunder');
    expect(moveAccuracy(50, 50)).toBeCloseTo(100, 0);
    expect(moveAccuracy(80, 20)).toBeLessThan(10);
  });

  it('finds loose pieces and opponent threats', () => {
    expect(loosePieces(new Chess('4k3/8/8/3q4/8/8/3N4/4K3 w - - 0 1'), 'b')).toEqual([]); // queen not attacked
    expect(loosePieces(new Chess('4k3/8/8/3q4/8/4N3/8/4K3 w - - 0 1'), 'b')).toEqual([{ square: 'd5', type: 'q' }]);
    const t = opponentThreats('4k3/8/8/8/3q4/8/8/R3K3 w - - 0 1');
    expect(t[0]).toMatchObject({ san: 'Qxa1+', kind: 'material', value: 5 });
  });

  it('detects a hanging piece only when the engine reply captures it (engine-verified)', () => {
    const fen = '4k3/8/8/8/1p6/8/8/2B1K3 w - - 0 1';
    // Ba3?? puts the bishop where the b4 pawn takes it, and the engine reply is exactly bxa3.
    const c = classifyMistake({ fenBefore: fen, playedUci: 'c1a3', bestUci: 'c1d2', refutation: ['b4a3'], winBefore: 70, winAfter: 40, moveNumber: 30 });
    expect(c).toMatchObject({ errorType: 'hanging-piece', confidence: 'engine-verified' });
    expect(c.facts.join(' ')).toContain('alfil de a3');
    // Same move, but the engine prefers another reply: not classified as a hanging piece.
    const other = classifyMistake({ fenBefore: fen, playedUci: 'c1a3', bestUci: 'c1d2', refutation: ['e8d7'], winBefore: 70, winAfter: 40, moveNumber: 30 });
    expect(other.errorType).not.toBe('hanging-piece');
  });

  it('detects a missed threat when the reply executes it', () => {
    // The rook on h5 threatens the undefended knight on a5; Kd2 ignores it and ...Rxa5 follows.
    const c = classifyMistake({ fenBefore: '4k3/8/8/N6r/8/8/8/4K3 w - - 0 1', playedUci: 'e1d2', bestUci: 'a5b3', refutation: ['h5a5'], winBefore: 70, winAfter: 30, moveNumber: 30 });
    expect(c).toMatchObject({ errorType: 'missed-threat', confidence: 'engine-verified' });
  });

  it('flags rushed decisions only with clock data', () => {
    const base = { fenBefore: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', playedUci: 'e2e3', bestUci: 'e2e4', refutation: [], winBefore: 70, winAfter: 40, moveNumber: 30 };
    expect(classifyMistake({ ...base, timeSpentSec: 1, medianTimeSec: 20 }).errorType).toBe('rushed');
    expect(classifyMistake(base).errorType).not.toBe('rushed');
  });

  it('detects endgames by material', () => {
    expect(isEndgame(new Chess())).toBe(false);
    expect(isEndgame(new Chess('4k3/4p3/8/8/8/8/4P3/R3K3 w - - 0 1'))).toBe(true);
  });

  it('parses clock comments', () => {
    expect(clockFromComment('[%clk 0:04:58]')).toBe(298);
    expect(clockFromComment('[%clk 1:00:00.5]')).toBe(3600.5);
    expect(clockFromComment('sense rellotge')).toBeUndefined();
  });
});

describe('Lichess client', () => {
  const ndjson = [
    JSON.stringify({ id: 'abc', variant: 'standard', speed: 'blitz', createdAt: 1767225600000, players: { white: { user: { name: 'Marta', id: 'marta' } }, black: { user: { name: 'Bob', id: 'bob' } } }, pgn: '[White "Marta"]\n\n1. e4 e5 *' }),
    JSON.stringify({ id: 'zzz', variant: 'chess960', pgn: '1. e4 *' }),
    '',
  ].join('\n');

  it('parses the ndjson game export and detects the user color', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(ndjson, { status: 200 }));
    const games = await new LichessClient(fetchImpl).fetchRecentGames('Marta', { max: 5 });
    expect(games).toHaveLength(1); // non-standard variants are skipped
    expect(games[0]).toMatchObject({ externalId: 'abc', userColor: 'w', source: 'lichess' });
    expect(fetchImpl.mock.calls[0][0]).toContain('/api/games/user/Marta?max=5');
    expect(fetchImpl.mock.calls[0][1].headers.Accept).toBe('application/x-ndjson');
  });

  it('maps ratings per time control and keeps the provisional flag', async () => {
    const body = { perfs: { blitz: { rating: 1500, games: 30, prov: false }, rapid: { rating: 1600, games: 3, prov: true }, puzzle: { rating: 1900, games: 100 }, bullet: { rating: 1500, games: 0 } } };
    const r = await new LichessClient(vi.fn().mockResolvedValue(new Response(JSON.stringify(body)))).fetchRatings('marta');
    expect(r.map((x) => [x.timeControl, x.rating, x.provisional])).toEqual([['blitz', 1500, false], ['rapid', 1600, true]]);
    expect(r.every((x) => x.platform === 'lichess' && x.source === 'api')).toBe(true);
  });

  it('converts rating history months (0-based)', async () => {
    const body = [{ name: 'Blitz', points: [[2026, 0, 15, 1490]] }, { name: 'Puzzles', points: [[2026, 0, 1, 2000]] }];
    const h = await new LichessClient(vi.fn().mockResolvedValue(new Response(JSON.stringify(body)))).fetchRatingHistory('marta');
    expect(h).toEqual([{ timeControl: 'blitz', date: '2026-01-15', rating: 1490 }]);
  });

  it('reports useful errors', async () => {
    await expect(new LichessClient(vi.fn().mockResolvedValue(new Response('{}', { status: 404 }))).fetchRatings('nobody')).rejects.toThrow(/no existeix/);
    await expect(new LichessClient(vi.fn().mockResolvedValue(new Response('{}', { status: 429 }))).fetchRatings('x1')).rejects.toThrow(/espera/);
    await expect(new LichessClient(vi.fn().mockRejectedValue(new TypeError('net'))).fetchRatings('x1')).rejects.toBeInstanceOf(SourceError);
    expect(validateUsername('a b')).not.toBeNull();
    expect(validateUsername('Magnus_Carlsen')).toBeNull();
  });
});
