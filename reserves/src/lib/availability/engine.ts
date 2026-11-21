import { DateTime } from "luxon";
import { type Interval, intersectIntervals, mergeIntervals, overlaps } from "./intervals";

/**
 * Motor de disponibilitat PUR (sense BD ni xarxa) perquè sigui fàcil de provar.
 * Totes les hores d'horari són de rellotge local del centre; tots els instants són UTC.
 */
export type WeeklyRange = { weekday: number; startMinute: number; endMinute: number };

export type EngineProfessional = {
  id: string;
  schedules: WeeklyRange[]; // buit = segueix l'horari del centre
  busy: Interval[]; // cites (amb marges), vacances, bloquejos, ocupació de Google
};

export type EngineInput = {
  timezone: string;
  fromDate: string; // YYYY-MM-DD (local)
  toDate: string; // YYYY-MM-DD (local, inclòs)
  now: Date;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  stepMinutes: number;
  service: { durationMinutes: number; bufferBeforeMinutes: number; bufferAfterMinutes: number };
  businessHours: WeeklyRange[];
  centerBusy: Interval[]; // festius / tancaments de tot el centre
  professionals: EngineProfessional[];
  /** Si s'informa, només s'avalua aquest inici (validació d'una reserva concreta). */
  candidateStart?: number;
};

export type Slot = { start: string; end: string; professionalIds: string[] };
export type DayAvailability = { date: string; slots: Slot[] };

const MIN = 60_000;

/** Converteix una franja setmanal a instants reals per a un dia local concret (respecta DST). */
export function rangesForDay(day: DateTime, ranges: WeeklyRange[]): Interval[] {
  return ranges
    .filter((r) => r.weekday === day.weekday && r.endMinute > r.startMinute)
    .map((r) => ({
      start: localMinuteToInstant(day, r.startMinute),
      end: localMinuteToInstant(day, r.endMinute),
    }))
    .filter((i) => i.end > i.start);
}

function localMinuteToInstant(day: DateTime, minute: number): number {
  if (minute >= 1440) return day.plus({ days: 1 }).startOf("day").toMillis();
  return day.set({ hour: Math.floor(minute / 60), minute: minute % 60, second: 0, millisecond: 0 }).toMillis();
}

export function computeAvailability(input: EngineInput): DayAvailability[] {
  const { timezone, service } = input;
  const step = Math.max(5, input.stepMinutes) * MIN;
  const duration = service.durationMinutes * MIN;
  const earliest = input.now.getTime() + input.minNoticeMinutes * MIN;
  const latest = input.now.getTime() + input.maxAdvanceDays * 86400_000;
  const centerBusy = mergeIntervals(input.centerBusy);

  let day = DateTime.fromISO(input.fromDate, { zone: timezone }).startOf("day");
  const last = DateTime.fromISO(input.toDate, { zone: timezone }).startOf("day");
  const out: DayAvailability[] = [];

  while (day <= last) {
    const open = rangesForDay(day, input.businessHours);
    const byStart = new Map<number, string[]>();

    for (const pro of input.professionals) {
      const proHours = pro.schedules.length ? rangesForDay(day, pro.schedules) : open;
      // El professional treballa només dins l'horari del centre.
      const windows = intersectIntervals(proHours, open);
      const busy = mergeIntervals([...pro.busy, ...centerBusy]);

      for (const w of windows) {
        // Candidats: la graella regular + just després de cada ocupació (evita forats).
        const candidates = new Set<number>();
        if (input.candidateStart !== undefined) {
          const c = input.candidateStart;
          if (c >= w.start && c + duration <= w.end) candidates.add(c);
        } else for (let t = w.start; t + duration <= w.end; t += step) candidates.add(t);
        if (input.candidateStart === undefined)
          for (const b of busy) {
            const t = b.end + service.bufferBeforeMinutes * MIN;
            if (t > w.start && t + duration <= w.end) candidates.add(t);
          }
        for (const t of candidates) {
          if (t < earliest || t > latest) continue;
          const block: Interval = {
            start: t - service.bufferBeforeMinutes * MIN,
            end: t + duration + service.bufferAfterMinutes * MIN,
          };
          if (busy.some((b) => overlaps(b, block))) continue;
          const list = byStart.get(t) ?? [];
          list.push(pro.id);
          byStart.set(t, list);
        }
      }
    }

    const slots = [...byStart.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([t, ids]) => ({
        start: new Date(t).toISOString(),
        end: new Date(t + duration).toISOString(),
        professionalIds: ids,
      }));
    out.push({ date: day.toISODate()!, slots });
    day = day.plus({ days: 1 });
  }
  return out;
}

/** Interval bloquejat per una cita (amb marges). */
export function blockFor(start: Date, service: EngineInput["service"]) {
  return {
    startsAt: start,
    endsAt: new Date(start.getTime() + service.durationMinutes * MIN),
    blockStart: new Date(start.getTime() - service.bufferBeforeMinutes * MIN),
    blockEnd: new Date(start.getTime() + (service.durationMinutes + service.bufferAfterMinutes) * MIN),
  };
}
