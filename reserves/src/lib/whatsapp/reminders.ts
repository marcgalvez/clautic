import type { Appointment, Customer, OrganizationSettings, Prisma, ReminderJob, ReminderStatus } from "@prisma/client";
import { db } from "../db";
import { decrypt } from "../crypto";
import { env } from "../env";
import { logIntegrationError } from "../audit";
import { accessState } from "../auth/access";
import { getWhatsAppProvider, WhatsAppSendError } from "./provider";
import { reminderParams } from "./template";

const H = 3600_000;
const RETRY_MIN = [2, 10, 30];
const STUCK_MS = 10 * 60_000;

export type ReminderPlan = { status: "PENDING" | "SKIPPED"; scheduledFor: Date; skipReason?: string };

/** Decideix quan (i si) cal enviar el recordatori. Pura → fàcil de provar. */
export function planReminder(
  startsAt: Date,
  s: Pick<OrganizationSettings, "remindersEnabled" | "reminderHoursBefore" | "shortNoticePolicy">,
  consent: boolean,
  now = new Date(),
): ReminderPlan {
  const ideal = new Date(startsAt.getTime() - s.reminderHoursBefore * H);
  if (!s.remindersEnabled) return { status: "SKIPPED", scheduledFor: ideal, skipReason: "DISABLED" };
  if (!consent) return { status: "SKIPPED", scheduledFor: ideal, skipReason: "NO_CONSENT" };
  if (ideal.getTime() > now.getTime()) return { status: "PENDING", scheduledFor: ideal };
  // Reserva feta amb menys antelació que la del recordatori.
  if (s.shortNoticePolicy === "SEND_IMMEDIATELY" && startsAt.getTime() - now.getTime() > 2 * H) return { status: "PENDING", scheduledFor: now };
  return { status: "SKIPPED", scheduledFor: ideal, skipReason: "SHORT_NOTICE" };
}

export const reminderKey = (appointmentId: string, startsAt: Date, kind = "REMINDER_24H") => `${appointmentId}:${startsAt.toISOString()}:${kind}`;

export async function scheduleReminder(
  tx: Prisma.TransactionClient,
  appt: Pick<Appointment, "id" | "organizationId" | "startsAt">,
  settings: OrganizationSettings,
  customer: Pick<Customer, "whatsappConsent">,
  now = new Date(),
) {
  const plan = planReminder(appt.startsAt, settings, customer.whatsappConsent, now);
  const key = reminderKey(appt.id, appt.startsAt);
  const existing = await tx.reminderJob.findUnique({ where: { idempotencyKey: key } });
  if (existing) {
    // Mateixa cita i mateixa hora: si ja s'havia enviat no es torna a enviar mai.
    if (existing.status === "CANCELLED") {
      await tx.reminderJob.update({ where: { id: existing.id }, data: { status: plan.status, scheduledFor: plan.scheduledFor, skipReason: plan.skipReason ?? null, attempts: 0, lastError: null } });
    }
    return existing;
  }
  return tx.reminderJob.create({
    data: {
      organizationId: appt.organizationId,
      appointmentId: appt.id,
      scheduledFor: plan.scheduledFor,
      appointmentStartsAt: appt.startsAt,
      status: plan.status,
      skipReason: plan.skipReason,
      idempotencyKey: key,
    },
  });
}

export async function cancelReminders(tx: Prisma.TransactionClient, appointmentId: string) {
  await tx.reminderJob.updateMany({ where: { appointmentId, status: { in: ["PENDING", "SKIPPED"] } }, data: { status: "CANCELLED" } });
}

async function finish(job: ReminderJob, status: ReminderStatus, extra: Partial<ReminderJob> = {}) {
  await db.reminderJob.update({ where: { id: job.id }, data: { status, lockedAt: null, ...extra } });
}

