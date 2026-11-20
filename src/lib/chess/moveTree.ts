import { Chess } from 'chess.js';
import { parseUciMove } from '@/lib/engine/uci';

export const ROOT_ID = 'root';

export interface MoveNode {
  id: string;
  parentId: string | null;
  /** SAN of the move leading to this node (empty for root). */
  san: string;
  uci: string;
  /** FEN after the move. */
  fen: string;
  /** Half-move count from the tree root (root = 0). */
  ply: number;
  /** children[0] is the main continuation, the rest are variations. */
  children: string[];
  comment?: string;
  nags?: number[];
}

export interface MoveTree {
  nodes: Record<string, MoveNode>;
  headers: Record<string, string>;
}

let counter = 0;
const nextId = () => `n${(++counter).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function createTree(rootFen: string, headers: Record<string, string> = {}): MoveTree {
  // validates FEN (throws on invalid)
  const fen = new Chess(rootFen).fen();
  return {
    headers,
    nodes: { [ROOT_ID]: { id: ROOT_ID, parentId: null, san: '', uci: '', fen, ply: 0, children: [] } },
  };
}

export function rootFen(tree: MoveTree): string {
  return tree.nodes[ROOT_ID].fen;
}

/**
 * Adds a move after `parentId`. If the same move already exists it is reused.
 * Returns the (possibly new) tree and the id of the node. Throws on illegal moves.
 */
export function addMove(
  tree: MoveTree,
  parentId: string,
  move: string | { from: string; to: string; promotion?: string },
  extra: { comment?: string; nags?: number[] } = {},
): { tree: MoveTree; id: string } {
  const parent = tree.nodes[parentId];
  if (!parent) throw new Error(`Unknown node ${parentId}`);
  const game = new Chess(parent.fen);
  const played = typeof move === 'string'
    ? (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move) ? game.move(parseUciMove(move)) : game.move(move, { strict: false }))
    : game.move(move);
  const uci = `${played.from}${played.to}${played.promotion ?? ''}`;
  const existing = parent.children.find((c) => tree.nodes[c].uci === uci);
  if (existing) return { tree, id: existing };
  const id = nextId();
  const node: MoveNode = { id, parentId, san: played.san, uci, fen: game.fen(), ply: parent.ply + 1, children: [], ...extra };
  return {
    id,
    tree: {
      ...tree,
      nodes: { ...tree.nodes, [id]: node, [parentId]: { ...parent, children: [...parent.children, id] } },
    },
  };
}

/** Path of node ids from the root (excluded) to `id` (included). */
export function pathTo(tree: MoveTree, id: string): string[] {
  const path: string[] = [];
  let cur: MoveNode | undefined = tree.nodes[id];
  while (cur && cur.parentId !== null) {
    path.unshift(cur.id);
    cur = tree.nodes[cur.parentId];
  }
  return path;
}

/** Main line from a node (following children[0]). */
export function mainlineFrom(tree: MoveTree, id: string = ROOT_ID): string[] {
  const out: string[] = [];
  let cur = tree.nodes[id];
  while (cur && cur.children.length) {
    const next = cur.children[0];
    out.push(next);
    cur = tree.nodes[next];
  }
  return out;
}

/** Removes a node and its whole subtree. */
export function deleteNode(tree: MoveTree, id: string): MoveTree {
  if (id === ROOT_ID) return tree;
  const node = tree.nodes[id];
  if (!node || node.parentId === null) return tree;
  const nodes = { ...tree.nodes };
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    stack.push(...nodes[cur].children);
    delete nodes[cur];
  }
  const parent = nodes[node.parentId];
  nodes[node.parentId] = { ...parent, children: parent.children.filter((c) => c !== id) };
  return { ...tree, nodes };
}

/** Moves a variation to the main line position among its siblings. */
export function promoteVariation(tree: MoveTree, id: string): MoveTree {
  const node = tree.nodes[id];
  if (!node?.parentId) return tree;
  const parent = tree.nodes[node.parentId];
  const children = [id, ...parent.children.filter((c) => c !== id)];
  return { ...tree, nodes: { ...tree.nodes, [parent.id]: { ...parent, children } } };
}

/** Builds a chess.js game replaying the path to `id` (gives repetition detection). */
export function gameAt(tree: MoveTree, id: string): Chess {
  const g = new Chess(rootFen(tree));
  for (const nid of pathTo(tree, id)) g.move(parseUciMove(tree.nodes[nid].uci));
  return g;
}

/** Move number label for a node, e.g. "12." for white or "12..." for black. */
export function moveNumberLabel(tree: MoveTree, node: MoveNode, forceBlack = false): string {
  const parent = node.parentId ? tree.nodes[node.parentId] : null;
  if (!parent) return '';
  const [, turn, , , , full] = parent.fen.split(' ');
  if (turn === 'w') return `${full}.`;
  return forceBlack ? `${full}...` : '';
}
