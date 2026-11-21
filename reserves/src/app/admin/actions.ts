"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/request";
import type { ActionState } from "@/components/ActionForm";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const date = (f: FormData, k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(str(f, k)) ? DateTime.fromISO(str(f, k), { zone: "Europe/Madrid" }).toJSDate() : null);
const endDate = (f: FormData, k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(str(f, k)) ? DateTime.fromISO(str(f, k), { zone: "Europe/Madrid" }).endOf("day").toJSDate() : null);

const subSchema = z.object({
  plan: z.enum(["TRIAL", "BASIC", "PRO"]),
  status: z.enum(["PENDING", "ACTIVE", "PAST_DUE", "CANCELED", "EXPIRED"]),
  amountCents: z.number().int().min(0).nullable(),
  paymentReference: z.string().max(120).nullable(),
  notes: z.string().max(2000).nullable(),
});

function readSub(f: FormData, forceActive = false) {
  const amount = str(f, "amount").replace(",", ".");
  const parsed = subSchema.safeParse({
    plan: str(f, "plan") || "BASIC",
    status: forceActive ? "ACTIVE" : str(f, "subStatus") || "PENDING",
    amountCents: amount ? Math.round(Number(amount) * 100) : null,
    paymentReference: str(f, "paymentReference") || null,
    notes: str(f, "notes") || null,
  });
  if (!parsed.success) return null;
  return { ...parsed.data, purchasedAt: date(f, "purchasedAt"), startsAt: date(f, "startsAt"), endsAt: endDate(f, "endsAt") };
}

/** Dona accés: l'empresa ha comprat → s'activa la pàgina de reserves i els recordatoris. */
export async function grantAccess(_: ActionState, f: FormData): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const org = await db.organization.findUnique({ where: { id: str(f, "orgId") } });
  const sub = readSub(f, true);
  if (!org || !sub) return { error: "Dades invàlides" };
  const data = { ...sub, purchasedAt: sub.purchasedAt ?? new Date(), startsAt: sub.startsAt ?? new Date() };
  await db.$transaction([
    db.organization.update({ where: { id: org.id }, data: { status: "ACTIVE", statusReason: null, approvedAt: new Date(), approvedById: admin.id } }),
    db.subscription.upsert({ where: { organizationId: org.id }, create: { organizationId: org.id, ...data }, update: data }),
  ]);
  await audit({ organizationId: org.id, actorUserId: admin.id, action: "admin.access_granted", metadata: { plan: data.plan, endsAt: data.endsAt?.toISOString() ?? null, ref: data.paymentReference }, ip: await clientIp() });
  revalidatePath("/admin", "layout");
  redirect(`/admin/empreses/${org.id}?granted=1`);
}

export async function saveSubscription(_: ActionState, f: FormData): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const org = await db.organization.findUnique({ where: { id: str(f, "orgId") } });
  const sub = readSub(f);
  if (!org || !sub) return { error: "Dades invàlides" };
  await db.subscription.upsert({ where: { organizationId: org.id }, create: { organizationId: org.id, ...sub }, update: sub });
  await audit({ organizationId: org.id, actorUserId: admin.id, action: "admin.subscription_updated", metadata: { plan: sub.plan, status: sub.status, endsAt: sub.endsAt?.toISOString() ?? null }, ip: await clientIp() });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Desat" };
}

export async function suspendOrg(f: FormData) {
  const admin = await requireSuperAdmin();
  const id = str(f, "orgId");
  const reason = str(f, "reason").slice(0, 300) || null;
  await db.organization.update({ where: { id }, data: { status: "SUSPENDED", statusReason: reason } });
  await audit({ organizationId: id, actorUserId: admin.id, action: "admin.suspended", metadata: { reason }, ip: await clientIp() });
  revalidatePath("/admin", "layout");
}

export async function reactivateOrg(f: FormData) {
  const admin = await requireSuperAdmin();
  const id = str(f, "orgId");
  const org = await db.organization.findUniqueOrThrow({ where: { id } });
  await db.organization.update({ where: { id }, data: { status: org.approvedAt ? "ACTIVE" : "PENDING_APPROVAL", statusReason: null } });
  await audit({ organizationId: id, actorUserId: admin.id, action: "admin.reactivated", ip: await clientIp() });
  revalidatePath("/admin", "layout");
}
