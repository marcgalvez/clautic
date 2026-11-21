import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgAdmin } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n";
import { ActionForm } from "@/components/ActionForm";
import { Card, Checkbox, Field, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { saveService } from "../../actions";

export default async function ServiceForm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrgAdmin();
  const { t } = await getT(ctx.user.locale);
  const s = id === "nou" ? null : await db.service.findFirst({ where: { id, organizationId: ctx.orgId }, include: { professionals: true } });
  if (id !== "nou" && !s) notFound();
  const pros = await db.professional.findMany({ where: { organizationId: ctx.orgId }, orderBy: { sortOrder: "asc" } });
  const ts = t.dash.services;
  const assigned = new Set(s ? s.professionals.map((p) => p.professionalId) : pros.map((p) => p.id));
  return (
    <>
      <PageHeader title={s ? s.name : ts.new} />
      <Card className="max-w-2xl">
        <ActionForm action={saveService}>
          {s && <input type="hidden" name="id" value={s.id} />}
          <Field label={t.common.name} htmlFor="name">
            <input id="name" name="name" required maxLength={80} defaultValue={s?.name} className="input" />
          </Field>
          <Field label={`${ts.description} (${t.common.optional})`} htmlFor="description">
            <textarea id="description" name="description" maxLength={500} rows={2} defaultValue={s?.description ?? ""} className="input" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={ts.duration} htmlFor="duration">
              <input id="duration" name="duration" type="number" min={5} max={600} step={5} required defaultValue={s?.durationMinutes ?? 30} className="input" />
            </Field>
            <Field label={`${ts.price} (${t.common.optional})`} htmlFor="price">
              <input id="price" name="price" inputMode="decimal" defaultValue={s?.priceCents != null ? (s.priceCents / 100).toFixed(2) : ""} className="input" />
            </Field>
            <Field label={ts.bufferBefore} htmlFor="bufferBefore">
              <input id="bufferBefore" name="bufferBefore" type="number" min={0} max={240} defaultValue={s?.bufferBeforeMinutes ?? 0} className="input" />
            </Field>
            <Field label={ts.bufferAfter} htmlFor="bufferAfter">
              <input id="bufferAfter" name="bufferAfter" type="number" min={0} max={240} defaultValue={s?.bufferAfterMinutes ?? 0} className="input" />
            </Field>
          </div>
          <fieldset>
            <legend className="label">{ts.professionals}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {pros.map((p) => (
                <Checkbox key={p.id} name="professionalIds" value={p.id} defaultChecked={assigned.has(p.id)} label={p.name} />
              ))}
            </div>
          </fieldset>
          <Checkbox name="active" defaultChecked={s?.active ?? true} label={t.common.active} />
          <SubmitButton>{t.common.save}</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
