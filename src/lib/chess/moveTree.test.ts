import { describe, expect, it } from 'vitest';
import { DEFAULT_POSITION } from 'chess.js';
import { addMove, createTree, deleteNode, gameAt, mainlineFrom, pathTo, promoteVariation, ROOT_ID } from './moveTree';

describe('move tree', () => {
  it('adds moves (SAN, UCI or objects) and reuses existing ones', () => {
    let t = createTree(DEFAULT_POSITION);
    const a = addMove(t, ROOT_ID, 'e4');
    t = a.tree;
    const b = addMove(t, ROOT_ID, 'e2e4');
    expect(b.id).toBe(a.id);
    const c = addMove(t, a.id, { from: 'e7', to: 'e5' });
    expect(c.tree.nodes[c.id].san).toBe('e5');
    expect(() => addMove(t, a.id, 'e4')).toThrow();
  });

  it('creates variations and promotes them', () => {
    let t = createTree(DEFAULT_POSITION);
    const e4 = addMove(t, ROOT_ID, 'e4');
    t = e4.tree;
    const d4 = addMove(t, ROOT_ID, 'd4');
    t = d4.tree;
    expect(t.nodes[ROOT_ID].children).toEqual([e4.id, d4.id]);
    t = promoteVariation(t, d4.id);
    expect(mainlineFrom(t)).toEqual([d4.id]);
  });

  it('deletes subtrees and computes paths / games', () => {
    let t = createTree(DEFAULT_POSITION);
    let id = ROOT_ID;
    for (const m of ['e4', 'e5', 'Nf3', 'Nc6']) {
      const r = addMove(t, id, m);
      t = r.tree;
      id = r.id;
    }
    expect(pathTo(t, id)).toHaveLength(4);
    expect(gameAt(t, id).history()).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
    const nf3 = pathTo(t, id)[2];
    t = deleteNode(t, nf3);
    expect(mainlineFrom(t)).toHaveLength(2);
    expect(Object.keys(t.nodes)).toHaveLength(3);
  });
});
