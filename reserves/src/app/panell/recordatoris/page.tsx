import { db } from "@/lib/db";
import { requireOrgAdmin } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n";
import { env, whatsappMode } from "@/lib/env";
import { fmtDateTime } from "@/lib/format";
import { renderReminderPreview } from "@/lib/whatsapp/template";
import { Alert, Badge, Card, Empty, PageHeader, statusTone } from "@/components/ui";
import Link from "next/link";

export default async function Reminders() {
  const ctx = await requireOrgAdmin();
  const { t, locale } = await getT(ctx.user.locale);
  const tr = t.dash.reminders;
  const s = await db.organizationSettings.findUniqueOrThrow({ where: { organizationId: ctx.orgId } });
  const jobs = await db.reminderJob.findMany({ where: { organizationId: ctx.orgId }, include: { appointment: { include: { customer: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { scheduledFor: "desc" }, take: 100 });
  const mode = whatsappMode();
  const preview = renderReminderPreview(["Laura", ctx.org.name, locale === "es" ? "Martes 24 de noviembre" : "Dimarts 24 de novembre", "16:30", "Tall de cabell"], `${env().APP_URL}/cita/…`, locale);
  return (
    <>
      <PageHeader title={tr.title} />
      {mode === "log" && <Alert tone="amber">{tr.testMode}</Alert>}
      {mode === "none" && <Alert tone="red">{tr.notConfigured}</Alert>}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!jobs.length ? (
            <Empty>{tr.empty}</Empty>
          ) : (
            <div className="card overflow-x-auto p-0">
              <table className="table">
                <thead><tr><th>{t.dash.appt.customer}</th><th>{t.dash.appt.start}</th><th>{tr.scheduled}</th><th>{t.common.status}</th></tr></thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id}>
                      <td><Link className="underline" href={`/panell/cites/${j.appointmentId}`}>{j.appointment.customer.firstName} {j.appointment.customer.lastName}</Link></td>
                      <td className="whitespace-nowrap">{fmtDateTime(j.appointmentStartsAt, s.timezone, locale)}</td>
                      <td className="whitespace-nowrap">{fmtDateTime(j.scheduledFor, s.timezone, locale)}</td>
                      <td>
                        <Badge tone={statusTone[j.status]}>{tr.st[j.status]}</Badge>
                        {j.skipReason && <div className="mt-1 text-xs text-stone-500">{tr.reasons[j.skipReason as keyof typeof tr.reasons] ?? j.skipReason}</div>}
                        {j.lastError && <div className="mt-1 max-w-xs text-xs text-red-700">{j.lastError}</div>}
                        {j.messages[0]?.provider === "log" && <div className="mt-1 text-xs text-amber-700">log</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <Card title={tr.preview}>
          <div className="rounded-2xl rounded-tl-none bg-[#dcf8c6] p-3 text-sm whitespace-pre-line text-stone-900 shadow-sm">{preview}</div>
          <p className="mt-3 text-xs text-stone-500">{s.remindersEnabled ? `${s.reminderHoursBefore} h` : t.common.inactive}</p>
        </Card>
      </div>
    </>
  );
}
