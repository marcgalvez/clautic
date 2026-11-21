import { db } from "@/lib/db";
import { requireOrgAdmin } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n";
import { env, googleConfigured, whatsappMode } from "@/lib/env";
import { listCalendarsFor } from "@/lib/google/calendars";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { assignCalendar, disconnectGoogle } from "../actions";

export default async function Integrations({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireOrgAdmin();
  const { t } = await getT(ctx.user.locale);
  const ti = t.dash.integrations;
  const [conns, pros, calendars] = await Promise.all([
    db.googleCalendarConnection.findMany({ where: { organizationId: ctx.orgId }, orderBy: { createdAt: "asc" } }),
    db.professional.findMany({ where: { organizationId: ctx.orgId, active: true }, orderBy: { sortOrder: "asc" } }),
    listCalendarsFor(ctx.orgId),
  ]);
  const wa = whatsappMode();
  return (
    <>
      <PageHeader title={ti.title} />
      {sp.google === "ok" && <Alert tone="green">{ti.connectedOk}</Alert>}
      {sp.google === "error" && <Alert tone="red">{ti.connectError}</Alert>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="📅 Google Calendar">
          <p className="mb-4 text-sm text-stone-600">{ti.googleIntro}</p>
          {!googleConfigured() ? (
            <Alert tone="amber">{ti.notConfigured}</Alert>
          ) : (
            <>
              <ul className="mb-4 space-y-2">
                {conns.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{c.googleEmail}</div>
                      <Badge tone={c.status === "ACTIVE" ? "green" : "red"}>{c.status === "ACTIVE" ? t.dash.home.connected : c.status === "REVOKED" ? ti.revoked : t.dash.home.connectionError}</Badge>
                      {c.lastError && c.status !== "ACTIVE" && <p className="mt-1 text-xs text-red-700">{c.lastError}</p>}
                    </div>
                    <form action={disconnectGoogle}><input type="hidden" name="id" value={c.id} /><SubmitButton className="btn-ghost text-red-700">{ti.disconnect}</SubmitButton></form>
                  </li>
                ))}
              </ul>
              <a href="/api/google/oauth/start" className="btn-primary">{conns.length ? ti.connectAnother : ti.connect}</a>
            </>
          )}
          {calendars.length > 0 && (
            <div className="mt-6 border-t border-stone-100 pt-4">
              <h3 className="mb-3 text-sm font-semibold">{ti.assign}</h3>
              <ul className="space-y-3">
                {pros.map((p) => (
                  <li key={p.id}>
                    <form action={assignCalendar} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input type="hidden" name="professionalId" value={p.id} />
                      <label htmlFor={`cal-${p.id}`} className="w-32 shrink-0 text-sm font-medium">{p.name}</label>
                      <select id={`cal-${p.id}`} name="calendar" defaultValue={p.googleConnectionId && p.googleCalendarId ? `${p.googleConnectionId}|${p.googleCalendarId}` : ""} className="input">
                        <option value="">{t.dash.pros.noCalendar}</option>
                        {calendars.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                      <SubmitButton className="btn-secondary">{t.common.save}</SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
        <Card title="💬 WhatsApp">
          <p className="mb-4 text-sm text-stone-600">{ti.whatsappIntro}</p>
          <Badge tone={wa === "meta_cloud" ? "green" : wa === "log" ? "amber" : "red"}>{wa === "meta_cloud" ? t.dash.home.waReal : wa === "log" ? t.dash.home.waLog : t.dash.home.waNone}</Badge>
          {wa === "meta_cloud" && env().WHATSAPP_DISPLAY_PHONE && <p className="mt-3 text-sm">{ti.sender}: <strong>{env().WHATSAPP_DISPLAY_PHONE}</strong></p>}
        </Card>
      </div>
    </>
  );
}
