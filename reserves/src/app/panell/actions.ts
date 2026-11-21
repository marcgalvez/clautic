"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { z } from "zod";
import { db } from "@/lib/db";
import { ForbiddenError, requireAdminWrite, requireWrite, type OrgContext } from "@/lib/auth/guards";
import { fmt, getT } from "@/lib/i18n";
import { audit } from "@/lib/audit";
import { parseWeekly } from "@/lib/schedule-form";
import { localToUtc } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";
import { hashPassword, PASSWORD_MIN } from "@/lib/auth/password";
import { cancelAppointment, createAppointment, rescheduleAppointment, setAppointmentStatus, type BookingError } from "@/lib/booking/service";
import { enqueueCalendarSync, processCalendarSyncJobs, resyncFutureAppointments } from "@/lib/google/sync";
import { googleApi } from "@/lib/google/api";
import { decrypt } from "@/lib/crypto";
import type { ActionState } from "@/components/ActionForm";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string, d = 0) => {
  const v = Number(str(f, k));
  return Number.isFinite(v) && str(f, k) !== "" ? Math.round(v) : d;
};
const bool = (f: FormData, k: string) => f.get(k) === "on";

async function tr(ctx: OrgContext) {
  return (await getT(ctx.user.locale)).t;
}

async function bookingErrorMsg(ctx: OrgContext, e: BookingError) {
  const t = await tr(ctx);
  return e === "SLOT_TAKEN" ? t.dash.appt.slotTaken : e === "NOT_AVAILABLE" ? t.dash.appt.notAvailable : t.common.error;
}

/** Comprova que tots els ids pertanyen a l'empresa (mai confiem en el formulari). */
async function ownedProfessionalIds(orgId: string, ids: string[]) {
  return (await db.professional.findMany({ where: { organizationId: orgId, id: { in: ids } }, select: { id: true } })).map((p) => p.id);
}

// ─────────── Serveis ───────────

const serviceSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  durationMinutes: z.number().int().min(5).max(600),
  priceCents: z.number().int().min(0).max(1_000_000).nullable(),
  bufferBeforeMinutes: z.number().int().min(0).max(240),
  bufferAfterMinutes: z.number().int().min(0).max(240),
});

export async function saveService(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireAdminWrite();
  const t = await tr(ctx);
  const price = str(f, "price").replace(",", ".");
  const parsed = serviceSchema.safeParse({
    name: str(f, "name"),
    description: str(f, "description") || undefined,
    durationMinutes: int(f, "duration"),
    priceCents: price ? Math.round(Number(price) * 100) : null,
    bufferBeforeMinutes: int(f, "bufferBefore"),
    bufferAfterMinutes: int(f, "bufferAfter"),
  });
  if (!parsed.success) return { error: t.common.error };
  const id = str(f, "id");
  const proIds = await ownedProfessionalIds(ctx.orgId, f.getAll("professionalIds").map(String));
  const data = { ...parsed.data, active: bool(f, "active") };
  const service = await db.$transaction(async (tx) => {
    const s = id
      ? await tx.service.update({ where: { id: (await tx.service.findFirstOrThrow({ where: { id, organizationId: ctx.orgId } })).id }, data })
      : await tx.service.create({ data: { ...data, organizationId: ctx.orgId } });
    await tx.professionalService.deleteMany({ where: { serviceId: s.id, organizationId: ctx.orgId } });
    await tx.professionalService.createMany({ data: proIds.map((professionalId) => ({ organizationId: ctx.orgId, professionalId, serviceId: s.id })) });
    return s;
  });
  await audit({ organizationId: ctx.orgId, actorUserId: ctx.user.id, action: id ? "service.updated" : "service.created", entityType: "Service", entityId: service.id });
  revalidatePath("/panell/serveis");
  redirect("/panell/serveis");
}

export async function toggleService(f: FormData) {
  const ctx = await requireAdminWrite();
  const s = await db.service.findFirst({ where: { id: str(f, "id"), organizationId: ctx.orgId } });
  if (s) await db.service.update({ where: { id: s.id }, data: { active: !s.active } });
  revalidatePath("/panell/serveis");
}

// ─────────── Professionals ───────────

