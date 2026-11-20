import { useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS = [
  { id: 'threats', label: 'Què amenaça el rival?' },
  { id: 'checks', label: 'Quins escacs puc donar?' },
  { id: 'captures', label: 'Quines captures tinc?' },
  { id: 'loose', label: 'Quines peces estan indefenses?' },
];

/** Self-check routine before moving (not scored: it builds the habit). */
export function ThinkingChecklist() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Abans de moure, pregunta't</p>
      <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
        {ITEMS.map((it) => (
          <li key={it.id}>
            <button
              type="button"
              aria-pressed={!!done[it.id]}
              onClick={() => setDone((d) => ({ ...d, [it.id]: !d[it.id] }))}
              className={cn(
                'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-muted',
                done[it.id] && 'text-muted-foreground line-through',
              )}
            >
              <span className={cn('flex size-4 items-center justify-center rounded border border-input', done[it.id] && 'border-primary bg-primary text-primary-foreground')}>
                {done[it.id] && <Check className="size-3" />}
              </span>
              {it.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
