import Link from "next/link";
import { DateTime } from "luxon";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n";
import { fmtDateTime } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { Card, Empty, PageHeader, Stat } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { SubscriptionFields } from "@/components/admin/SubscriptionFields";
import { grantAccess, suspendOrg } from "./actions";

export default async function AdminHome() {
  const user = await requireSuperAdmin();
  const { t, locale } = await getT(user.locale);
  const ta = t.admin;
  const now = DateTime.now().setZone("Europe/Madrid");
  const [pending, active, total, apptMonth, apptTotal, sent30, failed30, errors24, expiring] = await Promise.all([
    db.organization.findMany({ where: { status: "PENDING_APPROVAL" }, include: { members: { where: { role: "OWNER" }, include: { user: true } }, subscription: true, _count: { select: { services: true } } }, orderBy: { createdAt: "asc" } }),
    db.organization.count({ where: { status: "ACTIVE" } }),
    db.organization.count(),
    db.appointment.count({ where: { status: { not: "CANCELLED" }, startsAt: { gte: now.startOf("month").toJSDate(), lte: now.endOf("month").toJSDate() } } }),
    db.appointment.count({ where: { status: { not: "CANCELLED" } } }),
    db.reminderJob.count({ where: { status: { in: ["SENT", "DELIVERED", "READ"] }, sentAt: { gte: now.minus({ days: 30 }).toJSDate() } } }),
    db.reminderJob.count({ where: { status: "FAILED", updatedAt: { gte: now.minus({ days: 30 }).toJSDate() } } }),
    db.integrationErrorLog.count({ where: { createdAt: { gte: now.minus({ hours: 24 }).toJSDate() } } }),
    db.subscription.findMany({ where: { endsAt: { gte: new Date(), lte: now.plus({ days: 30 }).toJSDate() }, organization: { status: "ACTIVE" } }, include: { organization: true }, orderBy: { endsAt: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title={ta.title} />
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={ta.activeOrgs} value={`${active} / ${total}`} href="/admin/empreses?status=ACTIVE" />
        <Stat label={`${ta.appointments} · ${ta.month}`} value={apptMonth} />
        <Stat label={ta.remindersSent} value={sent30} href="/admin/recordatoris" />
        <Stat label={ta.integrationErrors} value={errors24} tone={errors24 ? "red" : undefined} href="/admin/errors" />
      </div>

      <h2 className="mb-3 text-lg font-semibold">{ta.pendingApprovals} ({pending.length})</h2>
      {!pending.length ? (
        <Empty>{ta.noPending}</Empty>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {pending.map((o) => {
            const owner = o.members[0]?.user;
            return (
              <Card key={o.id} title={<Link href={`/admin/empreses/${o.id}`} className="hover:underline">{o.name}</Link>}>
                <dl className="mb-4 grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-stone-500">{ta.registered}</dt><dd>{fmtDateTime(o.createdAt, "Europe/Madrid", locale)}</dd></div>
                  <div><dt className="text-stone-500">{ta.owner}</dt><dd>{owner?.name}<br /><a className="underline" href={`mailto:${o.contactEmail}`}>{o.contactEmail}</a>{o.contactPhone && <><br />{o.contactPhone}</>}</dd></div>
                  <div><dt className="text-stone-500">URL</dt><dd>/reserves/{o.slug}</dd></div>
                  <div><dt className="text-stone-500">{t.dash.nav.services}</dt><dd>{o._count.services}</dd></div>
                </dl>
                <p className="mb-3 text-xs text-stone-500">{ta.grantHint}</p>
                <ActionForm action={grantAccess}>
                  <input type="hidden" name="orgId" value={o.id} />
                  <SubscriptionFields sub={o.subscription} t={ta} withStatus={false} idPrefix={o.id} />
                  <div className="flex flex-wrap gap-2">
                    <SubmitButton>✔ {ta.grant}</SubmitButton>
                  </div>
                </ActionForm>
                <form action={suspendOrg} className="mt-3 flex gap-2 border-t border-stone-100 pt-3">
                  <input type="hidden" name="orgId" value={o.id} />
                  <label htmlFor={`r-${o.id}`} className="sr-only">{ta.suspendReason}</label>
                  <input id={`r-${o.id}`} name="reason" placeholder={ta.suspendReason} className="input" />
                  <SubmitButton className="btn-danger">{ta.reject}</SubmitButton>
                </form>
              </Card>
            );
          })}
        </div>
      )}

      {expiring.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-lg font-semibold">{ta.expiringSoon}</h2>
          <ul className="card divide-y divide-stone-100 p-0">
            {expiring.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/empreses/${s.organizationId}`} className="flex justify-between px-4 py-3 text-sm hover:bg-stone-50">
                  <span className="font-medium">{s.organization.name}</span>
                  <span>{fmtDateTime(s.endsAt!, "Europe/Madrid", locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-8 text-sm text-stone-500">{ta.total} {ta.appointments.toLowerCase()}: {apptTotal} · {ta.remindersFailed}: {failed30}</p>
    </>
  );
}