export async function saveProfessional(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireAdminWrite();
  const t = await tr(ctx);
  const name = str(f, "name");
  if (!name || name.length > 80) return { error: t.common.error };
  const schedule = parseWeekly(f, "sch");
  if (typeof schedule === "string") return { error: `${t.common.error} (${schedule})` };
  const color = /^#[0-9a-fA-F]{6}$/.test(str(f, "color")) ? str(f, "color") : "#0f766e";
  const id = str(f, "id");
  const svcIds = (await db.service.findMany({ where: { organizationId: ctx.orgId, id: { in: f.getAll("serviceIds").map(String) } }, select: { id: true } })).map((s) => s.id);

  // Calendari: "connectionId|calendarId" d'una connexió de la mateixa empresa
  let googleConnectionId: string | null = null;
  let googleCalendarId: string | null = null;
  const cal = str(f, "calendar");
  if (cal) {
    const [cid, ...rest] = cal.split("|");
    const conn = await db.googleCalendarConnection.findFirst({ where: { id: cid, organizationId: ctx.orgId } });
    if (conn && rest.length) {
      googleConnectionId = conn.id;
      googleCalendarId = rest.join("|");
    }
  }

  const data = { name, email: str(f, "email") || null, color, active: bool(f, "active"), canManageAvailability: bool(f, "canManage"), sortOrder: int(f, "sortOrder"), googleConnectionId, googleCalendarId };
  const before = id ? await db.professional.findFirst({ where: { id, organizationId: ctx.orgId } }) : null;
  const pro = await db.$transaction(async (tx) => {
    const p = id
      ? await tx.professional.update({ where: { id: (await tx.professional.findFirstOrThrow({ where: { id, organizationId: ctx.orgId } })).id }, data })
      : await tx.professional.create({ data: { ...data, organizationId: ctx.orgId } });
    await tx.professionalService.deleteMany({ where: { professionalId: p.id } });
    await tx.professionalService.createMany({ data: svcIds.map((serviceId) => ({ organizationId: ctx.orgId, professionalId: p.id, serviceId })) });
    await tx.professionalSchedule.deleteMany({ where: { professionalId: p.id } });
    await tx.professionalSchedule.createMany({ data: schedule.map((r) => ({ ...r, organizationId: ctx.orgId, professionalId: p.id })) });
    return p;
  });
  if (before && (before.googleCalendarId !== googleCalendarId || before.googleConnectionId !== googleConnectionId)) await resyncFutureAppointments(ctx.orgId, pro.id);
  await audit({ organizationId: ctx.orgId, actorUserId: ctx.user.id, action: id ? "professional.updated" : "professional.created", entityType: "Professional", entityId: pro.id });
  revalidatePath("/panell/professionals");
  redirect("/panell/professionals");
}

export async function createProfessionalAccess(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireAdminWrite();
  const t = await tr(ctx);
  const pro = await db.professional.findFirst({ where: { id: str(f, "professionalId"), organizationId: ctx.orgId }, include: { member: true } });
  const email = str(f, "email").toLowerCase();
  const password = str(f, "password");
  if (!pro || pro.member || !z.string().email().safeParse(email).success || password.length < PASSWORD_MIN) return { error: t.common.error };
  const existing = await db.user.findUnique({ where: { email } });
  if (existing && (await db.organizationMember.findFirst({ where: { userId: existing.id, organizationId: ctx.orgId } }))) return { error: t.auth.emailTaken };
  if (existing) return { error: t.auth.emailTaken }; // no reutilitzem comptes d'altres empreses sense consentiment
  await db.$transaction(async (tx) => {
    const u = await tx.user.create({ data: { email, name: pro.name, passwordHash: await hashPassword(password), locale: ctx.user.locale } });
    await tx.organizationMember.create({ data: { organizationId: ctx.orgId, userId: u.id, role: "PROFESSIONAL", professionalId: pro.id } });
  });
  await audit({ organizationId: ctx.orgId, actorUserId: ctx.user.id, action: "professional.access_created", entityType: "Professional", entityId: pro.id });
  revalidatePath(`/panell/professionals/${pro.id}`);
  return { ok: true, message: t.common.saved };
}

// ─────────── Configuració ───────────

