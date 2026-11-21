import { DateTime } from "luxon";
import type { AppointmentSource, AppointmentStatus, Prisma } from "@prisma/client";
import { db } from "../db";
import { encrypt, randomToken, sha256 } from "../crypto";
import { accessState } from "../auth/access";
import { getAvailability } from "../availability/service";
import { blockFor } from "../availability/engine";
import { enqueueCalendarSync, processCalendarSyncJobs } from "../google/sync";
import { cancelReminders, scheduleReminder } from "../whatsapp/reminders";

export type BookingError = "ORG_INACTIVE" | "INVALID" | "NOT_AVAILABLE" | "SLOT_TAKEN" | "NOT_FOUND" | "NOT_ALLOWED";
export type Result<T> = { ok: true; value: T } | { ok: false; error: BookingError };

export const CONSENT_VERSION = "2026-11-v1";

/** Violació de la restricció d'exclusió (23P01) = algú altre ha reservat l'interval. */
export function isOverlapError(e: unknown): boolean {
  const s = String((e as { message?: string })?.message ?? e);
  return s.includes("Appointment_no_overlap") || s.includes("23P01") || s.includes("exclusion constraint");
}

type Actor = { type: "CUSTOMER" | "USER" | "SYSTEM"; userId?: string | null };

async function trySyncNow(jobId: string | null) {
  if (!jobId) return;
  // Intent immediat (millor experiència); si falla queda a la cua amb reintents.
  await Promise.race([processCalendarSyncJobs(1, jobId).catch(() => undefined), new Promise((r) => setTimeout(r, 8000))]);
}

function needsSync(pro: { googleCalendarId: string | null; googleConnection: { status: string } | null }) {
  return Boolean(pro.googleCalendarId && pro.googleConnection && pro.googleConnection.status !== "REVOKED");
}

export type CreateInput = {
  orgId: string;
  serviceId: string;
  professionalId: string | null; // null = qualsevol disponible
  startsAt: Date;
  customer: { firstName: string; lastName: string; phoneE164: string; email?: string | null; locale: string };
  whatsappConsent: boolean;
  consentText: string;
  source: AppointmentSource;
  actor: Actor;
  ip?: string | null;
  userAgent?: string | null;
  ignoreRules?: boolean;
  internalNote?: string | null;
  now?: Date;
};

