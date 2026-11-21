import { describe, expect, it } from "vitest";
import { computeAvailability, type EngineInput } from "@/lib/availability/engine";

const TZ = "Europe/Madrid";
const weekdays = (start: number, end: number) => [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, startMinute: start, endMinute: end }));
const iso = (s: string) => new Date(s).getTime();

function base(over: Partial<EngineInput> = {}): EngineInput {
  return {
    timezone: TZ,
    fromDate: "2026-11-24",
    toDate: "2026-11-24",
    now: new Date("2026-11-20T08:00:00Z"),
    minNoticeMinutes: 0,
    maxAdvanceDays: 60,
    stepMinutes: 30,
    service: { durationMinutes: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 },
    businessHours: weekdays(9 * 60, 12 * 60), // 09:00–12:00 locals = 08:00–11:00Z al novembre
    centerBusy: [],
    professionals: [{ id: "a", schedules: [], busy: [] }],
    ...over,
  };
}
const starts = (i: EngineInput) => computeAvailability(i)[0].slots.map((s) => s.start.slice(11, 16));

describe("motor de disponibilitat", () => {
  it("genera franges dins l'horari en hora local", () => {
    expect(starts(base())).toEqual(["08:00", "08:30", "09:00", "09:30", "10:00", "10:30"]);
  });

  it("no ofereix una franja ocupada", () => {
    const i = base({ professionals: [{ id: "a", schedules: [], busy: [{ start: iso("2026-11-24T09:00:00Z"), end: iso("2026-11-24T09:30:00Z") }] }] });
    expect(starts(i)).not.toContain("09:00");
    expect(starts(i)).toContain("09:30");
  });

  it("serveis de durades diferents: el de 90 min no hi cap al final", () => {
    const i = base({ service: { durationMinutes: 90, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 } });
    expect(starts(i)).toEqual(["08:00", "08:30", "09:00", "09:30"]);
  });

  it("respecta els marges abans/després", () => {
    const busy = [{ start: iso("2026-11-24T09:00:00Z"), end: iso("2026-11-24T09:30:00Z") }];
    const i = base({ service: { durationMinutes: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 15 }, professionals: [{ id: "a", schedules: [], busy }] });
    expect(starts(i)).not.toContain("08:30"); // 08:30-09:00 + 15' de marge xoca
    expect(starts(i)).toContain("09:30");
  });

  it("diversos professionals: la franja mostra qui està lliure", () => {
    const busy = [{ start: iso("2026-11-24T08:00:00Z"), end: iso("2026-11-24T08:30:00Z") }];
    const i = base({ professionals: [{ id: "a", schedules: [], busy }, { id: "b", schedules: [], busy: [] }] });
    const s = computeAvailability(i)[0].slots;
    expect(s[0].professionalIds).toEqual(["b"]);
    expect(s[1].professionalIds.sort()).toEqual(["a", "b"]);
  });

  it("horari propi del professional limitat a l'horari del centre", () => {
    const i = base({ professionals: [{ id: "a", schedules: [{ weekday: 2, startMinute: 10 * 60, endMinute: 14 * 60 }], busy: [] }] });
    expect(starts(i)).toEqual(["09:00", "09:30", "10:00", "10:30"]);
  });

  it("bloqueig de Google Calendar o festiu del centre", () => {
    const i = base({ centerBusy: [{ start: iso("2026-11-24T00:00:00Z"), end: iso("2026-11-25T00:00:00Z") }] });
    expect(starts(i)).toEqual([]);
  });

  it("antelació mínima i màxima", () => {
    expect(starts(base({ now: new Date("2026-11-24T07:00:00Z"), minNoticeMinutes: 120 }))).toEqual(["09:00", "09:30", "10:00", "10:30"]);
    expect(starts(base({ maxAdvanceDays: 2 }))).toEqual([]);
  });

  it("canvi d'horari d'estiu: les 9:00 locals són 08:00Z abans i 07:00Z després", () => {
    const i = base({ fromDate: "2026-03-27", toDate: "2026-03-30", now: new Date("2026-03-01T00:00:00Z"), businessHours: weekdays(9 * 60, 10 * 60) });
    const days = computeAvailability(i);
    expect(days.find((d) => d.date === "2026-03-27")!.slots[0].start).toBe("2026-03-27T08:00:00.000Z");
    expect(days.find((d) => d.date === "2026-03-30")!.slots[0].start).toBe("2026-03-30T07:00:00.000Z");
  });

  it("el dia del canvi d'hora (29/03) un horari 01:00–05:00 només té 3 hores reals", () => {
    const i = base({ fromDate: "2026-03-29", toDate: "2026-03-29", now: new Date("2026-03-01T00:00:00Z"), stepMinutes: 60, service: { durationMinutes: 60, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 }, businessHours: weekdays(60, 300) });
    expect(computeAvailability(i)[0].slots.map((s) => s.start)).toEqual(["2026-03-29T00:00:00.000Z", "2026-03-29T01:00:00.000Z", "2026-03-29T02:00:00.000Z"]);
  });

  it("canvi d'horari d'hivern (25/10): les franges continuen en hora local", () => {
    const i = base({ fromDate: "2026-10-23", toDate: "2026-10-26", now: new Date("2026-10-01T00:00:00Z"), businessHours: weekdays(9 * 60, 10 * 60) });
    const d = computeAvailability(i);
    expect(d.find((x) => x.date === "2026-10-23")!.slots[0].start).toBe("2026-10-23T07:00:00.000Z");
    expect(d.find((x) => x.date === "2026-10-26")!.slots[0].start).toBe("2026-10-26T08:00:00.000Z");
  });

  it("ofereix l'hora just després d'una ocupació fora de graella", () => {
    const busy = [{ start: iso("2026-11-24T08:00:00Z"), end: iso("2026-11-24T08:45:00Z") }];
    expect(starts(base({ professionals: [{ id: "a", schedules: [], busy }] }))).toContain("08:45");
  });
});
