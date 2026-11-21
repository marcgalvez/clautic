import { minutesToHHMM } from "@/lib/format";

/** Editor d'horari setmanal sense JavaScript: dues franges opcionals per dia. */
export function WeeklyFields({ prefix, ranges, weekdays, offLabel }: { prefix: string; ranges: { weekday: number; startMinute: number; endMinute: number }[]; weekdays: string[]; offLabel: string }) {
  return (
    <div className="divide-y divide-stone-100">
      {weekdays.map((label, i) => {
        const wd = i + 1;
        const r = ranges.filter((x) => x.weekday === wd).sort((a, b) => a.startMinute - b.startMinute);
        return (
          <fieldset key={wd} className="grid grid-cols-1 items-center gap-2 py-3 sm:grid-cols-[8rem_1fr_1fr]">
            <legend className="sr-only">{label}</legend>
            <div className="text-sm font-medium" aria-hidden>
              {label}
              {!r.length && <span className="ml-2 text-xs font-normal text-stone-400">{offLabel}</span>}
            </div>
            {[1, 2].map((n) => (
              <div key={n} className="flex items-center gap-2">
                <input type="time" step={300} aria-label={`${label} ${n} inici`} name={`${prefix}_${wd}_${n}_s`} defaultValue={r[n - 1] ? minutesToHHMM(r[n - 1].startMinute) : ""} className="input" />
                <span className="text-stone-400" aria-hidden>–</span>
                <input type="time" step={300} aria-label={`${label} ${n} fi`} name={`${prefix}_${wd}_${n}_e`} defaultValue={r[n - 1] ? minutesToHHMM(r[n - 1].endMinute) : ""} className="input" />
              </div>
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}
