import { Chess, DEFAULT_POSITION } from 'chess.js';
import { addMove, createTree, mainlineFrom, ROOT_ID, type MoveTree, type MoveNode } from './moveTree';

export class PgnError extends Error {
  /** 1-based index of the game inside the PGN text (for multi-game files). */
  gameIndex: number;
  /** Token that failed, when applicable. */
  token?: string;
  moveNumber?: string;
  constructor(message: string, opts: { gameIndex?: number; token?: string; moveNumber?: string } = {}) {
    super(message);
    this.name = 'PgnError';
    this.gameIndex = opts.gameIndex ?? 1;
    this.token = opts.token;
    this.moveNumber = opts.moveNumber;
  }
}

type Token =
  | { t: 'move'; v: string; num?: string }
  | { t: 'comment'; v: string }
  | { t: 'nag'; v: number }
  | { t: 'open' }
  | { t: 'close' }
  | { t: 'result'; v: string };

const NAG_SUFFIX: Record<string, number> = { '!': 1, '?': 2, '!!': 3, '??': 4, '!?': 5, '?!': 6 };

/** Splits a multi-game PGN text into individual game texts. */
export function splitPgnGames(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '').trim();
  if (!normalized) return [];
  const games: string[] = [];
  let current: string[] = [];
  let seenMoves = false;
  for (const line of normalized.split('\n')) {
    const isHeader = /^\s*\[\w+\s+".*"\]\s*$/.test(line);
    if (isHeader && seenMoves) {
      games.push(current.join('\n'));
      current = [];
      seenMoves = false;
    }
    if (!isHeader && line.trim()) seenMoves = true;
    current.push(line);
  }
  if (current.join('').trim()) games.push(current.join('\n'));
  return games;
}

function parseHeaders(text: string): { headers: Record<string, string>; body: string } {
  const headers: Record<string, string> = {};
  const lines = text.split('\n');
  let i = 0;
  for (; i < lines.length; i++) {
    const m = lines[i].match(/^\s*\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/);
    if (m) headers[m[1]] = m[2].replace(/\\(.)/g, '$1');
    else if (lines[i].trim() === '') continue;
    else break;
  }
  return { headers, body: lines.slice(i).join('\n') };
}

function tokenize(body: string, gameIndex: number): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let pendingNumber: string | undefined;
  while (i < body.length) {
    const c = body[i];
    if (/\s/.test(c)) {
      i++;
    } else if (c === '{') {
      const end = body.indexOf('}', i);
      if (end < 0) throw new PgnError('Comentari sense tancar ("{" sense "}")', { gameIndex });
      tokens.push({ t: 'comment', v: body.slice(i + 1, end).trim() });
      i = end + 1;
    } else if (c === ';') {
      const end = body.indexOf('\n', i);
      tokens.push({ t: 'comment', v: body.slice(i + 1, end < 0 ? undefined : end).trim() });
      i = end < 0 ? body.length : end + 1;
    } else if (c === '%' && (i === 0 || body[i - 1] === '\n')) {
      const end = body.indexOf('\n', i);
      i = end < 0 ? body.length : end + 1;
    } else if (c === '(') {
      tokens.push({ t: 'open' });
      i++;
    } else if (c === ')') {
      tokens.push({ t: 'close' });
      i++;
    } else if (c === '$') {
      const m = body.slice(i).match(/^\$(\d+)/);
      if (!m) throw new PgnError('NAG invàlid', { gameIndex, token: body.slice(i, i + 4) });
      tokens.push({ t: 'nag', v: Number(m[1]) });
      i += m[0].length;
    } else {
      const m = body.slice(i).match(/^[^\s{}();$]+/);
      const word = m ? m[0] : c;
      i += word.length;
      if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(word)) {
        tokens.push({ t: 'result', v: word });
        continue;
      }
      // Move numbers like "12." "12..." possibly glued to the move: "12.e4"
      const num = word.match(/^(\d+)(\.+)(.*)$/);
      let san = word;
      if (num) {
        pendingNumber = `${num[1]}${num[2]}`;
        san = num[3];
        if (!san) continue;
      } else if (/^\d+$/.test(word)) {
        pendingNumber = word;
        continue;
      }
      const suffix = san.match(/(!!|\?\?|!\?|\?!|!|\?)$/);
      if (suffix) san = san.slice(0, -suffix[0].length);
      tokens.push({ t: 'move', v: san, num: pendingNumber });
      pendingNumber = undefined;
      if (suffix) tokens.push({ t: 'nag', v: NAG_SUFFIX[suffix[0]] });
    }
  }
  return tokens;
}

function normalizeSan(san: string): string {
  // Accept 0-0 / 0-0-0 and "e8=Q" / "e8Q" variants.
  return san.replace(/^0-0-0/, 'O-O-O').replace(/^0-0/, 'O-O').replace(/^([a-h][18])([QRBN])$/, '$1=$2');
}

export interface ParsedGame {
  tree: MoveTree;
  headers: Record<string, string>;
  result?: string;
  /** Number of mainline half-moves. */
  plyCount: number;
}

