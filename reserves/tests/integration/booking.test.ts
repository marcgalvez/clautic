import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { cancelAppointment, createAppointment, rescheduleAppointment } from "@/lib/booking/service";
import { getAvailability } from "@/lib/availability/service";
import { __setGoogleApi } from "@/lib/google/api";
import { processCalendarSyncJobs } from "@/lib/google/sync";
import { connectGoogle, customer, FakeGoogle, makeOrg, resetDb } from "./helpers";

const NOW = new Date("2026-11-20T08:00:00Z");
const SLOT = new Date("2026-11-24T10:00:00Z"); // dimarts 11:00 a Madrid

const book = (orgId: string, serviceId: string, professionalId: string | null, startsAt = SLOT, phone?: string) =>
  createAppointment({
    orgId,
    serviceId,
    professionalId,
    startsAt,
    customer: customer(phone),
    whatsappConsent: true,
    consentText: "Accepto rebre recordatoris per WhatsApp",
    source: "PUBLIC",
    actor: { type: "CUSTOMER" },
    now: NOW,
  });

beforeEach(async () => {
  __setGoogleApi(null);
  await resetDb();
});
afterAll(() => db.$disconnect());

describe("reserves", () => {
  it("crea una reserva correcta amb recordatori 24 h abans", async () => {
    const { org, service, pros } = await makeOrg("maria");
    const r = await book(org.id, service.id, pros[0].id);
    expect(r.ok).toBe(true);
    const a = await db.appointment.findFirstOrThrow({ include: { reminderJobs: true, events: true } });
    expect(a.startsAt).toEqual(SLOT);
    expect(a.endsAt).toEqual(new Date("2026-11-24T10:30:00Z"));
    expect(a.googleSyncStatus).toBe("NOT_APPLICABLE");
    expect(a.reminderJobs[0]).toMatchObject({ status: "PENDING", scheduledFor: new Date("2026-11-23T10:00:00Z") });
    expect(a.events.map((e) => e.type)).toEqual(["CREATED"]);
    expect(await db.consentRecord.count({ where: { granted: true } })).toBe(1);
  });

  it("una franja ocupada ja no es pot reservar ni s'ofereix", async () => {
    const { org, service, pros } = await makeOrg("maria");
    expect((await book(org.id, service.id, pros[0].id)).ok).toBe(true);
    const again = await book(org.id, service.id, pros[0].id, SLOT, "+34600999888");
    expect(again).toEqual({ ok: false, error: "NOT_AVAILABLE" });
    const av = await getAvailability({ orgId: org.id, serviceId: service.id, fromDate: "2026-11-24", toDate: "2026-11-24", mode: "cached", now: NOW });
    expect(av!.days[0].slots.map((s) => s.start)).not.toContain(SLOT.toISOString());
  });

  it("dues persones reservant alhora la mateixa franja: només una guanya", async () => {
    const { org, service, pros } = await makeOrg("maria");
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => book(org.id, service.id, pros[0].id, SLOT, `+3460000000${i}`)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && ["SLOT_TAKEN", "NOT_AVAILABLE"].includes(r.error))).toBe(true);
    expect(await db.appointment.count()).toBe(1);
  });

  it("la restricció de la BD impedeix solapaments encara que se salti la validació", async () => {
    const { org, service, pros } = await makeOrg("maria");
    await book(org.id, service.id, pros[0].id);
    const a = await db.appointment.findFirstOrThrow();
    await expect(
      db.appointment.create({
        data: { ...a, id: undefined, manageTokenHash: "x", startsAt: new Date(SLOT.getTime() + 15 * 60_000), blockStart: new Date(SLOT.getTime() + 15 * 60_000), endsAt: new Date(SLOT.getTime() + 45 * 60_000), blockEnd: new Date(SLOT.getTime() + 45 * 60_000), createdAt: undefined, updatedAt: undefined } as never,
      }),
    ).rejects.toThrow(/Appointment_no_overlap|exclusion/);
  });

  it("'qualsevol professional' assigna un altre professional si el primer està ocupat", async () => {
    const { org, service, pros } = await makeOrg("maria", { pros: 2 });
    const r1 = await book(org.id, service.id, null);
    const r2 = await book(org.id, service.id, null, SLOT, "+34600222333");
    const r3 = await book(org.id, service.id, null, SLOT, "+34600222444");
    expect([r1.ok, r2.ok, r3.ok]).toEqual([true, true, false]);
    const ids = (await db.appointment.findMany()).map((a) => a.professionalId).sort();
    expect(ids).toEqual(pros.map((p) => p.id).sort());
  });

  it("un servei llarg bloqueja les franges que solapa", async () => {
    const { org, service, long, pros } = await makeOrg("maria");
    expect((await book(org.id, long.id, pros[0].id)).ok).toBe(true); // 10:00–11:30Z
    expect((await book(org.id, service.id, pros[0].id, new Date("2026-11-24T11:00:00Z"), "+34600222333")).ok).toBe(false);
    expect((await book(org.id, service.id, pros[0].id, new Date("2026-11-24T11:30:00Z"), "+34600222333")).ok).toBe(true);
  });

  it("modificació: reprograma la cita i el recordatori", async () => {
    const { org, service, pros } = await makeOrg("maria");
    const r = await book(org.id, service.id, pros[0].id);
    if (!r.ok) throw new Error();
    const NEW = new Date("2026-11-25T15:00:00Z");
    const m = await rescheduleAppointment({ orgId: org.id, appointmentId: r.value.id, startsAt: NEW, actor: { type: "CUSTOMER" }, now: NOW });
    expect(m.ok).toBe(true);
    const jobs = await db.reminderJob.findMany({ orderBy: { createdAt: "asc" } });
    expect(jobs.map((j) => j.status)).toEqual(["CANCELLED", "PENDING"]);
    expect(jobs[1].scheduledFor).toEqual(new Date("2026-11-24T15:00:00Z"));
    // la franja antiga queda lliure
    expect((await book(org.id, service.id, pros[0].id, SLOT, "+34600222333")).ok).toBe(true);
  });

  it("cancel·lació: allibera la franja i anul·la el recordatori", async () => {
    const { org, service, pros } = await makeOrg("maria");
    const r = await book(org.id, service.id, pros[0].id);
    if (!r.ok) throw new Error();
    await cancelAppointment({ orgId: org.id, appointmentId: r.value.id, actor: { type: "CUSTOMER" } });
    expect((await db.reminderJob.findFirstOrThrow()).status).toBe("CANCELLED");
    expect((await book(org.id, service.id, pros[0].id, SLOT, "+34600222333")).ok).toBe(true);
  });

  it("una empresa pendent d'aprovació no rep reserves públiques", async () => {
    const { org, service, pros } = await makeOrg("pendent", { status: "PENDING_APPROVAL" });
    expect(await book(org.id, service.id, pros[0].id)).toEqual({ ok: false, error: "ORG_INACTIVE" });
  });
});

