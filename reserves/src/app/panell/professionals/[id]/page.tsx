import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgAdmin } from "@/lib/auth/guards";
import { fmt, getT } from "@/lib/i18n";
import { ActionForm } from "@/components/ActionForm";
import { Card, Checkbox, Field, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { WeeklyFields } from "@/components/WeeklyFields";
import { listCalendarsFor } from "@/lib/google/calendars";
import { createProfessionalAccess, saveProfessional } from "../../actions";

export default async function ProfessionalForm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrgAdmin();
  const { t } = await getT(ctx.user.locale);
  const tp = t.dash.pros;
  const p = id === "nou" ? null : await db.professional.findFirst({ where: { id, organizationId: ctx.orgId }, include: { services: true, schedules: true, member: { include: { user: true } } } });
  if (id !== "nou" && !p) notFound();
  const [services, calendars] = await Promise.all([db.service.findMany({ where: { organizationId: ctx.orgId }, orderBy: { name: "asc" } }), listCalendarsFor(ctx.orgId)]);
  const svc = new Set(p ? p.services.map((s) => s.serviceId) : services.map((s) => s.id));
  const currentCal = p?.googleConnectionId && p.googleCalendarId ? `${p.googleConnectionId}|${p.googleCalendarId}` : "";
  return (
    <>
      <PageHeader title={p ? p.name : tp.new} />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <ActionForm action={saveProfessional}>
            {p && <input type="hidden" name="id" value={p.id} />}
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <Field label={t.common.name} htmlFor="name">
                <input id="name" name="name" required maxLength={80} defaultValue={p?.name} className="input" />
              </Field>
              <Field label={tp.color} htmlFor="color">
                <input id="color" name="color" type="color" defaultValue={p?.color ?? "#0f766e"} className="input h-11 p-1" />
              </Field>
            </div>
            <Field label={`${t.common.email} (${t.common.optional})`} htmlFor="email">
              <input id="email" name="email" type="email" defaultValue={p?.email ?? ""} className="input" />
            </Field>
            <fieldset>
              <legend className="label">{tp.services}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {services.map((s) => (
                  <Checkbox key={s.id} name="serviceIds" value={s.id} defaultChecked={svc.has(s.id)} label={s.name} />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="label">{tp.schedule}</legend>
              <p className="mb-2 text-xs text-stone-500">{tp.scheduleHint}</p>
              <WeeklyFields prefix="sch" ranges={p?.schedules ?? []} weekdays={t.common.weekdays} offLabel="" />
            </fieldset>
            <Field label={tp.calendar} htmlFor="calendar">
              <select id="calendar" name="calendar" defaultValue={currentCal} className="input">
                <option value="">{tp.noCalendar}</option>
                {calendars.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
                {currentCal && !calendars.some((c) => c.value === currentCal) && <option value={currentCal}>{p?.googleCalendarId}</option>}
              </select>
            </Field>
            <Checkbox name="canManage" defaultChecked={p?.canManageAvailability ?? false} label={tp.canManage} />
            <Checkbox name="active" defaultChecked={p?.active ?? true} label={t.common.active} />
            <input type="hidden" name="sortOrder" value={p?.sortOrder ?? 0} />
            <SubmitButton>{t.common.save}</SubmitButton>
          </ActionForm>
        </Card>
        {p && (
          <Card title={tp.access}>
            {p.member ? (
              <p className="text-sm">{fmt(tp.hasAccess, { email: p.member.user.email })}</p>
            ) : (
              <ActionForm action={createProfessionalAccess}>
                <p className="text-sm text-stone-600">{tp.accessHint}</p>
                <input type="hidden" name="professionalId" value={p.id} />
                <Field label={t.common.email} htmlFor="acc-email">
                  <input id="acc-email" name="email" type="email" required defaultValue={p.email ?? ""} className="input" />
                </Field>
                <Field label={t.auth.password} htmlFor="acc-pw" hint={t.auth.passwordHint}>
                  <input id="acc-pw" name="password" type="text" required minLength={10} autoComplete="off" className="input" />
                </Field>
                <SubmitButton className="btn-secondary">{tp.createAccess}</SubmitButton>
              </ActionForm>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
