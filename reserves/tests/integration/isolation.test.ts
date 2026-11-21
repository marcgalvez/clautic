import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { cancelAppointment, createAppointment, rescheduleAppointment } from "@/lib/booking/service";
import { getAvailability } from "@/lib/availability/service";
import { customer, makeOrg, resetDb } from "./helpers";

const NOW = new Date("2026-11-20T08:00:00Z");
beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("aïllament entre empreses", () => {
  it("una empresa no pot llegir, reservar, moure ni cancel·lar dades d'una altra", async () => {
    const a = await makeOrg("empresa-a");
    const b = await makeOrg("empresa-b");
    const r = await createAppointment({ orgId: a.org.id, serviceId: a.service.id, professionalId: a.pros[0].id, startsAt: new Date("2026-11-24T10:00:00Z"), customer: customer(), whatsappConsent: false, consentText: "", source: "PUBLIC", actor: { type: "CUSTOMER" }, now: NOW });
    if (!r.ok) throw new Error();

    // servei d'A amb el context de B
    expect(await getAvailability({ orgId: b.org.id, serviceId: a.service.id, fromDate: "2026-11-24", toDate: "2026-11-24", mode: "cached", now: NOW })).toBeNull();
    // professional d'A amb servei de B
    const x = await createAppointment({ orgId: b.org.id, serviceId: b.service.id, professionalId: a.pros[0].id, startsAt: new Date("2026-11-24T11:00:00Z"), customer: customer(), whatsappConsent: false, consentText: "", source: "PUBLIC", actor: { type: "CUSTOMER" }, now: NOW });
    expect(x.ok).toBe(false);
    expect(await cancelAppointment({ orgId: b.org.id, appointmentId: r.value.id, actor: { type: "SYSTEM" } })).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(await rescheduleAppointment({ orgId: b.org.id, appointmentId: r.value.id, startsAt: new Date("2026-11-24T12:00:00Z"), actor: { type: "SYSTEM" }, now: NOW })).toEqual({ ok: false, error: "NOT_FOUND" });
    expect((await db.appointment.findUniqueOrThrow({ where: { id: r.value.id } })).status).toBe("CONFIRMED");

    // el mateix telèfon és un client diferent a cada empresa
    await createAppointment({ orgId: b.org.id, serviceId: b.service.id, professionalId: b.pros[0].id, startsAt: new Date("2026-11-24T10:00:00Z"), customer: customer(), whatsappConsent: false, consentText: "", source: "PUBLIC", actor: { type: "CUSTOMER" }, now: NOW });
    expect(await db.customer.count()).toBe(2);
  });
});
