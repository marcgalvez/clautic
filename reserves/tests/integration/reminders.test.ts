import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { cancelAppointment, createAppointment, rescheduleAppointment } from "@/lib/booking/service";
import { __setWhatsAppProvider, type TemplateMessage, type WhatsAppProvider, WhatsAppSendError } from "@/lib/whatsapp/provider";
import { applyWhatsAppStatus, processDueReminders } from "@/lib/whatsapp/reminders";
import { customer, makeOrg, resetDb } from "./helpers";

const NOW = new Date("2026-11-20T08:00:00Z");
const SLOT = new Date("2026-11-24T15:30:00Z"); // dimarts 16:30 a Madrid
const SEND_AT = new Date("2026-11-23T15:31:00Z");

class FakeWA implements WhatsAppProvider {
  name = "fake";
  real = true;
  sent: TemplateMessage[] = [];
  fail: WhatsAppSendError | null = null;
  async sendTemplate(m: TemplateMessage) {
    if (this.fail) throw this.fail;
    this.sent.push(m);
    return { providerMessageId: "wamid." + this.sent.length };
  }
}

async function setup(consent = true) {
  const { org, service, pros } = await makeOrg("maria");
  const r = await createAppointment({
    orgId: org.id,
    serviceId: service.id,
    professionalId: pros[0].id,
    startsAt: SLOT,
    customer: customer(),
    whatsappConsent: consent,
    consentText: "ok",
    source: "PUBLIC",
    actor: { type: "CUSTOMER" },
    now: NOW,
  });
  if (!r.ok) throw new Error(r.error);
  return { org, id: r.value.id, token: r.value.manageToken };
}

let wa: FakeWA;
beforeEach(async () => {
  await resetDb();
  wa = new FakeWA();
  __setWhatsAppProvider(wa);
});
afterEach(() => __setWhatsAppProvider(undefined));
afterAll(() => db.$disconnect());

describe("recordatoris de WhatsApp", () => {
  it("s'envia 24 h abans amb les variables de la plantilla", async () => {
    const { token } = await setup();
    expect((await processDueReminders(new Date("2026-11-23T15:00:00Z"))).claimed).toBe(0); // encara no toca
    await processDueReminders(SEND_AT);
    expect(wa.sent).toHaveLength(1);
    expect(wa.sent[0]).toMatchObject({ to: "+34600111222", language: "ca", buttonUrlSuffix: token });
    expect(wa.sent[0].bodyParams).toEqual(["Laura", "Centre maria", "Dimarts 24 de novembre", "16:30", "Tall de cabell"]);
    const job = await db.reminderJob.findFirstOrThrow();
    expect(job.status).toBe("SENT");
    expect((await db.whatsAppMessage.findFirstOrThrow()).providerMessageId).toBe("wamid.1");
  });

  it("no es duplica encara que el procés s'executi diverses vegades o en paral·lel", async () => {
    await setup();
    await Promise.all([processDueReminders(SEND_AT), processDueReminders(SEND_AT), processDueReminders(SEND_AT)]);
    await processDueReminders(new Date(SEND_AT.getTime() + 3600_000));
    expect(wa.sent).toHaveLength(1);
  });

  it("es cancel·la si la cita es cancel·la", async () => {
    const { org, id } = await setup();
    await cancelAppointment({ orgId: org.id, appointmentId: id, actor: { type: "CUSTOMER" } });
    await processDueReminders(SEND_AT);
    expect(wa.sent).toHaveLength(0);
    expect((await db.reminderJob.findFirstOrThrow()).status).toBe("CANCELLED");
  });

  it("es reprograma si la cita canvia d'hora (i no s'envia el vell)", async () => {
    const { org, id } = await setup();
    await rescheduleAppointment({ orgId: org.id, appointmentId: id, startsAt: new Date("2026-11-25T15:30:00Z"), actor: { type: "CUSTOMER" }, now: NOW });
    await processDueReminders(SEND_AT);
    expect(wa.sent).toHaveLength(0);
    await processDueReminders(new Date("2026-11-24T15:31:00Z"));
    expect(wa.sent).toHaveLength(1);
    expect(wa.sent[0].bodyParams[2]).toBe("Dimecres 25 de novembre");
  });

  it("sense consentiment no s'envia", async () => {
    await setup(false);
    await processDueReminders(SEND_AT);
    expect(wa.sent).toHaveLength(0);
    expect((await db.reminderJob.findFirstOrThrow()).skipReason).toBe("NO_CONSENT");
  });

  it("fallada temporal de l'API: es reintenta amb límit i queda registrada", async () => {
    await setup();
    wa.fail = new WhatsAppSendError("Service unavailable", true, "503");
    await processDueReminders(SEND_AT);
    let job = await db.reminderJob.findFirstOrThrow();
    expect(job.status).toBe("PENDING");
    expect(job.attempts).toBe(1);
    expect(await db.integrationErrorLog.count({ where: { integration: "WHATSAPP" } })).toBe(1);
    wa.fail = null;
    await processDueReminders(new Date(job.scheduledFor.getTime() + 1000));
    job = await db.reminderJob.findFirstOrThrow();
    expect(job.status).toBe("SENT");
    expect(wa.sent).toHaveLength(1);
  });

  it("fallada definitiva (número invàlid): FAILED sense reintents", async () => {
    await setup();
    wa.fail = new WhatsAppSendError("Recipient not on WhatsApp", false, "131026");
    await processDueReminders(SEND_AT);
    expect((await db.reminderJob.findFirstOrThrow()).status).toBe("FAILED");
  });

  it("WhatsApp no configurat: no es simula l'enviament", async () => {
    __setWhatsAppProvider(null);
    await setup();
    await processDueReminders(SEND_AT);
    const job = await db.reminderJob.findFirstOrThrow();
    expect(job.status).toBe("FAILED");
    expect(job.lastError).toMatch(/no configurat/);
  });

  it("els estats del webhook avancen (lliurat → llegit) i no retrocedeixen", async () => {
    await setup();
    await processDueReminders(SEND_AT);
    await applyWhatsAppStatus({ id: "wamid.1", status: "read", timestamp: "1795000000" });
    await applyWhatsAppStatus({ id: "wamid.1", status: "delivered", timestamp: "1794999990" });
    expect((await db.whatsAppMessage.findFirstOrThrow()).status).toBe("READ");
    expect((await db.reminderJob.findFirstOrThrow()).status).toBe("READ");
  });
});