export async function createAppointment(input: CreateInput): Promise<Result<{ id: string; manageToken: string }>> {
  const now = input.now ?? new Date();
  const org = await db.organization.findUnique({ where: { id: input.orgId }, include: { settings: true, subscription: true } });
  if (!org?.settings) return { ok: false, error: "NOT_FOUND" };
  const access = accessState(org, org.subscription, now);
  if (input.source === "PUBLIC" ? access !== "ACTIVE" : access === "SUSPENDED" || access === "EXPIRED") return { ok: false, error: "ORG_INACTIVE" };
  const settings = org.settings;
  const service = await db.service.findFirst({ where: { id: input.serviceId, organizationId: org.id, active: true } });
  if (!service) return { ok: false, error: "INVALID" };

  // Revalidació en directe (Google FreeBusy en viu) just abans de confirmar.
  const date = DateTime.fromJSDate(input.startsAt).setZone(settings.timezone).toISODate()!;
  const av = await getAvailability({
    orgId: org.id,
    serviceId: service.id,
    professionalId: input.professionalId,
    fromDate: date,
    toDate: date,
    mode: "live",
    candidateStart: input.startsAt,
    ignoreRules: input.ignoreRules,
    now,
  });
  const slot = av?.days[0]?.slots.find((s) => s.start === input.startsAt.toISOString());
  if (!slot) return { ok: false, error: "NOT_AVAILABLE" };

  // "Qualsevol professional": prioritzem qui té menys cites aquell dia.
  let candidates = slot.professionalIds;
  if (!input.professionalId && candidates.length > 1) {
    const dayStart = DateTime.fromISO(date, { zone: settings.timezone }).startOf("day").toJSDate();
    const dayEnd = DateTime.fromISO(date, { zone: settings.timezone }).endOf("day").toJSDate();
    const loads = await db.appointment.groupBy({
      by: ["professionalId"],
      where: { organizationId: org.id, professionalId: { in: candidates }, status: { in: ["PENDING", "CONFIRMED"] }, startsAt: { gte: dayStart, lte: dayEnd } },
      _count: true,
    });
    const load = new Map(loads.map((l) => [l.professionalId, l._count]));
    candidates = [...candidates].sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0));
  }

  const times = blockFor(input.startsAt, service);
  const token = randomToken(32);

  for (const professionalId of candidates) {
    const pro = await db.professional.findFirst({ where: { id: professionalId, organizationId: org.id }, include: { googleConnection: true } });
    if (!pro) continue;
    try {
      const created = await db.$transaction(async (tx) => {
        const customer = await tx.customer.upsert({
          where: { organizationId_phoneE164: { organizationId: org.id, phoneE164: input.customer.phoneE164 } },
          create: {
            organizationId: org.id,
            ...input.customer,
            email: input.customer.email || null,
            whatsappConsent: input.whatsappConsent,
            whatsappConsentAt: input.whatsappConsent ? now : null,
          },
          update: {
            firstName: input.customer.firstName,
            lastName: input.customer.lastName,
            locale: input.customer.locale,
            ...(input.customer.email ? { email: input.customer.email } : {}),
            // Al formulari públic l'última decisió del client és la que val.
            ...(input.source === "PUBLIC" || input.whatsappConsent ? { whatsappConsent: input.whatsappConsent, whatsappConsentAt: input.whatsappConsent ? now : null } : {}),
          },
        });
        if (input.source === "PUBLIC" || input.whatsappConsent) {
          await tx.consentRecord.create({
            data: { organizationId: org.id, customerId: customer.id, type: "WHATSAPP_OPERATIONAL", granted: input.whatsappConsent, textVersion: CONSENT_VERSION, text: input.consentText, ip: input.ip, userAgent: input.userAgent },
          });
        }
        const appt = await tx.appointment.create({
          data: {
            organizationId: org.id,
            professionalId,
            serviceId: service.id,
            customerId: customer.id,
            ...times,
            status: "CONFIRMED",
            source: input.source,
            serviceName: service.name,
            durationMinutes: service.durationMinutes,
            priceCents: service.priceCents,
            internalNote: input.internalNote || null,
            manageTokenHash: sha256(token),
            manageTokenEnc: encrypt(token),
            googleSyncStatus: needsSync(pro) ? "PENDING" : "NOT_APPLICABLE",
          },
        });
        await tx.appointmentEvent.create({
          data: { organizationId: org.id, appointmentId: appt.id, type: "CREATED", actorType: input.actor.type, actorUserId: input.actor.userId, data: { source: input.source, startsAt: appt.startsAt.toISOString() } },
        });
        const job = needsSync(pro) ? await enqueueCalendarSync(tx, appt, "UPSERT") : null;
        await scheduleReminder(tx, appt, settings, customer, now);
        return { appt, jobId: job?.id ?? null };
      });
      await trySyncNow(created.jobId);
      return { ok: true, value: { id: created.appt.id, manageToken: token } };
    } catch (e) {
      if (isOverlapError(e)) continue; // un altre client ha guanyat la franja: provem el següent professional
      throw e;
    }
  }
  return { ok: false, error: "SLOT_TAKEN" };
}

