import { defaultPieces } from 'react-chessboard';

const OPTIONS: { p: 'q' | 'r' | 'b' | 'n'; label: string }[] = [
  { p: 'q', label: 'Dama' },
  { p: 'r', label: 'Torre' },
  { p: 'b', label: 'Alfil' },
  { p: 'n', label: 'Cavall' },
];

export function PromotionPicker({ color, onPick, onCancel }: { color: 'w' | 'b'; onPick: (p: 'q' | 'r' | 'b' | 'n') => void; onCancel: () => void }) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center rounded-[10px] bg-black/45 backdrop-blur-[1px] animate-fade-in"
      role="dialog"
      aria-label="Tria la peça de promoció"
      onClick={onCancel}
    >
      <div className="flex gap-2 rounded-xl bg-card p-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {OPTIONS.map(({ p, label }) => {
          const key = `${color}${p.toUpperCase()}`;
          const Piece = defaultPieces[key];
          return (
            <button
              key={p}
              type="button"
              aria-label={label}
              title={label}
              onClick={() => onPick(p)}
              className="h-16 w-16 cursor-pointer rounded-lg border border-border bg-muted p-1 transition hover:scale-105 hover:bg-secondary sm:h-20 sm:w-20"
            >
              {Piece ? <Piece /> : label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
