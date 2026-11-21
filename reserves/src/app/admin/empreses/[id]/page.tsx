import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n";
import { accessState } from "@/lib/auth/access";
import { env } from "@/lib/env";
import { fmtDateTime, fmtPrice } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { Alert, Badge, Card, PageHeader, Stat, statusTone } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { SubscriptionFields } from "@/components/admin/SubscriptionFields";
import { grantAccess, reactivateOrg, saveSubscription, suspendOrg } from "../../actions";

export default async function OrgDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ granted?: string }> }) {
  const { id } = await params;
  const { granted } = await searchParams;
  const user = await requireSuperAdmin();
  const { t, locale } = await getT(user.locale);
  const ta = t.admin;
  const o = await db.organization.findUnique({ where: { id }, include: { subscription: true, settings: true, members: { include: { user: true } }, googleConnections: true } });
  if (!o) notFound();
  const st = accessState(o, o.subscription);
  const now = DateTime.now().setZone("Europe/Madrid");
  const [month, total, sent, failed, errors, audit] = await Promise.all([
    db.appointment.count({ where: { organizationId: id, status: { not: "CANCELLED" }, startsAt: { gte: now.startOf("month").toJSDate(), lte: now.endOf("month").toJSDate() } } }),
    db.appointment.count({ where: { organizationId: id } }),
    db.reminderJob.count({ where: { organizationId: id, status: { in: ["SENT", "DELIVERED", "READ"] }, sentAt: { gte: now.minus({ days: 30 }).toJSDate() } } }),
    db.reminderJob.count({ where: { organizationId: id, status: "FAILED", updatedAt: { gte: now.minus({ days: 30 }).toJSDate() } } }),
    db.integrationErrorLog.findMany({ where: { organizationId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.auditLog.findMany({ where: { organizationId: id }, include: { actor: true }, orderBy: { createdAt: "desc" }, take: 25 }),
  ]);
  const tz = "Europe/Madrid";
  return (
    <>
      <PageHeader title={o.name} subtitle={<><Badge tone={statusTone[st]}>{ta.st[st]}</Badge>{o.statusReason && <span className="ml-2 text-stone-600">{o.statusReason}</span>}</>} actions={<a href={`${env().APP_URL}/reserves/${o.slug}`} target="_blank" className="btn-secondary">{ta.publicPage} ↗</a>} />
      {granted && <Alert tone="green">✔ {ta.granted}</Alert>}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={ta.month} value={month} />
        <Stat label={`${ta.appointments} · ${ta.total}`} value={total} />
        <Stat label={ta.remindersSent} value={sent} />
        <Stat label={ta.remindersFailed} value={failed} tone={failed ? "red" : undefined} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={st === "PENDING_APPROVAL" ? ta.grant : ta.saveSub}>
            {st === "PENDING_APPROVAL" && <p className="mb-4 text-sm text-stone-600">{ta.grantHint}</p>}
            <ActionForm action={st === "PENDING_APPROVAL" ? grantAccess : saveSubscription}>
              <input type="hidden" name="orgId" value={o.id} />
              <SubscriptionFields sub={o.subscription} t={ta} withStatus={st !== "PENDING_APPROVAL"} idPrefix="s" />
              <SubmitButton>{st === "PENDING_APPROVAL" ? `✔ ${ta.grant}` : t.common.save}</SubmitButton>
            </ActionForm>
          </Card>
          <Card title={ta.access}>
            {o.status === "SUSPENDED" ? (
              <form action={reactivateOrg}><input type="hidden" name="orgId" value={o.id} /><SubmitButton>{ta.reactivate}</SubmitButton></form>
            ) : (
              <form action={suspendOrg} className="flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="orgId" value={o.id} />
                <label htmlFor="reason" className="sr-only">{ta.suspendReason}</label>
                <input id="reason" name="reason" placeholder={ta.suspendReason} className="input" />
                <SubmitButton className="btn-danger" confirm={`${ta.suspend}?`}>{ta.suspend}</SubmitButton>
              </form>
            )}
            {st === "EXPIRED" && <p className="mt-3 text-sm text-red-700">{ta.st.EXPIRED}: {ta.endsAt}</p>}
          </Card>
          <Card title={ta.audit}>
            <ol className="space-y-2 text-sm">
              {audit.map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-2 border-b border-stone-100 pb-2">
                  <span className="font-mono text-xs">{a.action}</span>
                  <span className="text-xs text-stone-500">{a.actor?.email ?? "system"} · {fmtDateTime(a.createdAt, tz, locale)}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title={ta.owner}>
            <ul className="space-y-2 text-sm">
              {o.members.map((m) => (
                <li key={m.id}><div className="font-medium">{m.user.name} <Badge>{m.role}</Badge></div><a className="underline" href={`mailto:${m.user.email}`}>{m.user.email}</a></li>
              ))}
            </ul>
            {o.contactPhone && <p className="mt-2 text-sm">{o.contactPhone}</p>}
            <p className="mt-3 text-xs text-stone-500">{ta.registered}: {fmtDateTime(o.createdAt, tz, locale)}</p>
            {o.subscription?.amountCents != null && <p className="text-xs text-stone-500">{ta.amount}: {fmtPrice(o.subscription.amountCents, locale)}</p>}
          </Card>
          <Card title="Google Calendar">
            {o.googleConnections.length ? o.googleConnections.map((c) => <div key={c.id} className="text-sm">{c.googleEmail} <Badge tone={c.status === "ACTIVE" ? "green" : "red"}>{c.status}</Badge></div>) : <p className="text-sm text-stone-500">—</p>}
          </Card>
          <Card title={t.admin.nav.errors}>
            <ul className="space-y-2 text-xs">
              {errors.map((e) => <li key={e.id}><Badge tone="red">{e.integration}</Badge> {e.operation}: {e.message}<div className="text-stone-500">{fmtDateTime(e.createdAt, tz, locale)}</div></li>)}
              {!errors.length && <li className="text-stone-500">—</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
