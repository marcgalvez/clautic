import { requireSuperAdmin } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n";
import { env, googleConfigured, whatsappMode } from "@/lib/env";
import { db } from "@/lib/db";
import { Badge, Card, PageHeader } from "@/components/ui";

export default async function Platform() {
  const user = await requireSuperAdmin();
  const { t } = await getT(user.locale);
  const e = env();
  const wa = whatsappMode();
  const [pendingSync, pendingRem, lastTick] = await Promise.all([
    db.calendarSyncJob.count({ where: { status: "PENDING" } }),
    db.reminderJob.count({ where: { status: "PENDING", scheduledFor: { lt: new Date(Date.now() - 10 * 60_000) } } }),
    db.reminderJob.findFirst({ where: { status: { not: "PENDING" } }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
  ]);
  const rows: [string, React.ReactNode][] = [
    ["APP_URL", e.APP_URL],
    ["Google OAuth", <Badge key="g" tone={googleConfigured() ? "green" : "red"}>{googleConfigured() ? "OK" : "—"}</Badge>],
    ["Google push", <Badge key="p" tone={e.APP_URL.startsWith("https") ? "green" : "amber"}>{e.APP_URL.startsWith("https") ? "HTTPS" : "només reconciliació (no HTTPS)"}</Badge>],
    ["WhatsApp", <Badge key="w" tone={wa === "meta_cloud" ? "green" : wa === "log" ? "amber" : "red"}>{wa}</Badge>],
    ["WhatsApp template", e.WHATSAPP_TEMPLATE_REMINDER],
    ["WhatsApp webhook", <Badge key="wh" tone={e.WHATSAPP_APP_SECRET && e.WHATSAPP_WEBHOOK_VERIFY_TOKEN ? "green" : "amber"}>{e.WHATSAPP_APP_SECRET && e.WHATSAPP_WEBHOOK_VERIFY_TOKEN ? "OK" : "—"}</Badge>],
    ["CRON_SECRET", <Badge key="c" tone={e.CRON_SECRET ? "green" : "amber"}>{e.CRON_SECRET ? "OK" : "—"}</Badge>],
    ["Sync Google pendents", pendingSync],
    ["Recordatoris endarrerits (>10 min)", <Badge key="r" tone={pendingRem ? "red" : "green"}>{pendingRem}</Badge>],
  ];
  return (
    <>
      <PageHeader title={t.admin.platformConfig} subtitle="Valors de les variables d'entorn (els secrets no es mostren mai)." />
      <Card className="max-w-2xl">
        <dl className="divide-y divide-stone-100">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2.5 text-sm"><dt className="text-stone-600">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
          ))}
        </dl>
        {pendingRem > 0 && <p className="mt-3 text-sm text-red-700">El treballador (npm run worker o /api/cron/tick) no s&apos;està executant. Darrera activitat: {lastTick?.updatedAt.toISOString() ?? "—"}</p>}
      </Card>
    </>
  );
}
