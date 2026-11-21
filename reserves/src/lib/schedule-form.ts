import { hhmmToMinutes } from "./format";

/** Llegeix franges setmanals d'un formulari: camps `${p}_${weekday}_${n}_s|e` (n = 1..2). */
export function parseWeekly(f: FormData, prefix: string): { weekday: number; startMinute: number; endMinute: number }[] | string {
  const out = [];
  for (let weekday = 1; weekday <= 7; weekday++) {
    for (const n of [1, 2]) {
      const s = String(f.get(`${prefix}_${weekday}_${n}_s`) ?? "").trim();
      const e = String(f.get(`${prefix}_${weekday}_${n}_e`) ?? "").trim();
      if (!s && !e) continue;
      const sm = hhmmToMinutes(s);
      const em = hhmmToMinutes(e);
      if (sm === null || em === null || em <= sm) return `weekday ${weekday}`;
      out.push({ weekday, startMinute: sm, endMinute: em });
    }
  }
  return out;
}
