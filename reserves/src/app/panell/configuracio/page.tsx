import { db } from "@/lib/db";
import { requireOrgAdmin } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n";
import { ActionForm } from "@/components/ActionForm";
import { Card, Checkbox, Field, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { WeeklyFields } from "@/components/WeeklyFields";
import { saveSettings } from "../actions";

const TIMEZONES = ["Europe/Madrid", "Atlantic/Canary", "Europe/Andorra", "Europe/Lisbon", "Europe/Paris", "Europe/London"];

export default async function Settings() {
  const ctx = await requireOrgAdmin();
  const { t } = await getT(ctx.user.locale);
  const ts = t.dash.settings;
  const [s, hours] = await Promise.all([db.organizationSettings.findUniqueOrThrow({ where: { organizationId: ctx.orgId } }), db.businessHours.findMany({ where: { organizationId: ctx.orgId } })]);
  const Num = ({ name, label, value, min, max }: { name: string; label: string; value: number; min: number; max: number }) => (
    <Field label={label} htmlFor={name}>
      <input id={name} name={name} type="number" min={min} max={max} defaultValue={value} className="input" />
    </Field>
  );
  const Sel = ({ name, label, value, opts }: { name: string; label: string; value: string; opts: Record<string, string> }) => (
    <Field label={label} htmlFor={name}>
      <select id={name} name={name} defaultValue={value} className="input">
        {Object.entries(opts).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    </Field>
  );
  return (
    <>
      <PageHeader title={ts.title} />
      <ActionForm action={saveSettings} className="max-w-3xl space-y-6">
        <Card title={ts.general}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.auth.businessName} htmlFor="name">
              <input id="name" name="name" defaultValue={ctx.org.name} required className="input" />
            </Field>
            <Field label={t.common.phone} htmlFor="phone">
              <input id="phone" name="phone" type="tel" defaultValue={s.phone ?? ""} className="input" />
            </Field>
            <Field label={ts.address} htmlFor="address">
              <input id="address" name="address" defaultValue={s.address ?? ""} className="input" />
            </Field>
            <Field label={ts.logoUrl} htmlFor="logoUrl">
              <input id="logoUrl" name="logoUrl" type="url" defaultValue={s.logoUrl ?? ""} placeholder="https://…" className="input" />
            </Field>
            <Sel name="timezone" label={ts.timezone} value={s.timezone} opts={Object.fromEntries(TIMEZONES.map((z) => [z, z]))} />
            <Sel name="defaultLocale" label={ts.locale} value={s.defaultLocale} opts={{ ca: "Català", es: "Castellano" }} />
            <Field label={ts.accent} htmlFor="accentColor">
              <input id="accentColor" name="accentColor" type="color" defaultValue={s.accentColor} className="input h-11 p-1" />
            </Field>
          </div>
        </Card>
        <Card title={<span id="horari">{ts.hours}</span>}>
          <WeeklyFields prefix="bh" ranges={hours} weekdays={t.common.weekdays} offLabel={t.dash.pros.dayOff} />
        </Card>
        <Card title={ts.booking}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Num name="minNoticeMinutes" label={ts.minNotice} value={s.minNoticeMinutes} min={0} max={43200} />
            <Num name="maxAdvanceDays" label={ts.maxAdvance} value={s.maxAdvanceDays} min={1} max={365} />
            <Num name="slotStepMinutes" label={ts.step} value={s.slotStepMinutes} min={5} max={120} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Sel name="emailRequirement" label={ts.emailReq} value={s.emailRequirement} opts={ts.emailReqOpts} />
            <Num name="cancelDeadlineHours" label={ts.deadline} value={s.cancelDeadlineHours} min={0} max={720} />
          </div>
          <div className="mt-4 space-y-3">
            <Checkbox name="allowCustomerCancel" defaultChecked={s.allowCustomerCancel} label={ts.allowCancel} />
            <Checkbox name="allowCustomerReschedule" defaultChecked={s.allowCustomerReschedule} label={ts.allowReschedule} />
          </div>
          <div className="mt-4 space-y-4">
            <Field label={ts.cancelPolicy} htmlFor="cancellationPolicy">
              <textarea id="cancellationPolicy" name="cancellationPolicy" rows={2} maxLength={2000} defaultValue={s.cancellationPolicy ?? ""} className="input" />
            </Field>
            <Field label={ts.terms} htmlFor="bookingTerms">
              <textarea id="bookingTerms" name="bookingTerms" rows={2} maxLength={4000} defaultValue={s.bookingTerms ?? ""} className="input" />
            </Field>
          </div>
        </Card>
        <Card title={ts.reminders}>
          <Checkbox name="remindersEnabled" defaultChecked={s.remindersEnabled} label={ts.remindersEnabled} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Num name="reminderHoursBefore" label={ts.hoursBefore} value={s.reminderHoursBefore} min={1} max={72} />
            <Sel name="shortNoticePolicy" label={ts.shortNotice} value={s.shortNoticePolicy} opts={ts.shortNoticeOpts} />
            <Sel name="googleCancelMode" label={ts.googleCancel} value={s.googleCancelMode} opts={ts.googleCancelOpts} />
          </div>
        </Card>
        <Card title={ts.data}>
          <div className="space-y-4">
            <Field label={ts.privacyEmail} htmlFor="privacyContactEmail">
              <input id="privacyContactEmail" name="privacyContactEmail" type="email" defaultValue={s.privacyContactEmail ?? ""} className="input" />
            </Field>
            <Field label={ts.privacy} htmlFor="privacyPolicy">
              <textarea id="privacyPolicy" name="privacyPolicy" rows={4} maxLength={8000} defaultValue={s.privacyPolicy ?? ""} className="input" />
            </Field>
            <Num name="dataRetentionMonths" label={ts.retention} value={s.dataRetentionMonths} min={1} max={120} />
            <a href="/api/panell/export" className="btn-secondary">⬇ {ts.exportOrg}</a>
          </div>
        </Card>
        <div className="sticky bottom-0 -mx-4 border-t border-stone-200 bg-stone-50/95 px-4 py-3 backdrop-blur">
          <SubmitButton>{t.common.save}</SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}
