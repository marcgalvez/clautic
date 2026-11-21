"use client";
import { useEffect, useMemo, useState } from "react";

export type PickedSlot = { start: string; time: string; date: string };
type Day = { date: string; slots: { start: string; time: string }[] };

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Calendari mensual + franges. Només mostra hores realment disponibles (les calcula el servidor). */
export function SlotPicker(props: {
  endpoint: string;
  params: Record<string, string>;
  locale: string;
  weekdaysShort: string[];
  t: { noSlots: string; loading: string; noDays: string };
  selected?: string | null;
  onSelect: (s: PickedSlot) => void;
}) {
  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [days, setDays] = useState<Day[] | null>(null);
  const [error, setError] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const key = JSON.stringify(props.params);

  useEffect(() => {
    let cancelled = false;
    setDays(null);
    setError(false);
    const last = new Date(month.y, month.m + 1, 0).getDate();
    const qs = new URLSearchParams({ ...props.params, from: iso(month.y, month.m, 1), to: iso(month.y, month.m, last) });
    fetch(`${props.endpoint}?${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j: { days: Day[] }) => {
        if (cancelled) return;
        setDays(j.days);
        const first = j.days.find((d) => d.slots.length);
        setDay((cur) => (cur && j.days.some((d) => d.date === cur && d.slots.length) ? cur : (first?.date ?? null)));
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month.y, month.m, key, props.endpoint]);

  const byDate = useMemo(() => new Map((days ?? []).map((d) => [d.date, d.slots])), [days]);
  const monthLabel = new Intl.DateTimeFormat(props.locale, { month: "long", year: "numeric" }).format(new Date(month.y, month.m, 1)).replace(/^./, (c) => c.toUpperCase());
  const firstWeekday = (new Date(month.y, month.m, 1).getDay() + 6) % 7; // dilluns = 0
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const isCurrentMonth = month.y === now.getFullYear() && month.m === now.getMonth();
  const slots = day ? (byDate.get(day) ?? []) : [];
  const groups = [
    { label: "☀️", items: slots.filter((s) => s.time < "14:00") },
    { label: "🌙", items: slots.filter((s) => s.time >= "14:00") },
  ].filter((g) => g.items.length);
  const anyAvailable = (days ?? []).some((d) => d.slots.length);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" className="btn-ghost px-3" aria-label="←" disabled={isCurrentMonth} onClick={() => setMonth(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))}>
          ←
        </button>
        <div className="font-semibold" aria-live="polite">
          {monthLabel}
        </div>
        <button type="button" className="btn-ghost px-3" aria-label="→" onClick={() => setMonth(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))}>
          →
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-stone-500" aria-hidden>
        {props.weekdaysShort.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1" role="grid">
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <div key={"e" + i} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = iso(month.y, month.m, i + 1);
          const available = (byDate.get(d)?.length ?? 0) > 0;
          const sel = d === day;
          return (
            <button
              key={d}
              type="button"
              disabled={!available}
              aria-pressed={sel}
              aria-label={new Intl.DateTimeFormat(props.locale, { weekday: "long", day: "numeric", month: "long" }).format(new Date(month.y, month.m, i + 1))}
              onClick={() => setDay(d)}
              className={`aspect-square rounded-lg text-sm font-medium transition ${sel ? "bg-accent text-white" : available ? "bg-accent/10 text-stone-900 hover:bg-accent/20" : "text-stone-300"}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="mt-5 min-h-24" aria-live="polite">
        {error ? (
          <p className="text-sm text-red-700">⚠</p>
        ) : days === null ? (
          <p className="text-sm text-stone-500">{props.t.loading}</p>
        ) : !anyAvailable ? (
          <p className="text-sm text-stone-500">{props.t.noDays}</p>
        ) : !slots.length ? (
          <p className="text-sm text-stone-500">{props.t.noSlots}</p>
        ) : (
          groups.map((g) => (
            <div key={g.label} className="mb-3">
              <div className="mb-2 text-xs text-stone-500" aria-hidden>
                {g.label}
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {g.items.map((s) => (
                  <button
                    key={s.start}
                    type="button"
                    aria-pressed={props.selected === s.start}
                    onClick={() => props.onSelect({ ...s, date: day! })}
                    className={`rounded-lg border py-2.5 text-sm font-semibold tabular-nums ${props.selected === s.start ? "border-accent bg-accent text-white" : "border-stone-300 bg-white hover:border-accent"}`}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
