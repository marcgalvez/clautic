import { Fragment, useEffect, useRef } from 'react';
import { ROOT_ID, type MoveTree, type MoveNode } from '@/lib/chess/moveTree';
import { nagSymbol } from '@/lib/chess/pgn';
import { cn } from '@/lib/utils';

/** Renders the mainline with inline (nested) variations; click to navigate. */
export function MoveList({ tree, currentId, onSelect }: { tree: MoveTree; currentId: string; onSelect: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('[data-current="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [currentId]);

  const root = tree.nodes[ROOT_ID];
  if (!root.children.length) {
    return <p className="p-3 text-sm text-muted-foreground">Encara no hi ha jugades. Mou una peça al tauler o importa una partida.</p>;
  }

  const MoveButton = ({ node, showNumber }: { node: MoveNode; showNumber: boolean }) => {
    const parent = tree.nodes[node.parentId!];
    const [, turn, , , , full] = parent.fen.split(' ');
    const number = turn === 'w' ? `${full}.` : showNumber ? `${full}…` : '';
    const isCurrent = node.id === currentId;
    return (
      <>
        {number && <span className="ml-1 text-muted-foreground tabular-nums">{number}</span>}
        <button
          type="button"
          data-current={isCurrent}
          onClick={() => onSelect(node.id)}
          className={cn(
            'cursor-pointer rounded px-1 py-0.5 font-medium hover:bg-muted',
            isCurrent && 'bg-primary text-primary-foreground hover:bg-primary',
          )}
        >
          {node.san}
          {node.nags?.map((n) => nagSymbol(n)).join('')}
        </button>
        {node.comment && <span className="mx-1 text-xs italic text-muted-foreground">{node.comment}</span>}
      </>
    );
  };

  const Line = ({ startId, depth }: { startId: string; depth: number }) => {
    const items: React.ReactNode[] = [];
    let cur: MoveNode | undefined = tree.nodes[startId];
    let showNumber = true;
    while (cur) {
      const parent: MoveNode = tree.nodes[cur.parentId!];
      items.push(<MoveButton key={cur.id} node={cur} showNumber={showNumber} />);
      showNumber = !!cur.comment;
      if (parent.children[0] === cur.id && parent.children.length > 1) {
        items.push(
          <span key={`${cur.id}-vars`} className={cn('my-0.5 block border-l-2 border-border pl-2 text-[13px]', depth > 0 && 'ml-1')}>
            {parent.children.slice(1).map((v) => (
              <span key={v} className="block text-muted-foreground">
                ( <Line startId={v} depth={depth + 1} /> )
              </span>
            ))}
          </span>,
        );
        showNumber = true;
      }
      cur = cur.children.length ? tree.nodes[cur.children[0]] : undefined;
    }
    return <Fragment>{items}</Fragment>;
  };

  return (
    <div ref={ref} className="max-h-72 overflow-y-auto p-2 text-sm leading-7 lg:max-h-[420px]" aria-label="Llista de jugades">
      <Line startId={root.children[0]} depth={0} />
    </div>
  );
}
