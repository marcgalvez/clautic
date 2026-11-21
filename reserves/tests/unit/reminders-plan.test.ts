import { describe, expect, it } from "vitest";
import { planReminder } from "@/lib/whatsapp/reminders";

const s = { remindersEnabled: true, reminderHoursBefore: 24, shortNoticePolicy: "SKIP" as const };
const now = new Date("2026-11-20T10:00:00Z");

describe("planificació del recordatori", () => {
  it("24 h abans de la cita", () => {
    const p = planReminder(new Date("2026-11-24T15:30:00Z"), s, true, now);
    expect(p).toEqual({ status: "PENDING", scheduledFor: new Date("2026-11-23T15:30:00Z") });
  });
  it("sense consentiment no s'envia", () => {
    expect(planReminder(new Date("2026-11-24T15:30:00Z"), s, false, now).skipReason).toBe("NO_CONSENT");
  });
  it("reserva amb menys de 24 h: per defecte no s'envia", () => {
    expect(planReminder(new Date("2026-11-20T20:00:00Z"), s, true, now).skipReason).toBe("SHORT_NOTICE");
  });
  it("política configurable: enviar de seguida", () => {
    const p = planReminder(new Date("2026-11-20T20:00:00Z"), { ...s, shortNoticePolicy: "SEND_IMMEDIATELY" }, true, now);
    expect(p).toEqual({ status: "PENDING", scheduledFor: now });
  });
});