/** Comprovacions i enviament d'un recordatori ja reclamat (status PROCESSING). */
export async function sendReminder(job: ReminderJob, now = new Date()): Promise<ReminderStatus> {
  const end = async (status: ReminderStatus, extra: Partial<ReminderJob>) => {
    await finish(job, status, extra);
    return status;
  };
  const a = await db.appointment.findUnique({
    where: { id: job.appointmentId },
    include: { customer: true, organization: { include: { settings: true, subscription: true } } },
  });
  if (!a) {
    await finish(job, "CANCELLED", { skipReason: "APPOINTMENT_DELETED" });
    return "CANCELLED";
  }
  // 1. La reserva continua activa
  if (a.status !== "CONFIRMED") return end("CANCELLED", { skipReason: "APPOINTMENT_" + a.status });
  // 2. Hi ha consentiment
  if (!a.customer.whatsappConsent) return end("SKIPPED", { skipReason: "NO_CONSENT" });
  // 3. No s'ha enviat anteriorment (cap missatge amb èxit per a aquesta tasca o cita/hora)
  const prev = await db.whatsAppMessage.findFirst({
    where: { appointmentId: a.id, reminderJob: { appointmentStartsAt: job.appointmentStartsAt, kind: job.kind }, status: { in: ["SENT", "DELIVERED", "READ"] } },
  });
  if (prev) return end("SENT", { skipReason: "ALREADY_SENT" });
  // 4. La data i l'hora continuen sent les mateixes i la cita encara no ha passat
  if (a.startsAt.getTime() !== job.appointmentStartsAt.getTime()) return end("CANCELLED", { skipReason: "RESCHEDULED" });
  if (a.startsAt.getTime() <= now.getTime()) return end("SKIPPED", { skipReason: "TOO_LATE" });
  if (accessState(a.organization, a.organization.subscription, now) !== "ACTIVE") return end("SKIPPED", { skipReason: "ORG_INACTIVE" });
  const settings = a.organization.settings!;
  if (!settings.remindersEnabled) return end("SKIPPED", { skipReason: "DISABLED" });

  const provider = getWhatsAppProvider();
  if (!provider) {
    await logIntegrationError({ organizationId: a.organizationId, integration: "WHATSAPP", operation: "send", message: "WhatsApp no està configurat a la plataforma" });
    return end("FAILED", { lastError: "WhatsApp no configurat" });
  }

  const sender = settings.whatsappSenderId ? await db.whatsAppSender.findFirst({ where: { id: settings.whatsappSenderId, active: true } }) : null;
  const locale = a.customer.locale === "es" ? "es" : "ca";
  const params = reminderParams({ firstName: a.customer.firstName, center: a.organization.name, service: a.serviceName, startsAt: a.startsAt, timezone: settings.timezone, locale });
  const token = decrypt(a.manageTokenEnc);

  // Registrem el missatge ABANS de cridar l'API: si el procés mor a mig enviament,
  // sabrem que hi ha un intent i no el repetirem a cegues.
  const msg = await db.whatsAppMessage.create({
    data: {
      organizationId: a.organizationId,
      appointmentId: a.id,
      reminderJobId: job.id,
      customerId: a.customerId,
      toPhone: a.customer.phoneE164,
      templateName: env().WHATSAPP_TEMPLATE_REMINDER,
      language: locale,
      provider: provider.name,
      variables: { body: params, button: "[token]" },
    },
  });

  try {
    const r = await provider.sendTemplate(
      { to: a.customer.phoneE164, template: env().WHATSAPP_TEMPLATE_REMINDER, language: locale, bodyParams: params, buttonUrlSuffix: token },
      sender ? { phoneNumberId: sender.phoneNumberId } : undefined,
    );
    await db.whatsAppMessage.update({ where: { id: msg.id }, data: { status: "SENT", providerMessageId: r.providerMessageId, sentAt: new Date() } });
    await finish(job, "SENT", { sentAt: new Date(), lastError: provider.real ? null : "Mode de proves: no s'ha enviat cap WhatsApp real" });
    await db.appointmentEvent.create({ data: { organizationId: a.organizationId, appointmentId: a.id, type: "REMINDER_SENT", actorType: "SYSTEM", data: { provider: provider.name, real: provider.real } } });
    return "SENT";
  } catch (e) {
    const err = e instanceof WhatsAppSendError ? e : new WhatsAppSendError((e as Error).message, true);
    await db.whatsAppMessage.update({ where: { id: msg.id }, data: { status: "FAILED", errorCode: err.code, errorMessage: err.message.slice(0, 500), failedAt: new Date() } });
    await logIntegrationError({ organizationId: a.organizationId, integration: "WHATSAPP", operation: "send", message: err.message, details: { code: err.code ?? null, attempt: job.attempts, reminderJobId: job.id } });
    const retryAt = new Date(now.getTime() + RETRY_MIN[Math.min(job.attempts - 1, RETRY_MIN.length - 1)] * 60_000);
    if (err.retryable && job.attempts < job.maxAttempts && retryAt.getTime() < a.startsAt.getTime() - H) {
      await finish(job, "PENDING", { scheduledFor: retryAt, lastError: err.message });
      return "PENDING";
    }
    await finish(job, "FAILED", { lastError: err.message });
    await db.appointmentEvent.create({ data: { organizationId: a.organizationId, appointmentId: a.id, type: "REMINDER_FAILED", actorType: "SYSTEM", data: { error: err.message } } });
    return "FAILED";
  }
}

