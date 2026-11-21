import Link from "next/link";
import { db } from "@/lib/db";
import { requireOrgAdmin } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n";
import { fmtPrice } from "@/lib/format";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { toggleService } from "../actions";

export default async function Services() {
  const ctx = await requireOrgAdmin();
  const { t, locale } = await getT(ctx.user.locale);
  const services = await db.service.findMany({ where: { organizationId: ctx.orgId }, include: { professionals: { include: { professional: true } } }, orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }] });
  return (
    <>
      <PageHeader title={t.dash.services.title} actions={<Link href="/panell/serveis/nou" className="btn-primary">+ {t.dash.services.new}</Link>} />
      {!services.length ? (
        <Empty>{t.dash.services.empty}</Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {services.map((s) => (
            <li key={s.id} className={`card flex flex-col gap-3 ${s.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{s.name}</h2>
                  <p className="text-sm text-stone-600">
                    {s.durationMinutes} {t.common.minutes}
                    {s.priceCents != null && ` · ${fmtPrice(s.priceCents, locale)}`}
                    {(s.bufferBeforeMinutes || s.bufferAfterMinutes) > 0 && ` · +${s.bufferBeforeMinutes}/${s.bufferAfterMinutes}′`}
                  </p>
                </div>
                <Badge tone={s.active ? "green" : "gray"}>{s.active ? t.common.active : t.common.inactive}</Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {s.professionals.map((p) => (
                  <span key={p.professionalId} className="rounded-full bg-stone-100 px-2 py-0.5 text-xs">{p.professional.name}</span>
                ))}
                {!s.professionals.length && <Badge tone="red">{t.dash.services.professionals}: 0</Badge>}
              </div>
              <div className="flex gap-2">
                <Link href={`/panell/serveis/${s.id}`} className="btn-secondary">{t.common.edit}</Link>
                <form action={toggleService}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="btn-ghost">{s.active ? t.common.inactive : t.common.active}</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
