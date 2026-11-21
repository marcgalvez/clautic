import { DateTime } from "luxon";

export const dt = (d: Date, tz: string, locale: string) => DateTime.fromJSDate(d).setZone(tz).setLocale(locale);
export const fmtDateTime = (d: Date, tz: string, locale: string) => dt(d, tz, locale).toFormat("ccc d LLL · HH:mm");
export const fmtDate = (d: Date, tz: string, locale: string) => dt(d, tz, locale).toFormat("cccc d 'de' LLLL yyyy");
export const fmtTime = (d: Date, tz: string) => DateTime.fromJSDate(d).setZone(tz).toFormat("HH:mm");
export const fmtPrice = (cents: number | null | undefined, locale: string) =>
  cents == null ? "" : new Intl.NumberFormat(locale === "es" ? "es-ES" : "ca-ES", { style: "currency", currency: "EUR" }).format(cents / 100);
export const minutesToHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const hhmmToMinutes = (s: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v >= 0 && v <= 1440 ? v : null;
};
/** Data local + hora local del centre → instant UTC. */
export const localToUtc = (date: string, time: string, tz: string) => DateTime.fromISO(`${date}T${time}`, { zone: tz }).toUTC().toJSDate();
/** Majúscula només a la primera lletra ("dissabte 21 de novembre" → "Dissabte 21 de novembre"). */
export const ucfirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
