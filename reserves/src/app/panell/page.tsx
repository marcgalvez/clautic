import Link from "next/link";
import { DateTime } from "luxon";
import { db } from "@/lib/db";
import { appointmentScope, isOrgAdmin, requireOrg } from "@/lib/auth/guards";
import { fmt, getT } from "@/lib/i18n";
import { env, googleConfigured, whatsappMode } from "@/lib/env";
import { Alert, Badge, Card, PageHeader, Stat } from "@/components/ui";
import { ApptList } from "@/components/ApptList";
import { CopyButton } from "@/components/CopyButton";
import { ucfirst } from "@/lib/format";

export default async function Home() {
  const ctx = await requireOrg();
  const { t, locale } = await getT(ctx.user.locale);
  const h = t.dash.home;
  const settings = await db.organizationSettings.findUniqueOrThrow({ where: { organizationId: ctx.orgId } });
  const tz = settings.timezone;
  const now = DateTime.now().setZone(tz);
  const scope = appointmentScope(ctx);
  const active = { in: ["PENDING", "CONFIRMED", "COMPLETED", "NO_SHOW"] as ("PENDING" | "CONFIRMED" | "COMPLETED" | "NO_SHOW")[] };
  const inc = { customer: true, professional: true } as const;
  const day = (d: DateTime) => ({ gte: d.startOf("day").toJSDate(), lte: d.endOf("day").toJSDate() });

  const [today, tomorrow, upcoming, pending, cancels, month, conns, sent7, failed7, syncFailed, svcCount, assigned] = await Promise.all([
    db.appointment.findMany({ where: { ...scope, status: active, startsAt: day(now) }, include: inc, orderBy: { startsAt: "asc" } }),
    db.appointment.findMany({ where: { ...scope, status: active, startsAt: day(now.plus({ days: 1 })) }, include: inc, orderBy: { startsAt: "asc" } }),
    db.appointment.findMany({ where: { ...scope, status: { in: ["PENDING", "CONFIRMED"] }, startsAt: { gt: now.plus({ days: 1 }).endOf("day").toJSDate() } }, include: inc, orderBy: { startsAt: "asc" }, take: 8 }),
    db.appointment.count({ where: { ...scope, status: "PENDING", startsAt: { gte: new Date() } } }),
    db.appointment.count({ where: { ...scope, status: "CANCELLED", cancelledAt: { gte: now.minus({ days: 7 }).toJSDate() } } }),
    db.appointment.count({ where: { ...scope, status: { not: "CANCELLED" }, startsAt: { gte: now.startOf("month").toJSDate(), lte: now.endOf("month").toJSDate() } } }),
    db.googleCalendarConnection.findMany({ where: { organizationId: ctx.orgId } }),
    db.reminderJob.count({ where: { organizationId: ctx.orgId, status: { in: ["SENT", "DELIVERED", "READ"] }, sentAt: { gte: now.minus({ days: 7 }).toJSDate() } } }),
    db.reminderJob.count({ where: { organizationId: ctx.orgId, status: "FAILED", updatedAt: { gte: now.minus({ days: 7 }).toJSDate() } } }),
    db.appointment.count({ where: { ...scope, googleSyncStatus: "FAILED", status: { not: "CANCELLED" } } }),
    db.service.count({ where: { organizationId: ctx.orgId, active: true } }),
    db.professionalService.count({ where: { organizationId: ctx.orgId } }),
  ]);

  const link = `${env().APP_URL}/reserves/${ctx.org.slug}`;
  const gStatus = conns.some((c) => c.status === "ACTIVE") ? "ok" : conns.length ? "error" : "none";
  const wa = whatsappMode();
  const admin = isOrgAdmin(ctx);
  const checklist = [
    { done: svcCount > 0, label: h.ckServices, href: "/panell/serveis" },
    { done: true, label: h.ckHours, href: "/panell/configuracio#horari" },
    { done: assigned > 0, label: h.ckPros, href: "/panell/professionals" },
    { done: gStatus === "ok", label: h.ckGoogle, href: "/panell/integracions" },
    { done: month > 0, label: h.ckShare, href: link },
  ];

  return (
    <>
      <PageHeader title={fmt(h.title, { name: ctx.user.name.split(" ")[0] })} subtitle={ucfirst(now.setLocale(locale).toFormat("cccc d 'de' LLLL"))} actions={<Link href="/panell/cites/nova" className="btn-primary">+ {t.dash.cal.newAppt}</Link>} />
      {syncFailed > 0 && (
        <Alert tone="red">
          {fmt(h.syncFailed, { n: syncFailed })} <Link href="/panell/calendari" className="underline">{t.dash.nav.calendar}</Link>
        </Alert>
      )}
      {admin && (
        <Card className="mb-6" title={h.bookingLink}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-stone-100 px-3 py-2.5 text-sm">{link}</code>
            <CopyButton text={link} label={h.copy} done={h.copied} />
            <a href={link} target="_blank" className="btn-secondary">↗</a>
          </div>
        </Card>
      )}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={h.today} value={today.length} href="/panell/calendari?view=day" />
        <Stat label={h.monthCount} value={month} href="/panell/calendari?view=month" />
        <Stat label={h.pending} value={pending} />
        <Stat label={h.cancellations} value={cancels} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={h.today}>
            <ApptList items={today} tz={tz} t={t} locale={locale} />
          </Card>
          <Card title={h.tomorrow}>
            <ApptList items={tomorrow} tz={tz} t={t} locale={locale} />
          </Card>
          <Card title={h.upcoming}>
            <ApptList items={upcoming} tz={tz} t={t} locale={locale} showDate />
          </Card>
        </div>
        <div className="space-y-6">
          <Card title={h.google}>
            <div className="flex items-center justify-between">
              <Badge tone={gStatus === "ok" ? "green" : gStatus === "error" ? "red" : "gray"}>{gStatus === "ok" ? h.connected : gStatus === "error" ? h.connectionError : h.notConnected}</Badge>
              {admin && googleConfigured() && <Link href="/panell/integracions" className="text-sm text-accent underline">{t.dash.nav.integrations}</Link>}
            </div>
          </Card>
          <Card title={h.whatsapp}>
            <Badge tone={wa === "meta_cloud" ? "green" : wa === "log" ? "amber" : "red"}>{wa === "meta_cloud" ? h.waReal : wa === "log" ? h.waLog : h.waNone}</Badge>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-stone-500">{h.remindersSent7}</dt><dd className="text-xl font-semibold">{sent7}</dd></div>
              <div><dt className="text-stone-500">{h.remindersFailed7}</dt><dd className={`text-xl font-semibold ${failed7 ? "text-red-700" : ""}`}>{failed7}</dd></div>
            </dl>
          </Card>
          {admin && (
            <Card title={h.checklist}>
              <ul className="space-y-2 text-sm">
                {checklist.map((c) => (
                  <li key={c.label}>
                    <Link href={c.href} className="flex items-center gap-2 hover:underline">
                      <span aria-hidden className={c.done ? "text-emerald-600" : "text-stone-400"}>{c.done ? "✔" : "○"}</span>
                      <span className={c.done ? "text-stone-500 line-through" : ""}>{c.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