const settingsSchema = z.object({
  phone: z.string().max(30).nullable(),
  address: z.string().max(200).nullable(),
  logoUrl: z.string().url().max(500).nullable(),
  timezone: z.string().refine((tz) => DateTime.local().setZone(tz).isValid),
  defaultLocale: z.enum(["ca", "es"]),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  minNoticeMinutes: z.number().int().min(0).max(43200),
  maxAdvanceDays: z.number().int().min(1).max(365),
  slotStepMinutes: z.number().int().min(5).max(120),
  emailRequirement: z.enum(["HIDDEN", "OPTIONAL", "REQUIRED"]),
  allowCustomerCancel: z.boolean(),
  allowCustomerReschedule: z.boolean(),
  cancelDeadlineHours: z.number().int().min(0).max(720),
  cancellationPolicy: z.string().max(2000).nullable(),
  bookingTerms: z.string().max(4000).nullable(),
  privacyPolicy: z.string().max(8000).nullable(),
  privacyContactEmail: z.string().email().nullable(),
  remindersEnabled: z.boolean(),
  reminderHoursBefore: z.number().int().min(1).max(72),
  shortNoticePolicy: z.enum(["SKIP", "SEND_IMMEDIATELY"]),
  googleCancelMode: z.enum(["DELETE", "MARK_CANCELLED"]),
  dataRetentionMonths: z.number().int().min(1).max(120),
});

export async function saveSettings(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireAdminWrite();
  const t = await tr(ctx);
  const n = (k: string) => str(f, k) || null;
  const parsed = settingsSchema.safeParse({
    phone: n("phone"),
    address: n("address"),
    logoUrl: n("logoUrl"),
    timezone: str(f, "timezone"),
    defaultLocale: str(f, "defaultLocale"),
    accentColor: str(f, "accentColor"),
    minNoticeMinutes: int(f, "minNoticeMinutes"),
    maxAdvanceDays: int(f, "maxAdvanceDays", 60),
    slotStepMinutes: int(f, "slotStepMinutes", 15),
    emailRequirement: str(f, "emailRequirement"),
    allowCustomerCancel: bool(f, "allowCustomerCancel"),
    allowCustomerReschedule: bool(f, "allowCustomerReschedule"),
    cancelDeadlineHours: int(f, "cancelDeadlineHours"),
    cancellationPolicy: n("cancellationPolicy"),
    bookingTerms: n("bookingTerms"),
    privacyPolicy: n("privacyPolicy"),
    privacyContactEmail: n("privacyContactEmail"),
    remindersEnabled: bool(f, "remindersEnabled"),
    reminderHoursBefore: int(f, "reminderHoursBefore", 24),
    shortNoticePolicy: str(f, "shortNoticePolicy"),
    googleCancelMode: str(f, "googleCancelMode"),
    dataRetentionMonths: int(f, "dataRetentionMonths", 24),
  });
  if (!parsed.success) return { error: `${t.common.error} (${parsed.error.issues.map((i) => i.path.join(".")).join(", ")})` };
  const hours = parseWeekly(f, "bh");
  if (typeof hours === "string") return { error: `${t.common.error} (${hours})` };
  const name = str(f, "name");
  await db.$transaction([
    db.organizationSettings.update({ where: { organizationId: ctx.orgId }, data: parsed.data }),
    ...(name ? [db.organization.update({ where: { id: ctx.orgId }, data: { name: name.slice(0, 80) } })] : []),
    db.businessHours.deleteMany({ where: { organizationId: ctx.orgId } }),
    db.businessHours.createMany({ data: hours.map((h) => ({ ...h, organizationId: ctx.orgId })) }),
  ]);
  await audit({ organizationId: ctx.orgId, actorUserId: ctx.user.id, action: "settings.updated" });
  revalidatePath("/panell", "layout");
  return { ok: true, message: t.common.saved };
}

// ─────────── Bloquejos / vacances / festius ───────────

export async function createBlock(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireWrite();
  const t = await tr(ctx);
  const settings = await db.organizationSettings.findUniqueOrThrow({ where: { organizationId: ctx.orgId } });
  const tz = settings.timezone;
  let professionalId: string | null = str(f, "professionalId") || null;
  if (ctx.role === "PROFESSIONAL") {
    const me = await db.professional.findFirst({ where: { id: ctx.professionalId ?? "", organizationId: ctx.orgId } });
    if (!me?.canManageAvailability) throw new ForbiddenError();
    professionalId = me.id; // un professional només es pot bloquejar a si mateix
  } else if (professionalId && !(await ownedProfessionalIds(ctx.orgId, [professionalId])).length) return { error: t.common.error };

  const allDay = bool(f, "allDay");
  const sd = str(f, "startDate");
  const ed = str(f, "endDate") || sd;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sd) || !/^\d{4}-\d{2}-\d{2}$/.test(ed)) return { error: t.common.error };
  const startsAt = allDay ? DateTime.fromISO(sd, { zone: tz }).startOf("day").toJSDate() : localToUtc(sd, str(f, "startTime") || "00:00", tz);
  const endsAt = allDay ? DateTime.fromISO(ed, { zone: tz }).plus({ days: 1 }).startOf("day").toJSDate() : localToUtc(ed, str(f, "endTime") || "23:59", tz);
  if (!(endsAt > startsAt)) return { error: t.common.error };
  const type = (["BLOCK", "VACATION", "HOLIDAY"] as const).find((x) => x === str(f, "type")) ?? "BLOCK";
  await db.timeOff.create({ data: { organizationId: ctx.orgId, professionalId, type, startsAt, endsAt, reason: str(f, "reason").slice(0, 200) || null } });
  const conflicts = await db.appointment.count({ where: { organizationId: ctx.orgId, status: { in: ["PENDING", "CONFIRMED"] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt }, ...(professionalId ? { professionalId } : {}) } });
  await audit({ organizationId: ctx.orgId, actorUserId: ctx.user.id, action: "timeoff.created", metadata: { professionalId, type } });
  revalidatePath("/panell/bloquejos");
  revalidatePath("/panell/calendari");
  return { ok: true, message: conflicts ? fmt(t.dash.blocks.conflicts, { n: conflicts }) : t.common.saved };
}