export async function rescheduleAppointment(input: {
  orgId: string;
  appointmentId: string;
  startsAt: Date;
  professionalId?: string;
  actor: Actor;
  ignoreRules?: boolean;
  now?: Date;
}): Promise<Result<{ id: string }>> {
  const now = input.now ?? new Date();
  const a = await db.appointment.findFirst({ where: { id: input.appointmentId, organizationId: input.orgId }, include: { service: true, organization: { include: { settings: true } } } });
  if (!a) return { ok: false, error: "NOT_FOUND" };
  if (a.status !== "CONFIRMED" && a.status !== "PENDING") return { ok: false, error: "NOT_ALLOWED" };
  const settings = a.organization.settings!;
  const professionalId = input.professionalId ?? a.professionalId;
  const date = DateTime.fromJSDate(input.startsAt).setZone(settings.timezone).toISODate()!;
  const av = await getAvailability({
    orgId: input.orgId,
    serviceId: a.serviceId,
    professionalId,
    fromDate: date,
    toDate: date,
    mode: "live",
    excludeAppointmentId: a.id,
    candidateStart: input.startsAt,
    ignoreRules: input.ignoreRules,
    now,
  });
  if (!av?.days[0]?.slots.some((s) => s.start === input.startsAt.toISOString())) return { ok: false, error: "NOT_AVAILABLE" };

  const pro = await db.professional.findFirst({ where: { id: professionalId, organizationId: input.orgId }, include: { googleConnection: true } });
  if (!pro) return { ok: false, error: "INVALID" };
  const times = blockFor(input.startsAt, a.service);
  const sync = needsSync(pro) || Boolean(a.googleEventId);
  try {
    const jobId = await db.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id: a.id },
        data: { ...times, professionalId, ...(sync ? { googleSyncStatus: "PENDING" } : {}) },
        include: { customer: true },
      });
      await tx.appointmentEvent.create({
        data: {
          organizationId: a.organizationId,
          appointmentId: a.id,
          type: "RESCHEDULED",
          actorType: input.actor.type,
          actorUserId: input.actor.userId,
          data: { from: a.startsAt.toISOString(), to: updated.startsAt.toISOString(), fromProfessionalId: a.professionalId, toProfessionalId: professionalId },
        },
      });
      await cancelReminders(tx, a.id);
      await scheduleReminder(tx, updated, settings, updated.customer, now);
      return sync ? (await enqueueCalendarSync(tx, updated, "UPSERT")).id : null;
    });
    await trySyncNow(jobId);
    return { ok: true, value: { id: a.id } };
  } catch (e) {
    if (isOverlapError(e)) return { ok: false, error: "SLOT_TAKEN" };
    throw e;
  }
}

export async function cancelAppointment(input: { orgId: string; appointmentId: string; actor: Actor; reason?: string | null }): Promise<Result<{ id: string }>> {
  const a = await db.appointment.findFirst({ where: { id: input.appointmentId, organizationId: input.orgId } });
  if (!a) return { ok: false, error: "NOT_FOUND" };
  if (a.status === "CANCELLED") return { ok: true, value: { id: a.id } };
  const sync = Boolean(a.googleEventId) || a.googleSyncStatus !== "NOT_APPLICABLE";
  const jobId = await db.$transaction(async (tx) => {
    const u = await tx.appointment.update({
      where: { id: a.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledBy: input.actor.type === "USER" ? `USER:${input.actor.userId}` : input.actor.type,
        cancelReason: input.reason ?? null,
        ...(sync ? { googleSyncStatus: "PENDING" } : {}),
      },
    });
    await tx.appointmentEvent.create({ data: { organizationId: a.organizationId, appointmentId: a.id, type: "CANCELLED", actorType: input.actor.type, actorUserId: input.actor.userId, data: { reason: input.reason ?? null } } });
    await cancelReminders(tx, a.id);
    return sync ? (await enqueueCalendarSync(tx, u, "DELETE")).id : null;
  });
  await trySyncNow(jobId);
  return { ok: true, value: { id: a.id } };
}

export async function setAppointmentStatus(orgId: string, appointmentId: string, status: Extract<AppointmentStatus, "COMPLETED" | "NO_SHOW" | "CONFIRMED">, actor: Actor) {
  const a = await db.appointment.findFirst({ where: { id: appointmentId, organizationId: orgId } });
  if (!a || a.status === "CANCELLED") return false;
  await db.$transaction([
    db.appointment.update({ where: { id: a.id }, data: { status } }),
    db.appointmentEvent.create({ data: { organizationId: orgId, appointmentId: a.id, type: "STATUS_CHANGED", actorType: actor.type, actorUserId: actor.userId, data: { from: a.status, to: status } } }),
  ]);
  return true;
}

/** Cita a partir de l'enllaç segur del client (token en clar → hash). */
export async function findByManageToken(token: string) {
  if (!token || token.length < 20) return null;
  return db.appointment.findUnique({
    where: { manageTokenHash: sha256(token) },
    include: { organization: { include: { settings: true, subscription: true } }, professional: true, service: true, customer: true },
  });
}

export function customerCanChange(a: { startsAt: Date; status: AppointmentStatus }, s: { cancelDeadlineHours: number }, now = new Date()) {
  return (a.status === "CONFIRMED" || a.status === "PENDING") && a.startsAt.getTime() - now.getTime() >= s.cancelDeadlineHours * 3600_000;
}

export type Tx = Prisma.TransactionClient;
