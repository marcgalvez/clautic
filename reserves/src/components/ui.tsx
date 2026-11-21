import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = "", actions }: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold text-stone-900">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

export function Checkbox({ name, label, defaultChecked, value, required }: { name: string; label: ReactNode; defaultChecked?: boolean; value?: string; required?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm text-stone-700">
      <input type="checkbox" name={name} value={value ?? "on"} defaultChecked={defaultChecked} required={required} className="mt-0.5 h-5 w-5 shrink-0 rounded border-stone-300 accent-[var(--accent)]" />
      <span>{label}</span>
    </label>
  );
}

const TONES = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  red: "bg-red-50 text-red-800 ring-red-200",
  amber: "bg-amber-50 text-amber-900 ring-amber-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  gray: "bg-stone-100 text-stone-700 ring-stone-200",
};
export type Tone = keyof typeof TONES;

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>{children}</span>;
}

export function Alert({ tone = "amber", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div role="status" className={`mb-4 rounded-xl px-4 py-3 text-sm ring-1 ring-inset ${TONES[tone]}`}>
      {children}
    </div>
  );
}

export function Stat({ label, value, href, tone }: { label: string; value: ReactNode; href?: string; tone?: Tone }) {
  const inner = (
    <div className="card h-full">
      <div className="text-sm text-stone-600">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${tone === "red" ? "text-red-700" : "text-stone-900"}`}>{value}</div>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-2xl hover:ring-2 hover:ring-accent/30">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">{children}</p>;
}

export const statusTone: Record<string, Tone> = {
  CONFIRMED: "green",
  PENDING: "amber",
  CANCELLED: "red",
  COMPLETED: "blue",
  NO_SHOW: "gray",
  SYNCED: "green",
  FAILED: "red",
  NOT_APPLICABLE: "gray",
  SENT: "blue",
  DELIVERED: "green",
  READ: "green",
  PROCESSING: "amber",
  SKIPPED: "gray",
  ACTIVE: "green",
  PENDING_APPROVAL: "amber",
  SUSPENDED: "red",
  EXPIRED: "red",
};