/** Parses one PGN game (headers, comments, NAGs and nested variations). */
export function parsePgnGame(text: string, gameIndex = 1): ParsedGame {
  const { headers, body } = parseHeaders(text.replace(/\r\n?/g, '\n'));
  let startFen = DEFAULT_POSITION;
  if (headers.FEN) {
    try {
      startFen = new Chess(headers.FEN).fen();
    } catch (e) {
      throw new PgnError(`FEN de la capçalera invàlida: ${(e as Error).message}`, { gameIndex });
    }
  }
  let tree = createTree(startFen, headers);
  const tokens = tokenize(body, gameIndex);
  // Stack of [parent node for next move, last added node]
  const stack: { parent: string; last: string | null }[] = [];
  let parent = ROOT_ID;
  let last: string | null = null;
  let result: string | undefined;
  let pendingComment: string | undefined;

  for (const tok of tokens) {
    switch (tok.t) {
      case 'move': {
        try {
          const res = addMove(tree, parent, normalizeSan(tok.v));
          tree = res.tree;
          if (pendingComment) {
            const n = tree.nodes[res.id];
            tree = { ...tree, nodes: { ...tree.nodes, [res.id]: { ...n, comment: [pendingComment, n.comment].filter(Boolean).join(' ') } } };
            pendingComment = undefined;
          }
          last = res.id;
          parent = res.id;
        } catch {
          throw new PgnError(`Jugada il·legal o no reconeguda: ${tok.num ?? ''}${tok.v}`, {
            gameIndex,
            token: tok.v,
            moveNumber: tok.num,
          });
        }
        break;
      }
      case 'comment': {
        if (last) {
          const n = tree.nodes[last];
          tree = { ...tree, nodes: { ...tree.nodes, [last]: { ...n, comment: n.comment ? `${n.comment} ${tok.v}` : tok.v } } };
        } else {
          pendingComment = pendingComment ? `${pendingComment} ${tok.v}` : tok.v;
        }
        break;
      }
      case 'nag': {
        if (last) {
          const n = tree.nodes[last];
          tree = { ...tree, nodes: { ...tree.nodes, [last]: { ...n, nags: [...(n.nags ?? []), tok.v] } } };
        }
        break;
      }
      case 'open': {
        if (!last) throw new PgnError('Variant sense jugada prèvia', { gameIndex });
        stack.push({ parent, last });
        // A variation replaces the last move: it branches from that move's parent.
        parent = tree.nodes[last].parentId!;
        last = null;
        break;
      }
      case 'close': {
        const frame = stack.pop();
        if (!frame) throw new PgnError('Parèntesi ")" sense obrir', { gameIndex });
        parent = frame.parent;
        last = frame.last;
        break;
      }
      case 'result':
        result = tok.v;
        break;
    }
  }
  if (stack.length) throw new PgnError('Variant sense tancar ("(" sense ")")', { gameIndex });
  const plyCount = mainlineFrom(tree).length;
  if (plyCount === 0 && !headers.FEN) throw new PgnError('La partida no conté cap jugada', { gameIndex });
  return { tree, headers, result: result ?? headers.Result, plyCount };
}

/** Parses all games from a PGN file. Invalid games are reported, valid ones returned. */
export function parsePgn(text: string): { games: ParsedGame[]; errors: PgnError[] } {
  const games: ParsedGame[] = [];
  const errors: PgnError[] = [];
  const texts = splitPgnGames(text);
  if (texts.length === 0) errors.push(new PgnError('El text PGN és buit'));
  texts.forEach((t, idx) => {
    try {
      games.push(parsePgnGame(t, idx + 1));
    } catch (e) {
      errors.push(e instanceof PgnError ? e : new PgnError((e as Error).message, { gameIndex: idx + 1 }));
    }
  });
  return { games, errors };
}

const NAG_SYMBOL: Record<number, string> = { 1: '!', 2: '?', 3: '!!', 4: '??', 5: '!?', 6: '?!' };

export function nagSymbol(nag: number): string {
  return NAG_SYMBOL[nag] ?? `$${nag}`;
}

/** Serializes a move tree (with variations and comments) back to PGN. */
export function treeToPgn(tree: MoveTree, result = '*'): string {
  const headerLines = Object.entries({ ...tree.headers, Result: tree.headers.Result ?? result })
    .map(([k, v]) => `[${k} "${v.replace(/(["\\])/g, '\\$1')}"]`);

  const moveText = (node: MoveNode, forceNumber: boolean): string => {
    const parent = tree.nodes[node.parentId!];
    const [, turn, , , , full] = parent.fen.split(' ');
    let s = '';
    if (turn === 'w') s += `${full}. `;
    else if (forceNumber) s += `${full}... `;
    s += node.san;
    for (const nag of node.nags ?? []) s += nag <= 6 ? NAG_SYMBOL[nag] : ` $${nag}`;
    if (node.comment) s += ` {${node.comment}}`;
    return s;
  };

  const writeLine = (startId: string, forceFirst: boolean): string => {
    const parts: string[] = [];
    let cur = tree.nodes[startId];
    let force = forceFirst;
    while (cur) {
      parts.push(moveText(cur, force));
      force = !!cur.comment;
      const parent = tree.nodes[cur.parentId!];
      // variations of the current move (siblings) are written right after it
      if (parent.children[0] === cur.id && parent.children.length > 1) {
        for (const v of parent.children.slice(1)) parts.push(`(${writeLine(v, true)})`);
        force = true;
      }
      if (!cur.children.length) break;
      cur = tree.nodes[cur.children[0]];
    }
    return parts.join(' ');
  };

  const root = tree.nodes[ROOT_ID];
  const body = root.children.length ? writeLine(root.children[0], true) : '';
  return `${headerLines.join('\n')}\n\n${[body, tree.headers.Result ?? result].filter(Boolean).join(' ')}\n`;
}