describe("Google Calendar", () => {
  it("un esdeveniment ocupat a Google bloqueja la franja", async () => {
    const g = new FakeGoogle();
    __setGoogleApi(g);
    const { org, service, pros } = await makeOrg("maria");
    await connectGoogle(org.id, pros[0].id);
    g.busy = [{ start: "2026-11-24T10:00:00Z", end: "2026-11-24T11:00:00Z" }];
    const av = await getAvailability({ orgId: org.id, serviceId: service.id, fromDate: "2026-11-24", toDate: "2026-11-24", mode: "cached", now: NOW });
    const starts = av!.days[0].slots.map((s) => s.start);
    expect(starts).not.toContain("2026-11-24T10:00:00.000Z");
    expect(starts).toContain("2026-11-24T11:00:00.000Z");
    expect((await book(org.id, service.id, pros[0].id)).ok).toBe(false);
  });

  it("crea, actualitza i esborra l'esdeveniment amb un ID determinista", async () => {
    const g = new FakeGoogle();
    __setGoogleApi(g);
    const { org, service, pros } = await makeOrg("maria");
    await connectGoogle(org.id, pros[0].id);
    const r = await book(org.id, service.id, pros[0].id);
    if (!r.ok) throw new Error();
    let a = await db.appointment.findUniqueOrThrow({ where: { id: r.value.id } });
    expect(a.googleSyncStatus).toBe("SYNCED");
    const ev = g.events.get(a.googleEventId!)!;
    expect(ev.summary).toBe("Tall de cabell · Laura P."); // sense telèfon ni cognom complet
    expect(ev.extendedProperties?.private?.rsvAppointmentId).toBe(a.id);

    await rescheduleAppointment({ orgId: org.id, appointmentId: a.id, startsAt: new Date("2026-11-24T12:00:00Z"), actor: { type: "SYSTEM" }, now: NOW });
    expect(g.events.get(a.googleEventId!)!.start.dateTime).toBe("2026-11-24T13:00:00.000+01:00");

    await cancelAppointment({ orgId: org.id, appointmentId: a.id, actor: { type: "SYSTEM" } });
    expect(g.events.size).toBe(0);
    a = await db.appointment.findUniqueOrThrow({ where: { id: r.value.id } });
    expect(a.status).toBe("CANCELLED");
  });

  it("error de sincronització: la cita queda FAILED, es registra i es reintenta", async () => {
    const g = new FakeGoogle();
    __setGoogleApi(g);
    const { org, service, pros } = await makeOrg("maria");
    await connectGoogle(org.id, pros[0].id);
    g.busy = [];
    // FreeBusy funciona; la primera escriptura falla (update→503)
    const origUpdate = g.updateEvent.bind(g);
    let fail = true;
    g.updateEvent = async (...args) => {
      if (fail) {
        fail = false;
        throw new (await import("@/lib/google/api")).GoogleApiError("Backend Error", 503);
      }
      return origUpdate(...args);
    };
    const r = await book(org.id, service.id, pros[0].id);
    expect(r.ok).toBe(true); // la reserva existeix a la BD (font de veritat)...
    let a = await db.appointment.findFirstOrThrow();
    expect(a.googleSyncStatus).toBe("FAILED"); // ...però no es dona per sincronitzada
    expect(await db.integrationErrorLog.count({ where: { integration: "GOOGLE" } })).toBe(1);
    const job = await db.calendarSyncJob.findFirstOrThrow();
    expect(job.status).toBe("PENDING");
    await db.calendarSyncJob.update({ where: { id: job.id }, data: { runAt: new Date() } });
    await processCalendarSyncJobs();
    a = await db.appointment.findFirstOrThrow();
    expect(a.googleSyncStatus).toBe("SYNCED");
  });

  it("si Google no respon i no hi ha dades recents, no s'ofereix el professional", async () => {
    const g = new FakeGoogle();
    __setGoogleApi(g);
    const { org, service, pros } = await makeOrg("maria");
    await connectGoogle(org.id, pros[0].id);
    g.failNext = 1;
    const av = await getAvailability({ orgId: org.id, serviceId: service.id, fromDate: "2026-11-24", toDate: "2026-11-24", mode: "cached", now: NOW });
    expect(av!.days[0].slots).toEqual([]);
  });
});
