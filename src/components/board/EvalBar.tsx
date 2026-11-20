import { formatScore, winPercent, type EngineScore } from '@/lib/engine/uci';
import { cn } from '@/lib/utils';

/** Vertical evaluation bar. `score` must be White-relative. */
export function EvalBar({ score, orientation = 'white', className }: { score: EngineScore | null; orientation?: 'white' | 'black'; className?: string }) {
  const whitePct = score ? winPercent(score) : 50;
  const label = score ? formatScore(score) : '–';
  const whiteBottom = orientation === 'white';
  return (
    <div
      className={cn('relative w-4 overflow-hidden rounded-md bg-neutral-800 sm:w-5', className)}
      role="meter"
      aria-label={`Avaluació ${label}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(whitePct)}
    >
      <div
        className={cn('absolute inset-x-0 bg-neutral-100 transition-all duration-500', whiteBottom ? 'bottom-0' : 'top-0')}
        style={{ height: `${whitePct}%` }}
      />
      <span
        className={cn(
          'absolute inset-x-0 text-center text-[9px] font-semibold',
          whitePct >= 50 === whiteBottom ? 'bottom-1 text-neutral-800' : 'top-1 text-neutral-100',
        )}
      >
        {label.replace('+', '')}
      </span>
    </div>
  );
}