export async function deleteBlock(f: FormData) {
  const ctx = await requireWrite();
  const b = await db.timeOff.findFirst({ where: { id: str(f, "id"), organizationId: ctx.orgId } });
  if (!b) return;
  if (ctx.role === "PROFESSIONAL" && b.professionalId !== ctx.professionalId) throw new ForbiddenError();
  await db.timeOff.delete({ where: { id: b.id } });
  revalidatePath("/panell/bloquejos");
  revalidatePath("/panell/calendari");
}

// ─────────── Cites ───────────

export async function createAppointmentAction(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireAdminWrite();
  const t = await tr(ctx);
  const settings = await db.organizationSettings.findUniqueOrThrow({ where: { organizationId: ctx.orgId } });
  const phone = normalizePhone(str(f, "phone"));
  if (!phone) return { error: t.booking.invalidPhone };
  if (!str(f, "firstName") || !/^\d{4}-\d{2}-\d{2}$/.test(str(f, "date")) || !/^\d{2}:\d{2}$/.test(str(f, "time"))) return { error: t.common.error };
  const consent = bool(f, "consent");
  const r = await createAppointment({
    orgId: ctx.orgId,
    serviceId: str(f, "serviceId"),
    professionalId: str(f, "professionalId") || null,
    startsAt: localToUtc(str(f, "date"), str(f, "time"), settings.timezone),
    customer: { firstName: str(f, "firstName").slice(0, 60), lastName: str(f, "lastName").slice(0, 80), phoneE164: phone, email: str(f, "email") || null, locale: settings.defaultLocale },
    whatsappConsent: consent,
    consentText: t.dash.appt.consentGiven,
    source: "DASHBOARD",
    actor: { type: "USER", userId: ctx.user.id },
    ignoreRules: bool(f, "ignoreRules"),
    internalNote: str(f, "note").slice(0, 500),
  });
  if (!r.ok) return { error: await bookingErrorMsg(ctx, r.error) };
  await audit({ organizationId: ctx.orgId, actorUserId: ctx.user.id, action: "appointment.created", entityType: "Appointment", entityId: r.value.id });
  redirect(`/panell/cites/${r.value.id}`);
}

export async function rescheduleAction(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireAdminWrite();
  const t = await tr(ctx);
  const settings = await db.organizationSettings.findUniqueOrThrow({ where: { organizationId: ctx.orgId } });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str(f, "date")) || !/^\d{2}:\d{2}$/.test(str(f, "time"))) return { error: t.common.error };
  const r = await rescheduleAppointment({
    orgId: ctx.orgId,
    appointmentId: str(f, "id"),
    startsAt: localToUtc(str(f, "date"), str(f, "time"), settings.timezone),
    professionalId: str(f, "professionalId") || undefined,
    actor: { type: "USER", userId: ctx.user.id },
    ignoreRules: bool(f, "ignoreRules"),
  });
  if (!r.ok) return { error: await bookingErrorMsg(ctx, r.error) };
  await audit({ organizationId: ctx.orgId, actorUserId: ctx.user.id, action: "appointment.rescheduled", entityType: "Appointment", entityId: r.value.id });
  revalidatePath(`/panell/cites/${r.value.id}`);
  return { ok: true, message: t.dash.appt.updated };
}

