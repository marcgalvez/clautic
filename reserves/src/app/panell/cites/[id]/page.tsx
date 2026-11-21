import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { appointmentScope, isOrgAdmin, requireOrg } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n";
import { dt, fmtDateTime } from "@/lib/format";
import { maskPhone } from "@/lib/phone";
import { Badge, Card, PageHeader, statusTone } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { AppointmentForm } from "@/components/AppointmentForm";
import { cancelAction, rescheduleAction, retrySyncAction, statusAction } from "../../actions";

export default async function AppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrg();
  const { t, locale } = await getT(ctx.user.locale);
  const ta = t.dash.appt;
  const a = await db.appointment.findFirst({
    where: { id, ...appointmentScope(ctx) },
    include: { customer: true, professional: true, service: { include: { professionals: true } }, reminderJobs: { orderBy: { createdAt: "desc" }, include: { messages: true } }, events: { orderBy: { createdAt: "desc" } } },
  });
  if (!a) notFound();
  const s = await db.organizationSettings.findUniqueOrThrow({ where: { organizationId: ctx.orgId } });
  const tz = s.timezone;
  const admin = isOrgAdmin(ctx);
  const activeAppt = a.status === "CONFIRMED" || a.status === "PENDING";
  const pros = admin ? await db.professional.findMany({ where: { organizationId: ctx.orgId, active: true, services: { some: { serviceId: a.serviceId } } } }) : [];
  const reminder = a.reminderJobs[0];
  const rows: [string, React.ReactNode][] = [
    [ta.customer, <>{a.customer.firstName} {a.customer.lastName}<br /><a className="text-accent underline" href={`tel:${a.customer.phoneE164}`}>{a.customer.phoneE164.startsWith("deleted") ? "—" : maskPhone(a.customer.phoneE164)}</a>{a.customer.email && <><br />{a.customer.email}</>}</>],
    [ta.service, `${a.serviceName} · ${a.durationMinutes} ${t.common.minutes}`],
    [ta.professional, a.professional.name],
    [ta.source, a.source === "PUBLIC" ? ta.sourcePUBLIC : ta.sourceDASHBOARD],
    [ta.consent, a.customer.whatsappConsent ? "✔" : "✕"],
  ];
  return (
    <>
      <PageHeader title={`${fmtDateTime(a.startsAt, tz, locale)}`} subtitle={<Badge tone={statusTone[a.status]}>{ta.st[a.status]}</Badge>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <dl className="grid gap-3 sm:grid-cols-2">
              {rows.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-medium tracking-wide text-stone-500 uppercase">{k}</dt>
                  <dd className="mt-0.5 text-sm">{v}</dd>
                </div>
              ))}
            </dl>
            {a.internalNote && <p className="mt-4 rounded-lg bg-stone-50 p-3 text-sm">{a.internalNote}</p>}
            {admin && activeAppt && (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-stone-100 pt-4">
                <form action={statusAction}><input type="hidden" name="id" value={a.id} /><SubmitButton className="btn-secondary" name="status" value="COMPLETED">✔ {ta.markDone}</SubmitButton></form>
                <form action={statusAction}><input type="hidden" name="id" value={a.id} /><SubmitButton className="btn-secondary" name="status" value="NO_SHOW">{ta.markNoShow}</SubmitButton></form>
              </div>
            )}
          </Card>
          {admin && activeAppt && (
            <Card title={ta.reschedule}>
              <AppointmentForm
                action={rescheduleAction}
                mode="reschedule"
                appointmentId={a.id}
                services={[{ id: a.serviceId, name: a.serviceName }]}
                professionals={pros.map((p) => ({ id: p.id, name: p.name }))}
                defaults={{ serviceId: a.serviceId, professionalId: a.professionalId, date: dt(a.startsAt, tz, locale).toISODate()!, time: dt(a.startsAt, tz, locale).toFormat("HH:mm") }}
                locale={locale}
                weekdaysShort={t.common.weekdaysShort}
                L={{ service: ta.service, professional: ta.professional, any: "", pickSlot: ta.pickSlot, noSlots: t.booking.noSlots, loading: t.booking.loading, noDays: t.booking.noDays, date: t.common.date, time: t.common.time, ignoreRules: ta.ignoreRules, submit: t.common.save }}
              />
            </Card>
          )}
          {admin && activeAppt && (
            <Card title={ta.cancelAppt}>
              <form action={cancelAction} className="space-y-3">
                <input type="hidden" name="id" value={a.id} />
                <label className="label" htmlFor="reason">{ta.cancelReason}</label>
                <input id="reason" name="reason" maxLength={300} className="input" />
                <SubmitButton className="btn-danger" confirm={t.manage.cancelConfirm}>{ta.cancelAppt}</SubmitButton>
              </form>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card title={ta.googleSync}>
            <Badge tone={statusTone[a.googleSyncStatus]}>{ta.sync[a.googleSyncStatus]}</Badge>
            {a.googleSyncError && <p className="mt-2 text-xs text-red-700">{a.googleSyncError}</p>}
            {admin && a.googleSyncStatus === "FAILED" && (
              <form action={retrySyncAction} className="mt-3"><input type="hidden" name="id" value={a.id} /><SubmitButton className="btn-secondary">↻ {ta.retrySync}</SubmitButton></form>
            )}
          </Card>
          <Card title={ta.reminder}>
            {reminder ? (
              <div className="space-y-1 text-sm">
                <Badge tone={statusTone[reminder.status]}>{t.dash.reminders.st[reminder.status]}</Badge>
                <p className="text-stone-600">{t.dash.reminders.scheduled}: {fmtDateTime(reminder.scheduledFor, tz, locale)}</p>
                {reminder.skipReason && <p className="text-stone-500">{t.dash.reminders.reasons[reminder.skipReason as keyof typeof t.dash.reminders.reasons] ?? reminder.skipReason}</p>}
                {reminder.lastError && <p className="text-xs text-red-700">{reminder.lastError}</p>}
              </div>
            ) : (
              <p className="text-sm text-stone-500">—</p>
            )}
          </Card>
          <Card title={ta.history}>
            <ol className="space-y-2 text-sm">
              {a.events.map((e) => (
                <li key={e.id} className="border-l-2 border-stone-200 pl-3">
                  <div className="font-medium">{e.type}</div>
                  <div className="text-xs text-stone-500">{fmtDateTime(e.createdAt, tz, locale)} · {e.actorType}</div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