/** Executat pel treballador/cron. Reclama tasques amb SKIP LOCKED (segur en paral·lel). */
export async function processDueReminders(now = new Date(), limit = 50) {
  // Tasques encallades (procés mort): si ja hi ha un missatge enviat → SENT; si hi ha un
  // intent sense resposta → FAILED per revisar a mà (mai reenviem a cegues: evitem duplicats).
  const stuck = await db.reminderJob.findMany({ where: { status: "PROCESSING", lockedAt: { lt: new Date(now.getTime() - STUCK_MS) } }, include: { messages: true } });
  for (const j of stuck) {
    const sent = j.messages.find((m) => m.providerMessageId);
    if (sent) await finish(j, "SENT", { sentAt: sent.sentAt ?? now });
    else if (j.messages.length) await finish(j, "FAILED", { lastError: "Estat incert després d'una interrupció; revisar" });
    else await finish(j, "PENDING");
  }

  const claimed = await db.$queryRaw<ReminderJob[]>`
    UPDATE "ReminderJob" SET "status" = 'PROCESSING', "lockedAt" = ${now}, "attempts" = "attempts" + 1, "updatedAt" = now()
    WHERE "id" IN (
      SELECT "id" FROM "ReminderJob" WHERE "status" = 'PENDING' AND "scheduledFor" <= ${now}
      ORDER BY "scheduledFor" LIMIT ${limit} FOR UPDATE SKIP LOCKED)
    RETURNING *`;
  const results: Record<string, number> = {};
  for (const job of claimed) {
    let st: ReminderStatus;
    try {
      st = await sendReminder(job, now);
    } catch (e) {
      st = "FAILED";
      await finish(job, "FAILED", { lastError: (e as Error).message });
    }
    results[st] = (results[st] ?? 0) + 1;
  }
  return { claimed: claimed.length, results };
}

const ORDER: Record<string, number> = { QUEUED: 0, SENT: 1, DELIVERED: 2, READ: 3 };

/** Actualitzacions d'estat del webhook de Meta (sent → delivered → read / failed). */
export async function applyWhatsAppStatus(s: { id: string; status: string; timestamp?: string; errors?: { code: number; title?: string; message?: string }[] }) {
  const msg = await db.whatsAppMessage.findUnique({ where: { providerMessageId: s.id } });
  if (!msg) return false;
  const at = s.timestamp ? new Date(Number(s.timestamp) * 1000) : new Date();
  const st = s.status.toUpperCase();
  if (st === "FAILED") {
    const e = s.errors?.[0];
    await db.whatsAppMessage.update({ where: { id: msg.id }, data: { status: "FAILED", failedAt: at, errorCode: e ? String(e.code) : null, errorMessage: e?.message ?? e?.title ?? "failed" } });
    if (msg.reminderJobId) await db.reminderJob.update({ where: { id: msg.reminderJobId }, data: { status: "FAILED", lastError: e?.title ?? "Entrega fallida" } });
    await logIntegrationError({ organizationId: msg.organizationId, integration: "WHATSAPP", operation: "delivery", message: e?.message ?? e?.title ?? "Entrega fallida", details: { code: e?.code ?? null } });
    return true;
  }
  if (!(st in ORDER) || ORDER[st] <= ORDER[msg.status] || msg.status === "FAILED") return true; // no retrocedim
  await db.whatsAppMessage.update({
    where: { id: msg.id },
    data: { status: st as "SENT" | "DELIVERED" | "READ", ...(st === "DELIVERED" ? { deliveredAt: at } : {}), ...(st === "READ" ? { readAt: at, deliveredAt: msg.deliveredAt ?? at } : {}) },
  });
  if (msg.reminderJobId && (st === "DELIVERED" || st === "READ")) await db.reminderJob.update({ where: { id: msg.reminderJobId }, data: { status: st } });
  return true;
}