export async function cancelAction(f: FormData) {
  const ctx = await requireAdminWrite();
  const id = str(f, "id");
  await cancelAppointment({ orgId: ctx.orgId, appointmentId: id, actor: { type: "USER", userId: ctx.user.id }, reason: str(f, "reason").slice(0, 300) || null });
  await audit({ organizationId: ctx.orgId, actorUserId: ctx.user.id, action: "appointment.cancelled", entityType: "Appointment", entityId: id });
  revalidatePath(`/panell/cites/${id}`);
}

export async function statusAction(f: FormData) {
  const ctx = await requireAdminWrite();
  const status = (["COMPLETED", "NO_SHOW", "CONFIRMED"] as const).find((s) => s === str(f, "status"));
  if (!status) return;
  await setAppointmentStatus(ctx.orgId, str(f, "id"), status, { type: "USER", userId: ctx.user.id });
  revalidatePath(`/panell/cites/${str(f, "id")}`);
}

export async function retrySyncAction(f: FormData) {
  const ctx = await requireAdminWrite();
  const a = await db.appointment.findFirst({ where: { id: str(f, "id"), organizationId: ctx.orgId } });
  if (!a) return;
  const job = await db.$transaction((tx) => enqueueCalendarSync(tx, a, a.status === "CANCELLED" ? "DELETE" : "UPSERT"));
  await processCalendarSyncJobs(1, job.id);
  revalidatePath(`/panell/cites/${a.id}`);
}

// ─────────── Clients (RGPD) ───────────

export async function anonymizeCustomer(f: FormData) {
  const ctx = await requireAdminWrite();
  const c = await db.customer.findFirst({ where: { id: str(f, "id"), organizationId: ctx.orgId } });
  if (!c) return;
  await db.$transaction(async (tx) => {
    const future = await tx.appointment.findMany({ where: { customerId: c.id, status: { in: ["PENDING", "CONFIRMED"] }, startsAt: { gt: new Date() } } });
    for (const a of future) await tx.reminderJob.updateMany({ where: { appointmentId: a.id, status: "PENDING" }, data: { status: "CANCELLED" } });
    await tx.customer.update({ where: { id: c.id }, data: { firstName: "—", lastName: "", phoneE164: `deleted:${c.id}`, email: null, whatsappConsent: false } });
    await tx.whatsAppMessage.updateMany({ where: { customerId: c.id }, data: { toPhone: "deleted", variables: {} } });
    await tx.consentRecord.updateMany({ where: { customerId: c.id }, data: { ip: null, userAgent: null } });
  });
  await audit({ organizationId: ctx.orgId, actorUserId: ctx.user.id, action: "customer.anonymized", entityType: "Customer", entityId: c.id });
  revalidatePath("/panell/clients");
}

// ─────────── Google ───────────

export async function disconnectGoogle(f: FormData) {
  const ctx = await requireAdminWrite();
  const conn = await db.googleCalendarConnection.findFirst({ where: { id: str(f, "id"), organizationId: ctx.orgId }, include: { watches: true } });
  if (!conn) return;
  try {
    const token = decrypt(conn.accessTokenEnc);
    for (const w of conn.watches) await googleApi().stopChannel(token, w.channelId, w.resourceId);
    await googleApi().revoke(decrypt(conn.refreshTokenEnc));
  } catch {
    /* revocació best-effort */
  }
  await db.$transaction([
    db.professional.updateMany({ where: { googleConnectionId: conn.id }, data: { googleConnectionId: null, googleCalendarId: null } }),
    db.googleCalendarConnection.delete({ where: { id: conn.id } }),
  ]);
  await audit({ organizationId: ctx.orgId, actorUserId: ctx.user.id, action: "google.disconnected", metadata: { email: conn.googleEmail } });
  revalidatePath("/panell/integracions");
}

export async function assignCalendar(f: FormData) {
  const ctx = await requireAdminWrite();
  const pro = await db.professional.findFirst({ where: { id: str(f, "professionalId"), organizationId: ctx.orgId } });
  if (!pro) return;
  const [cid, ...rest] = str(f, "calendar").split("|");
  const conn = cid ? await db.googleCalendarConnection.findFirst({ where: { id: cid, organizationId: ctx.orgId } }) : null;
  await db.professional.update({ where: { id: pro.id }, data: { googleConnectionId: conn?.id ?? null, googleCalendarId: conn && rest.length ? rest.join("|") : null } });
  await resyncFutureAppointments(ctx.orgId, pro.id);
  await audit({ organizationId: ctx.orgId, actorUserId: ctx.user.id, action: "google.calendar_assigned", entityType: "Professional", entityId: pro.id });
  revalidatePath("/panell/integracions");
}
