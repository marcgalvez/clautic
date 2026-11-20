import { describe, expect, it } from 'vitest';
import { Chess, type Square, type Color } from 'chess.js';
import { LESSONS } from './index';
import { CONCEPTS } from '@/data/concepts';
import { EXERCISES } from '@/lib/exercises/bank';
import { positionLegalityProblems } from '@/lib/exercises/validate';

const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');

function isHanging(fen: string, sq: Square): boolean {
  const g = new Chess(fen);
  const piece = g.get(sq);
  if (!piece || piece.color === g.turn()) return false;
  return g.isAttacked(sq, g.turn()) && !g.isAttacked(sq, piece.color);
}

function isPinned(fen: string, sq: Square): boolean {
  const g = new Chess(fen);
  const piece = g.get(sq);
  if (!piece || piece.type === 'k') return false;
  const king = g.findPiece({ type: 'k', color: piece.color })[0];
  g.remove(sq);
  return g.isAttacked(king, other(piece.color));
}

function knightForks(fen: string, sq: Square, targets: string[]): boolean {
  const g = new Chess(fen);
  const color = g.turn();
  g.put({ type: 'n', color }, sq);
  return targets.every((t) => g.attackers(t as Square, color).includes(sq));
}

describe('lessons', () => {
  it.each(LESSONS.map((l) => [l.id, l] as const))('%s example is a legal position', (_id, l) => {
    expect(positionLegalityProblems(l.understand.example.fen)).toEqual([]);
  });

  it.each(LESSONS.map((l) => [l.id, l] as const))('%s board question answer is objectively true and unique', (_id, l) => {
    const { fen, question: q } = l.understand.example;
    const g = new Chess(fen);
    if (q.kind === 'square') {
      const check = (sq: Square) =>
        q.predicate === 'hanging' ? isHanging(fen, sq) : q.predicate === 'pinned' ? isPinned(fen, sq) : knightForks(fen, sq, q.targets ?? []);
      for (const a of q.answer) expect(check(a as Square), `${a} should satisfy ${q.predicate}`).toBe(true);
      // uniqueness among candidate squares
      const candidates: Square[] =
        q.predicate === 'knight-fork'
          ? (g.moves({ verbose: true }).filter((m) => m.piece === 'n').map((m) => m.to) as Square[])
          : (g.board().flat().filter((p) => p && p.color !== g.turn()).map((p) => p!.square) as Square[]);
      const satisfying = [...new Set(candidates)].filter(check);
      expect(satisfying.sort()).toEqual([...q.answer].sort());
    } else {
      const mates = g.moves({ verbose: true }).filter((m) => {
        const c = new Chess(fen);
        c.move(m);
        return c.isCheckmate();
      });
      expect(mates.map((m) => m.lan).sort()).toEqual([...q.answer].sort());
    }
  });

  it('recall questions are well formed', () => {
    for (const l of LESSONS) {
      expect(l.recall.length).toBeGreaterThanOrEqual(3);
      for (const r of l.recall) {
        expect(r.correct).toBeGreaterThanOrEqual(0);
        expect(r.correct).toBeLessThan(r.options.length);
      }
    }
  });

  it('every lesson concept is defined and has exercises to apply it', () => {
    for (const l of LESSONS) {
      for (const c of l.conceptIds) expect(CONCEPTS[c], c).toBeDefined();
      const pool = EXERCISES.filter((e) => l.themes.includes(e.theme));
      expect(pool.length, l.id).toBeGreaterThanOrEqual(3);
    }
    for (const e of EXERCISES) for (const c of e.concepts) expect(CONCEPTS[c], `${e.id}:${c}`).toBeDefined();
  });
});
