import { getOrgContext, isOrgAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

/** Exportació RGPD: d'un client (dret d'accés/portabilitat) o de tota l'empresa. Sense secrets. */
export async function GET(req: Request) {
  const ctx = await getOrgContext();
  if (!ctx || !isOrgAdmin(ctx)) return new Response("Unauthorized", { status: 401 });
  const customerId = new URL(req.url).searchParams.get("customer");
  let data: unknown;
  if (customerId) {
    data = await db.customer.findFirst({
      where: { id: customerId, organizationId: ctx.orgId },
      include: { appointments: { select: { startsAt: true, endsAt: true, serviceName: true, status: true, createdAt: true, cancelledAt: true } }, consents: { select: { type: true, granted: true, text: true, textVersion: true, createdAt: true } }, whatsappMessages: { select: { templateName: true, status: true, sentAt: true, deliveredAt: true, readAt: true } } },
    });
    if (!data) return new Response("Not found", { status: 404 });
  } else {
    const where = { organizationId: ctx.orgId };
    data = {
      organization: await db.organization.findUnique({ where: { id: ctx.orgId }, include: { settings: true, subscription: true } }),
      services: await db.service.findMany({ where }),
      professionals: await db.professional.findMany({ where, include: { schedules: true } }),
      businessHours: await db.businessHours.findMany({ where }),
      timeOff: await db.timeOff.findMany({ where }),
      customers: await db.customer.findMany({ where }),
      appointments: await db.appointment.findMany({ where, omit: { manageTokenHash: true, manageTokenEnc: true } }),
      consents: await db.consentRecord.findMany({ where }),
      reminders: await db.reminderJob.findMany({ where }),
      exportedAt: new Date().toISOString(),
    };
  }
  await audit({ organizationId: ctx.orgId, actorUserId: ctx.user.id, action: customerId ? "customer.exported" : "org.exported", entityId: customerId ?? undefined });
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="export-${customerId ?? ctx.org.slug}.json"`, "Cache-Control": "no-store" },
  });
}
