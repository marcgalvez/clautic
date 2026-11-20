import { describe, expect, it } from 'vitest';
import { parsePgn, parsePgnGame, PgnError, splitPgnGames, treeToPgn } from './pgn';
import { mainlineFrom, ROOT_ID } from './moveTree';

const OPERA = `[Event "Paris"]
[Site "Paris FRA"]
[Date "1858.??.??"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 {This is a weak move already.} 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7
16. Qb8+ Nxb8 17. Rd8# 1-0`;

describe('PGN parser', () => {
  it('parses headers and the full mainline of a real game', () => {
    const g = parsePgnGame(OPERA);
    expect(g.headers.White).toBe('Paul Morphy');
    expect(g.result).toBe('1-0');
    expect(g.plyCount).toBe(33);
    const ids = mainlineFrom(g.tree);
    expect(g.tree.nodes[ids[ids.length - 1]].san).toBe('Rd8#');
    expect(g.tree.nodes[ids[5]].comment).toBe('This is a weak move already.');
  });

  it('parses nested variations, NAGs and suffix annotations', () => {
    const g = parsePgnGame('1. e4 e5 (1... c5 2. Nf3 (2. c3 d5) d6) 2. Nf3!? $1 Nc6?! *');
    const root = g.tree.nodes[ROOT_ID];
    const e4 = g.tree.nodes[root.children[0]];
    expect(e4.children.map((c) => g.tree.nodes[c].san)).toEqual(['e5', 'c5']);
    const c5 = g.tree.nodes[e4.children[1]];
    const nf3 = g.tree.nodes[c5.children[0]];
    expect(nf3.san).toBe('Nf3');
    expect(g.tree.nodes[c5.children[1]].san).toBe('c3');
    expect(g.tree.nodes[nf3.children[0]].san).toBe('d6');
    const mainNf3 = g.tree.nodes[g.tree.nodes[e4.children[0]].children[0]];
    expect(mainNf3.nags).toEqual([5, 1]);
    expect(g.plyCount).toBe(4);
  });

  it('accepts 0-0 castling, glued move numbers and custom FEN starts', () => {
    const g = parsePgnGame('[FEN "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"]\n\n1.0-0 0-0-0 *');
    const ids = mainlineFrom(g.tree);
    expect(ids.map((i) => g.tree.nodes[i].san)).toEqual(['O-O', 'O-O-O']);
  });

  it('reports illegal moves with their move number', () => {
    try {
      parsePgnGame('1. e4 e5 2. Ke3 *');
      throw new Error('should fail');
    } catch (e) {
      expect(e).toBeInstanceOf(PgnError);
      expect((e as PgnError).message).toContain('2.Ke3');
    }
  });

  it('reports structural errors', () => {
    expect(() => parsePgnGame('1. e4 (1. d4 *')).toThrow(/sense tancar/);
    expect(() => parsePgnGame('1. e4 {unclosed')).toThrow(/Comentari/);
    expect(() => parsePgnGame('[Event "x"]\n\n*')).toThrow(/cap jugada/);
  });

  it('splits multi-game files and keeps valid games when one fails', () => {
    const text = `${OPERA}\n\n[Event "Broken"]\n\n1. e4 e4 *\n\n[Event "Ok"]\n\n1. d4 d5 *`;
    expect(splitPgnGames(text)).toHaveLength(3);
    const { games, errors } = parsePgn(text);
    expect(games).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0].gameIndex).toBe(2);
  });

  it('round-trips through treeToPgn with variations and comments', () => {
    const src = '1. e4 e5 (1... c5 {Siciliana} 2. Nf3) 2. Nf3 Nc6 *';
    const out = treeToPgn(parsePgnGame(src).tree);
    const again = parsePgnGame(out);
    expect(mainlineFrom(again.tree).map((i) => again.tree.nodes[i].san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
    expect(out).toContain('(1... c5 {Siciliana} 2. Nf3)');
  });
});
