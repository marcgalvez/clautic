import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Toast = { id: number; text: string; kind: 'ok' | 'error' | 'info'; action?: { label: string; run: () => void } };
const Ctx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-2), { ...t, id }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), t.action ? 6000 : 3500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {items.map((t) => (
          <div key={t.id} role="status"
            className={`pointer-events-auto flex max-w-md animate-pop items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-2xl backdrop-blur ${
              t.kind === 'error' ? 'bg-brand/95 text-white' : t.kind === 'ok' ? 'bg-night-700/95 text-white ring-1 ring-cian/50' : 'bg-night-700/95 text-white ring-1 ring-violet/50'}`}>
            <span>{t.text}</span>
            {t.action && (
              <button className="rounded-lg bg-white/15 px-3 py-1 font-semibold hover:bg-white/25"
                onClick={() => { t.action!.run(); setItems((x) => x.filter((i) => i.id !== t.id)); }}>{t.action.label}</button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
