import { DateTime } from "luxon";
import { db } from "@/lib/db";
import { ForbiddenError, isOrgAdmin, requireOrg } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n";
import { fmtDateTime } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { Badge, Card, Checkbox, Empty, Field, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { createBlock, deleteBlock } from "../actions";

export default async function Blocks({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireOrg();
  const { t, locale } = await getT(ctx.user.locale);
  const tb = t.dash.blocks;
  const admin = isOrgAdmin(ctx);
  const me = ctx.professionalId ? await db.professional.findFirst({ where: { id: ctx.professionalId, organizationId: ctx.orgId } }) : null;
  if (!admin && !me?.canManageAvailability) throw new ForbiddenError();
  const s = await db.organizationSettings.findUniqueOrThrow({ where: { organizationId: ctx.orgId } });
  const [pros, blocks] = await Promise.all([
    db.professional.findMany({ where: { organizationId: ctx.orgId, ...(admin ? {} : { id: me!.id }) }, orderBy: { sortOrder: "asc" } }),
    db.timeOff.findMany({ where: { organizationId: ctx.orgId, endsAt: { gte: new Date() }, ...(admin ? {} : { professionalId: me!.id }) }, include: { professional: true }, orderBy: { startsAt: "asc" } }),
  ]);
  const today = sp.date ?? DateTime.now().setZone(s.timezone).toISODate()!;
  return (
    <>
      <PageHeader title={tb.title} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={tb.new}>
          <ActionForm action={createBlock}>
            <Field label={tb.type} htmlFor="type">
              <select id="type" name="type" className="input">
                {Object.entries(tb.types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label={t.dash.appt.professional} htmlFor="professionalId">
              <select id="professionalId" name="professionalId" className="input">
                {admin && <option value="">{tb.whole}</option>}
                {pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t.common.from} htmlFor="startDate"><input id="startDate" name="startDate" type="date" required defaultValue={today} className="input" /></Field>
              <Field label={t.common.time} htmlFor="startTime"><input id="startTime" name="startTime" type="time" className="input" /></Field>
              <Field label={t.common.to} htmlFor="endDate"><input id="endDate" name="endDate" type="date" defaultValue={today} className="input" /></Field>
              <Field label={t.common.time} htmlFor="endTime"><input id="endTime" name="endTime" type="time" className="input" /></Field>
            </div>
            <Checkbox name="allDay" label={tb.allDay} />
            <Field label={`${tb.reason} (${t.common.optional})`} htmlFor="reason"><input id="reason" name="reason" maxLength={200} className="input" /></Field>
            <SubmitButton>{t.common.create}</SubmitButton>
          </ActionForm>
        </Card>
        <Card title={tb.upcoming}>
          {!blocks.length ? (
            <Empty>{tb.empty}</Empty>
          ) : (
            <ul className="divide-y divide-stone-100">
              {blocks.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="text-sm">
                    <div className="font-medium">{fmtDateTime(b.startsAt, s.timezone, locale)} → {fmtDateTime(b.endsAt, s.timezone, locale)}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge tone={b.type === "HOLIDAY" ? "red" : b.type === "VACATION" ? "blue" : "gray"}>{tb.types[b.type]}</Badge>
                      <Badge>{b.professional?.name ?? tb.whole}</Badge>
                      {b.reason && <span className="text-stone-600">{b.reason}</span>}
                    </div>
                  </div>
                  <form action={deleteBlock}><input type="hidden" name="id" value={b.id} /><SubmitButton className="btn-ghost text-red-700">{t.common.delete}</SubmitButton></form>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
