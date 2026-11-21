import { db } from "../db";
import { processDueReminders } from "../whatsapp/reminders";
import { processCalendarSyncJobs } from "../google/sync";
import { ensureWatches } from "../google/watch";

let lastHourly = 0;

/**
 * Una "passada" del treballador. Idempotent i segura amb diverses instàncies
 * (les cues usen FOR UPDATE SKIP LOCKED). Cal executar-la cada minut.
 */
export async function tick(now = new Date()) {
  const reminders = await processDueReminders(now);
  const sync = await processCalendarSyncJobs(50);
  let hourly: Record<string, unknown> | null = null;
  if (now.getTime() - lastHourly > 3600_000) {
    lastHourly = now.getTime();
    hourly = await maintenance(now);
  }
  return { reminders, sync, hourly };
}

/** Tasques horàries: canals push, memòria cau caducada, neteja i retenció de dades. */
export async function maintenance(now = new Date()) {
  const watches = await ensureWatches();
  await db.calendarBusyCache.updateMany({ where: { fetchedAt: { lt: new Date(now.getTime() - 15 * 60_000) } }, data: { stale: true } });
  await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await db.rateLimitBucket.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 86400_000) } } });
  await db.googleCalendarWatch.deleteMany({ where: { expiresAt: { lt: now } } });
  const anonymized = await applyRetention(now);
  return { watches, anonymized };
}

/** RGPD: anonimitza clients sense cites durant més temps del configurat. */
export async function applyRetention(now = new Date()) {
  const orgs = await db.organizationSettings.findMany({ select: { organizationId: true, dataRetentionMonths: true } });
  let n = 0;
  for (const o of orgs) {
    const cutoff = new Date(now.getTime() - o.dataRetentionMonths * 30 * 86400_000);
    const stale = await db.customer.findMany({
      where: { organizationId: o.organizationId, NOT: { phoneE164: { startsWith: "deleted:" } }, updatedAt: { lt: cutoff }, appointments: { none: { startsAt: { gte: cutoff } } } },
      select: { id: true },
      take: 500,
    });
    for (const c of stale) {
      await db.customer.update({ where: { id: c.id }, data: { firstName: "—", lastName: "", phoneE164: `deleted:${c.id}`, email: null, whatsappConsent: false } });
      await db.whatsAppMessage.updateMany({ where: { customerId: c.id }, data: { toPhone: "deleted", variables: {} } });
      n++;
    }
  }
  return n;
}
