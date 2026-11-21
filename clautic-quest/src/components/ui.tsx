import { useEffect, type ReactNode } from 'react';

export function Spinner({ label = 'Carregant…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ice/60" role="status">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-cian/30 border-t-cian" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="glass mx-auto my-8 max-w-lg p-6 text-center">
      <div className="mb-2 text-3xl">⚠️</div>
      <p className="text-sm text-ice/80">{error}</p>
      {onRetry && <button className="btn-ghost mt-4" onClick={onRetry}>Torna-ho a provar</button>}
    </div>
  );
}

export function Empty({ icon = '🛰️', text }: { icon?: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-ice/50">
      <div className="text-4xl opacity-70">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  );
}

export function Card({ children, className = '', title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={`glass p-4 md:p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h3 className="font-display text-base font-semibold">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, icon }: { title: string; subtitle?: ReactNode; actions?: ReactNode; icon?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold md:text-3xl">{icon && <span>{icon}</span>}{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ice/60">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide, footer }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-night-950/70 p-0 backdrop-blur-sm md:items-center md:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className={`glass-strong flex max-h-[92vh] w-full animate-pop flex-col rounded-b-none md:rounded-2xl ${wide ? 'md:max-w-4xl' : 'md:max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button className="rounded-lg p-2 text-ice/60 hover:bg-white/10" onClick={onClose} aria-label="Tanca">✕</button>
        </div>
        <div className="scrollbar-thin overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Stat({ label, value, icon, color = '#22D3EE', hint }: { label: string; value: ReactNode; icon?: string; color?: string; hint?: string }) {
  return (
    <div className="glass relative overflow-hidden p-4">
      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-20 blur-2xl" style={{ background: color }} />
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ice/50">{icon && <span className="text-base">{icon}</span>}{label}</div>
      <div className="mt-1 font-display text-3xl font-bold" style={{ color }}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ice/50">{hint}</div>}
    </div>
  );
}

export function Progress({ pct, color = '#22D3EE', className = 'h-2' }: { pct: number; color?: string; className?: string }) {
  return (
    <div className={`w-full overflow-hidden rounded-full bg-white/10 ${className}`}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)`, boxShadow: `0 0 12px ${color}88` }} />
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ice/40">{hint}</span>}
    </label>
  );
}

export function Coin({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="inline-block shrink-0">
      <defs><linearGradient id="coin-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FDE68A" /><stop offset="1" stopColor="#F59E0B" /></linearGradient></defs>
      <circle cx="12" cy="12" r="10" fill="url(#coin-g)" stroke="#B45309" strokeWidth="1.2" />
      <path d="M12 6.5 16.5 9v6L12 17.5 7.5 15V9z" fill="none" stroke="#92400E" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="1.8" fill="#92400E" />
    </svg>
  );
}

export function XpIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="inline-block shrink-0">
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="#22D3EE" stroke="#0891B2" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-sm">
      <span className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-cian' : 'bg-white/15'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[] }) {
  return (
    <div className="scrollbar-thin flex gap-1 overflow-x-auto rounded-xl bg-white/5 p-1">
      {items.map((it) => (
        <button key={it.value} onClick={() => onChange(it.value)}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${value === it.value ? 'bg-cian text-night-900' : 'text-ice/70 hover:bg-white/10'}`}>
          {it.label}
        </button>
      ))}
    </div>
  );
}
